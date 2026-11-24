import "server-only";
import {
  Address,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

/**
 * Writes to the Gaia batch-registry contract on Stellar (source: ~/gaia-trace/contracts/batch-registry).
 * The key in STELLAR_SECRET must be an operator on the contract.
 */
export const STELLAR = {
  network: process.env.STELLAR_NETWORK ?? "testnet",
  rpcUrl: process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
  passphrase: process.env.STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  contractId: process.env.STELLAR_CONTRACT_ID ?? "CBIVUDP7G6G4GFARTVA2BSREQ7K3YZYSGFYYJWGT7DB4ARU7XXU2BG24",
};

export const explorerBase = () =>
  `https://stellar.expert/explorer/${STELLAR.network === "mainnet" ? "public" : "testnet"}`;

const CONTRACT_ERRORS: Record<number, string> = {
  1: "This server's key is not allowed to record on the contract",
  2: "This batch is already on the chain",
  3: "The batch is not on the chain yet",
  4: "This batch has reached its limit of 64 records",
  5: "This exact record is already on the chain",
  6: "A name or link is too long for the contract",
};

export class ChainError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

function signer(): Keypair {
  const secret = process.env.STELLAR_SECRET;
  if (!secret) throw new ChainError("Stellar is not set up on this server (STELLAR_SECRET is missing)");
  return Keypair.fromSecret(secret);
}

export const isConfigured = () => Boolean(process.env.STELLAR_SECRET);

const server = () => new rpc.Server(STELLAR.rpcUrl);

// One write at a time from this process, so sequence numbers never collide.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function contractError(message: string): ChainError {
  const m = message.match(/Error\(Contract, #(\d+)\)/);
  if (m) {
    const code = Number(m[1]);
    return new ChainError(CONTRACT_ERRORS[code] ?? `Contract error #${code}`, code);
  }
  return new ChainError(`Stellar refused the call: ${message.split("\n")[0].slice(0, 200)}`);
}

async function invoke(method: string, args: xdr.ScVal[]) {
  return serial(async () => {
    const key = signer();
    const s = server();
    const account = await s.getAccount(key.publicKey());
    const tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: STELLAR.passphrase })
      .addOperation(new Contract(STELLAR.contractId).call(method, ...args))
      .setTimeout(60)
      .build();

    const sim = await s.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw contractError(sim.error);
    const prepared = rpc.assembleTransaction(tx, sim).build();
    prepared.sign(key);

    const sent = await s.sendTransaction(prepared);
    if (sent.status === "ERROR") throw new ChainError("Stellar rejected the transaction");
    for (let i = 0; i < 30; i++) {
      const got = await s.getTransaction(sent.hash);
      if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return {
          txHash: sent.hash,
          ledger: got.ledger,
          value: got.returnValue ? scValToNative(got.returnValue) : null,
        };
      }
      if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new ChainError(`The Stellar transaction failed (${sent.hash.slice(0, 10)}…)`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new ChainError(`No answer from Stellar for ${sent.hash.slice(0, 10)}… - check again in a minute`);
  });
}

const operator = () => new Address(signer().publicKey()).toScVal();
const str = (s: string) => nativeToScVal(s, { type: "string" });

export function createBatch(traceId: string, title: string) {
  return invoke("create_batch", [operator(), str(traceId), str(title.slice(0, 64))]);
}

/** v2: stores the record's exact bytes on chain; the contract hashes them. Returns the anchor's index. */
export async function recordFull(traceId: string, kind: string, bytes: Buffer) {
  const res = await invoke("record_full", [
    operator(),
    str(traceId),
    nativeToScVal(kind, { type: "symbol" }),
    nativeToScVal(bytes),
  ]);
  return { ...res, index: typeof res.value === "number" ? res.value : null };
}

/** v1: anchors only a hash; the record lives at `uri`. Kept for records made before v2. */
export async function anchor(traceId: string, kind: string, hashHex: string, uri: string) {
  const res = await invoke("anchor", [
    operator(),
    str(traceId),
    nativeToScVal(kind, { type: "symbol" }),
    nativeToScVal(Buffer.from(hashHex, "hex")),
    str(uri),
  ]);
  return { ...res, index: typeof res.value === "number" ? res.value : null };
}
