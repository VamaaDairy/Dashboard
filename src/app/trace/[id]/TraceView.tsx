"use client";

import { useEffect, useState } from "react";
import {
  Account, Contract, Keypair, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr,
} from "@stellar/stellar-sdk";

type Chain = { rpcUrl: string; passphrase: string; contractId: string; network: string; explorer: string };
type Product = { name: string; size: string | null; image: string | null };
type Anchor = { kind: string; hash: Uint8Array; uri: string; at: bigint; ledger: number };
type OnChainBatch = { holder: string; product: string };

type Facts = {
  made_on?: string;
  plant_batch_no?: string;
  made_as?: string;
  output?: { qty: number; unit: string };
  milk?: { litres: number; fat_pct: number | null; snf_pct: number | null };
  lab_test?: { fat_pct: number | null; snf_pct: number | null; clr: number | null };
  ingredients?: string[];
};
type Rec = { batch_id: string; kind: string; contract: string; product?: { name: string; size?: string }; data: Facts };

type Check =
  | { state: "checking" }
  | { state: "match"; record: Rec }
  | { state: "mismatch"; reason: string }
  | { state: "unreachable" };

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const LEDGER_SECONDS = 5;

const STEP: Record<string, { title: string; line: string }> = {
  processed: { title: "Made at the plant", line: "The batch as it left production." },
  updated: { title: "Updated", line: "A correction to the batch, recorded after it was first made." },
};

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
});
const num = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: d });

async function readChain(chain: Chain, traceId: string) {
  const server = new rpc.Server(chain.rpcUrl);
  const contract = new Contract(chain.contractId);
  const reader = new Account(Keypair.random().publicKey(), "0");
  const id = nativeToScVal(traceId, { type: "string" });
  const call = async <T,>(method: string): Promise<T> => {
    const tx = new TransactionBuilder(reader, { fee: "100", networkPassphrase: chain.passphrase })
      .addOperation(contract.call(method, id)).setTimeout(30).build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
    return scValToNative(sim.result!.retval) as T;
  };
  const [batch, events] = await Promise.all([call<OnChainBatch | null>("batch"), call<Anchor[]>("events")]);

  let until: Date | null = null;
  try {
    const key = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Events"), id]);
    const [entry, latest] = await Promise.all([
      server.getContractData(chain.contractId, key, rpc.Durability.Persistent),
      server.getLatestLedger(),
    ]);
    if (entry.liveUntilLedgerSeq) until = new Date(Date.now() + (entry.liveUntilLedgerSeq - latest.sequence) * LEDGER_SECONDS * 1000);
  } catch {
    /* not critical */
  }
  return { batch, events, until };
}

async function verify(chain: Chain, traceId: string, a: Anchor): Promise<Check> {
  let bytes: ArrayBuffer;
  try {
    const res = await fetch(a.uri, { cache: "no-store" });
    if (!res.ok) return { state: "unreachable" };
    bytes = await res.arrayBuffer();
  } catch {
    return { state: "unreachable" };
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  if (hex(digest) !== hex(a.hash)) return { state: "mismatch", reason: "the record was changed after it was put on the blockchain" };
  let record: Rec;
  try {
    record = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { state: "mismatch", reason: "the record is not readable" };
  }
  if (record.batch_id !== traceId || record.kind !== a.kind || record.contract !== chain.contractId) {
    return { state: "mismatch", reason: "the record belongs to a different batch" };
  }
  return { state: "match", record };
}

export function TraceView({ traceId, product, chain }: { traceId: string; product: Product; chain: Chain }) {
  const [data, setData] = useState<
    | { s: "loading" }
    | { s: "error" }
    | { s: "ok"; batch: OnChainBatch | null; events: Anchor[]; until: Date | null }
  >({ s: "loading" });
  const [checks, setChecks] = useState<Check[]>([]);

  useEffect(() => {
    let live = true;
    readChain(chain, traceId)
      .then((r) => {
        if (!live) return;
        setData({ s: "ok", ...r });
        setChecks(r.events.map(() => ({ state: "checking" })));
        r.events.forEach((a, i) =>
          verify(chain, traceId, a).then((c) => live && setChecks((cs) => cs.map((x, j) => (j === i ? c : x)))),
        );
      })
      .catch(() => live && setData({ s: "error" }));
    return () => { live = false; };
  }, [chain, traceId]);

  const allGood = data.s === "ok" && data.events.length > 0 && checks.every((c) => c.state === "match");
  const anyBad = checks.some((c) => c.state === "mismatch");
  // the latest verified record describes the batch as it stands
  const latest = [...checks].reverse().find((c): c is Extract<Check, { state: "match" }> => c.state === "match")?.record;
  const f = latest?.data;

  return (
    <div className="gt-page">
      <header className="gt-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trace/gaia-logo.png" alt="Gaia" className="gt-logo" />
      </header>

      <section className="gt-hero">
        <p className="gt-eyebrow">Batch {traceId}</p>
        <h1 className="gt-title">{product.name}</h1>
        {product.size ? <p className="gt-size">{product.size}</p> : null}
        {product.image ? (
          <div className="gt-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.name} />
          </div>
        ) : null}
        <p className={`gt-verdict ${anyBad ? "bad" : allGood ? "good" : ""}`}>
          {data.s === "loading" && "Checking this batch on the Stellar blockchain…"}
          {data.s === "error" && "We could not reach the blockchain right now. Please try again in a minute."}
          {data.s === "ok" && data.events.length === 0 && "This batch has no records on the blockchain yet."}
          {data.s === "ok" && data.events.length > 0 && (anyBad
            ? "Something on this page does not match the blockchain. Please tell us at care@gaiadairy.com."
            : allGood
              ? "Your phone just checked this batch against the Stellar blockchain. Everything matches."
              : "Checking each record against the blockchain…")}
        </p>
        {data.s === "ok" && data.until ? <p className="gt-eyebrow">Stored until {day.format(data.until)}</p> : null}
      </section>

      {f ? (
        <section className="gt-card gt-facts">
          <h2>This batch</h2>
          <dl>
            {f.made_on ? <Row k="Made on" v={day.format(new Date(`${f.made_on}T00:00:00`))} /> : null}
            {f.plant_batch_no ? <Row k="Plant batch" v={f.plant_batch_no} /> : null}
            {f.output ? <Row k="Batch size" v={`${num(f.output.qty)} ${f.output.unit}`} /> : null}
            {f.milk ? <Row k="Milk used" v={`${num(f.milk.litres, 0)} L`} /> : null}
            {f.milk?.fat_pct != null ? <Row k="Milk fat" v={`${num(f.milk.fat_pct, 2)} %`} /> : null}
            {f.milk?.snf_pct != null ? <Row k="Milk SNF" v={`${num(f.milk.snf_pct, 2)} %`} /> : null}
          </dl>
          {f.lab_test ? (
            <div className="gt-lab">
              <div className="gt-lab-title">Lab test of the milk</div>
              <div className="gt-lab-grid">
                <Stat label="Fat" value={f.lab_test.fat_pct} unit="%" />
                <Stat label="SNF" value={f.lab_test.snf_pct} unit="%" />
                <Stat label="CLR" value={f.lab_test.clr} unit="" />
              </div>
            </div>
          ) : null}
          {f.ingredients?.length ? (
            <div className="gt-ingredients">
              <div className="gt-lab-title">Made with</div>
              <p>{f.ingredients.join(" · ")}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {data.s === "ok" && data.events.length > 0 ? (
        <section>
          <h2 className="gt-section">On the blockchain</h2>
          <ol className="gt-timeline">
            {data.events.map((a, i) => {
              const c = checks[i] ?? { state: "checking" };
              const at = new Date(Number(a.at) * 1000);
              const step = STEP[a.kind] ?? { title: a.kind.replace(/_/g, " "), line: "" };
              return (
                <li key={i} className="gt-step">
                  <div className="gt-step-date">{day.format(at)}</div>
                  <article className="gt-card">
                    <h3>{step.title}</h3>
                    {step.line ? <p className="gt-muted">{step.line}</p> : null}
                    <p className={`gt-status ${c.state}`}>
                      {c.state === "checking" && "Checking…"}
                      {c.state === "match" && `✓ Matches its Stellar record of ${stamp.format(at)} IST`}
                      {c.state === "mismatch" && `✗ Does not match: ${c.reason}`}
                      {c.state === "unreachable" && "The record file could not be fetched; its fingerprint is still on the blockchain."}
                    </p>
                    <div className="gt-links">
                      <a href={`${chain.explorer}/ledger/${a.ledger}`} target="_blank" rel="noreferrer">Stellar record ↗</a>
                      <a href={a.uri} target="_blank" rel="noreferrer">Record file ↗</a>
                    </div>
                    <details>
                      <summary>Fingerprint</summary>
                      <p className="gt-mono">sha256 {hex(a.hash)}</p>
                    </details>
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <footer className="gt-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trace/village.png" alt="" className="gt-village" />
        <p>From our farmers to your home.</p>
        <p className="gt-muted gt-small">
          Recorded on Stellar {chain.network === "mainnet" ? "" : "(test network) "}·{" "}
          <a href={`${chain.explorer}/contract/${chain.contractId}`} target="_blank" rel="noreferrer">contract ↗</a>
          {data.s === "ok" && data.batch ? (
            <> · twin held by <span className="gt-mono">{data.batch.holder.slice(0, 6)}…{data.batch.holder.slice(-4)}</span></>
          ) : null}
        </p>
      </footer>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="gt-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="gt-stat">
      <div className="gt-stat-value">{num(value, 2)}<span>{value === null ? "" : unit}</span></div>
      <div className="gt-stat-label">{label}</div>
    </div>
  );
}
