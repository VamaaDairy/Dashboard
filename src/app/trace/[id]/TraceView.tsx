"use client";

import { useEffect, useState } from "react";
import {
  Account, Contract, Keypair, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr,
} from "@stellar/stellar-sdk";
import type { CollectedData, DispatchedData, PackedData, ProcessedData } from "@/lib/trace/records";

type Chain = { rpcUrl: string; passphrase: string; contractId: string; network: string; explorer: string };
type Product = { name: string; size: string | null; image: string | null };
type Anchor = { kind: string; hash: Uint8Array; uri: string; at: bigint; ledger: number };
type OnChainBatch = { holder: string; product: string };
type Rec = { schema?: string; batch_id: string; kind: string; contract: string; data: Record<string, unknown> };

const ON_CHAIN = "stellar:record";

type Check =
  | { state: "checking" }
  | { state: "match"; record: Rec; onChain: boolean; bytes: number }
  | { state: "mismatch"; reason: string }
  | { state: "unreachable" };

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const LEDGER_SECONDS = 5;

const STEP: Record<string, { title: string; line: string; icon: string }> = {
  collected: { title: "Milk collected", line: "From our partner farmers at the village centres.", icon: "🥛" },
  processed: { title: "Processed at the plant", line: "Tested, pasteurised and made into this batch.", icon: "🏭" },
  packed: { title: "Packed", line: "Sealed into the pack in your hand.", icon: "📦" },
  dispatched: { title: "Dispatched", line: "On its way from the plant to your area.", icon: "🚚" },
  updated: { title: "Updated", line: "A correction recorded after the batch was first made.", icon: "✏️" },
};

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const stamp = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
});
const isoDay = (s?: string) => (s ? day.format(new Date(s.length === 10 ? `${s}T00:00:00` : s)) : "—");
const isoTime = (s?: string) => (s ? `${stamp.format(new Date(s))} IST` : "—");
const num = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: d });
const osm = (lat?: number, lng?: number) =>
  lat !== undefined && lng !== undefined ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}` : null;

function chainReader(chain: Chain) {
  const server = new rpc.Server(chain.rpcUrl);
  const contract = new Contract(chain.contractId);
  const reader = new Account(Keypair.random().publicKey(), "0");
  const call = async <T,>(method: string, ...args: xdr.ScVal[]): Promise<T> => {
    const tx = new TransactionBuilder(reader, { fee: "100", networkPassphrase: chain.passphrase })
      .addOperation(contract.call(method, ...args)).setTimeout(30).build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
    return scValToNative(sim.result!.retval) as T;
  };
  return { server, call };
}

async function readChain(chain: Chain, traceId: string) {
  const { server, call } = chainReader(chain);
  const id = nativeToScVal(traceId, { type: "string" });
  const [batch, events] = await Promise.all([call<OnChainBatch | null>("batch", id), call<Anchor[]>("events", id)]);
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

/** Gets a record's bytes - from Stellar itself (v2) or from its link (v1) - and checks them against the anchor. */
async function verify(chain: Chain, traceId: string, a: Anchor, index: number): Promise<Check> {
  let bytes: Uint8Array;
  const onChain = a.uri === ON_CHAIN;
  try {
    if (onChain) {
      const { call } = chainReader(chain);
      const got = await call<Uint8Array | null>("record", nativeToScVal(traceId, { type: "string" }), nativeToScVal(index, { type: "u32" }));
      if (!got) return { state: "unreachable" };
      bytes = new Uint8Array(got);
    } else {
      const res = await fetch(a.uri, { cache: "no-store" });
      if (!res.ok) return { state: "unreachable" };
      bytes = new Uint8Array(await res.arrayBuffer());
    }
  } catch {
    return { state: "unreachable" };
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer));
  if (hex(digest) !== hex(a.hash)) return { state: "mismatch", reason: "the record does not match its fingerprint on the blockchain" };
  let record: Rec;
  try {
    record = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { state: "mismatch", reason: "the record is not readable" };
  }
  if (record.batch_id !== traceId || record.kind !== a.kind || record.contract !== chain.contractId) {
    return { state: "mismatch", reason: "the record belongs to a different batch" };
  }
  return { state: "match", record, onChain, bytes: bytes.length };
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
          verify(chain, traceId, a, i).then((c) => live && setChecks((cs) => cs.map((x, j) => (j === i ? c : x)))),
        );
      })
      .catch(() => live && setData({ s: "error" }));
    return () => { live = false; };
  }, [chain, traceId]);

  const allGood = data.s === "ok" && data.events.length > 0 && checks.length === data.events.length && checks.every((c) => c.state === "match");
  const anyBad = checks.some((c) => c.state === "mismatch");
  const settled = data.s === "ok" && checks.length === data.events.length && checks.every((c) => c.state !== "checking");
  const latest = (kind: string) =>
    [...checks].reverse().find((c): c is Extract<Check, { state: "match" }> => c.state === "match" && c.record.kind === kind)?.record.data;
  const packed = latest("packed") as unknown as PackedData | undefined;
  const allOnChain = checks.length > 0 && checks.every((c) => c.state === "match" && c.onChain);

  return (
    <div className="gt-page">
      <header className="gt-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trace/gaia-logo.png" alt="Gaia" className="gt-logo" />
      </header>

      <section className="gt-hero">
        <h1 className="gt-title">{product.name}</h1>
        {product.size ? <p className="gt-size">{product.size}</p> : null}
        {product.image ? (
          <div className="gt-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.name} />
          </div>
        ) : null}
        <p className={`gt-verdict ${anyBad ? "bad" : allGood ? "good" : ""}`}>
          {data.s === "loading" && "Reading this batch from the Stellar blockchain…"}
          {data.s === "error" && "We could not reach the blockchain right now. Please try again in a minute."}
          {data.s === "ok" && data.events.length === 0 && "This batch has no records on the blockchain yet."}
          {data.s === "ok" && data.events.length > 0 && (anyBad
            ? "Something on this page does not match the blockchain. Please tell us at care@gaiadairy.com."
            : allGood
              ? allOnChain
                ? "Your phone just read this batch from the Stellar blockchain and checked every record. Everything matches."
                : "Your phone just checked this batch against the Stellar blockchain. Everything matches."
              : settled
                ? "Every record we could read matches the Stellar blockchain. Some could not be read right now - try again in a minute."
                : "Checking each record against the blockchain…")}
        </p>
        <p className="gt-eyebrow">Batch {traceId}</p>
        {data.s === "ok" && data.until ? <p className="gt-eyebrow">Stored until {day.format(data.until)}</p> : null}
      </section>

      {packed ? <ProductCard p={packed} /> : null}

      {data.s === "ok" && data.events.length > 0 ? (
        <section>
          <h2 className="gt-section">From farm to your home</h2>
          <ol className="gt-timeline">
            {data.events.map((a, i) => {
              const c = checks[i] ?? { state: "checking" };
              const at = new Date(Number(a.at) * 1000);
              const step = STEP[a.kind] ?? { title: a.kind.replace(/_/g, " "), line: "", icon: "•" };
              const rec = c.state === "match" ? c.record : null;
              const when = rec ? stepDate(rec) : null;
              return (
                <li key={i} className="gt-step">
                  <div className="gt-step-date">{when ?? day.format(at)}</div>
                  <article className="gt-card">
                    <h3><span className="gt-icon" aria-hidden>{step.icon}</span>{step.title}</h3>
                    {step.line ? <p className="gt-muted gt-line">{step.line}</p> : null}
                    {rec ? <StepBody rec={rec} /> : null}
                    <p className={`gt-status ${c.state}`}>
                      {c.state === "checking" && "Reading from the blockchain…"}
                      {c.state === "match" && (c.onChain
                        ? `✓ Read from Stellar and checked · stored ${stamp.format(at)} IST`
                        : `✓ Matches its Stellar fingerprint of ${stamp.format(at)} IST`)}
                      {c.state === "mismatch" && `✗ Does not match: ${c.reason}`}
                      {c.state === "unreachable" && "This record could not be read right now; its fingerprint is still on the blockchain."}
                    </p>
                    <div className="gt-links">
                      <a href={`${chain.explorer}/ledger/${a.ledger}`} target="_blank" rel="noreferrer">Stellar ledger {a.ledger} ↗</a>
                      {a.uri !== ON_CHAIN ? <a href={a.uri} target="_blank" rel="noreferrer">Record file ↗</a> : null}
                    </div>
                    <details>
                      <summary>Raw record{c.state === "match" ? ` · ${c.bytes.toLocaleString("en-IN")} bytes ${c.onChain ? "on chain" : "off chain"}` : ""}</summary>
                      <p className="gt-mono">sha256 {hex(a.hash)}</p>
                      {rec ? <pre className="gt-pre">{JSON.stringify(rec, null, 2)}</pre> : null}
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
          Stored on Stellar {chain.network === "mainnet" ? "" : "(test network) "}·{" "}
          <a href={`${chain.explorer}/contract/${chain.contractId}`} target="_blank" rel="noreferrer">contract ↗</a>
          {data.s === "ok" && data.batch ? (
            <> · twin held by <span className="gt-mono">{data.batch.holder.slice(0, 6)}…{data.batch.holder.slice(-4)}</span></>
          ) : null}
        </p>
      </footer>
    </div>
  );
}

function stepDate(rec: Rec): string | null {
  const d = rec.data as Record<string, unknown>;
  if (rec.kind === "collected" && typeof d.from === "string" && typeof d.to === "string") {
    return d.from === d.to ? isoDay(d.to) : `${isoDay(d.from)} – ${isoDay(d.to)}`;
  }
  const v = (d.made_on ?? d.packed_on) as string | undefined;
  if (v) return isoDay(v);
  const trips = (d as unknown as DispatchedData).trips;
  if (Array.isArray(trips) && trips.length) return isoDay(trips[0].date);
  return null;
}

function ProductCard({ p }: { p: PackedData }) {
  return (
    <section className="gt-card gt-product">
      {p.about ? <p className="gt-about">{p.about}</p> : null}
      {p.highlights?.length ? (
        <ul className="gt-chips">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
      ) : null}
      <div className="gt-keep">
        <div className="gt-lab-title">How to keep it</div>
        <p>{p.storage}</p>
        {p.use_by ? <p className="gt-useby">Use by <strong>{isoDay(p.use_by)}</strong>{p.shelf_life_days ? ` · ${p.shelf_life_days}-day shelf life` : ""}</p> : null}
      </div>
      {p.nutrition?.rows?.length ? (
        <div className="gt-nutrition">
          <div className="gt-lab-title">Per {p.nutrition.per}{p.nutrition.typical ? " · typical values" : ""}</div>
          <dl>
            {p.nutrition.rows.map(([k, v]) => <Row key={k} k={k} v={v} />)}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

function StepBody({ rec }: { rec: Rec }) {
  const d = rec.data as unknown;
  if (rec.kind === "collected") {
    const c = d as CollectedData;
    return (
      <>
        <dl>
          <Row k="Milk collected" v={`${num(c.total_litres, 0)} L`} />
          <Row k="Village centres" v={String(c.centres.length)} />
          <Row k="Farmers" v={c.farmers} />
        </dl>
        <div className="gt-centres">
          {c.centres.map((x) => (
            <div key={x.centre} className="gt-centre">
              <div className="gt-centre-name">{x.name}{x.kind === "tanker" ? " · tanker" : ""}</div>
              <div className="gt-centre-grid">
                <span><b>{num(x.litres, 0)}</b> L</span>
                <span>Fat <b>{num(x.fat_pct, 2)}</b> %</span>
                <span>SNF <b>{num(x.snf_pct, 2)}</b> %</span>
              </div>
              <div className="gt-muted gt-small">{x.farmers} farmer{x.farmers === 1 ? "" : "s"} · {x.pours} pour{x.pours === 1 ? "" : "s"}{x.shifts.length ? ` · ${x.shifts.join(" & ")}` : ""}</div>
            </div>
          ))}
        </div>
        <p className="gt-muted gt-small">{c.note}</p>
      </>
    );
  }
  if (rec.kind === "processed" || rec.kind === "updated") {
    const p = d as ProcessedData & { made_as?: string };
    const map = p.plant ? osm(p.plant.lat, p.plant.lng) : null;
    return (
      <>
        <dl>
          {p.plant ? <Row k="Site" v={[p.plant.name, p.plant.area].filter(Boolean).join(", ")} /> : null}
          {p.plant?.lat !== undefined ? (
            <div className="gt-row"><dt>GPS</dt><dd>{map ? <a href={map} target="_blank" rel="noreferrer">{p.plant.lat.toFixed(4)}° N, {p.plant.lng!.toFixed(4)}° E ↗</a> : null}</dd></div>
          ) : null}
          {p.made_on ? <Row k="Made on" v={isoDay(p.made_on)} /> : null}
          {p.plant_batch_no ? <Row k="Plant batch" v={p.plant_batch_no} /> : null}
          {p.made_as ? <Row k="Made as" v={p.made_as} /> : null}
          {p.milk ? <Row k="Milk used" v={`${num(p.milk.litres, 0)} L${p.milk.tanks ? ` from ${p.milk.tanks} tank${p.milk.tanks === 1 ? "" : "s"}` : ""}`} /> : null}
          {p.milk?.fat_pct != null ? <Row k="Milk fat" v={`${num(p.milk.fat_pct, 2)} %`} /> : null}
          {p.milk?.snf_pct != null ? <Row k="Milk SNF" v={`${num(p.milk.snf_pct, 2)} %`} /> : null}
          {p.pasteurised ? <Row k="Pasteurised" v="Yes" /> : null}
          {p.output ? <Row k="Batch size" v={`${num(p.output.qty)} ${p.output.unit}`} /> : null}
        </dl>
        {p.lab_test ? (
          <div className="gt-lab">
            <div className="gt-lab-title">Lab test of the milk</div>
            <div className="gt-lab-grid">
              <Stat label="Fat" value={p.lab_test.fat_pct} unit="%" />
              <Stat label="SNF" value={p.lab_test.snf_pct} unit="%" />
              <Stat label="CLR" value={p.lab_test.clr} unit="" />
            </div>
          </div>
        ) : null}
        {p.ingredients?.length ? (
          <div className="gt-ingredients">
            <div className="gt-lab-title">Made with</div>
            <p>{p.ingredients.join(" · ")}</p>
          </div>
        ) : null}
      </>
    );
  }
  if (rec.kind === "packed") {
    const p = d as PackedData;
    return (
      <dl>
        <Row k="Product" v={p.name} />
        {p.size ? <Row k="Pack" v={p.size} /> : null}
        <Row k="SKU" v={p.sku} />
        {p.pieces ? <Row k="Packs made that day" v={num(p.pieces, 0)} /> : null}
        <Row k="Packed on" v={isoDay(p.packed_on)} />
        {p.use_by ? <Row k="Use by" v={isoDay(p.use_by)} /> : null}
      </dl>
    );
  }
  if (rec.kind === "dispatched") {
    const x = d as DispatchedData;
    const from = osm(x.from.lat, x.from.lng);
    return (
      <>
        <dl>
          <div className="gt-row"><dt>From</dt><dd>{from ? <a href={from} target="_blank" rel="noreferrer">{x.from.name} ↗</a> : x.from.name}</dd></div>
          <Row k="Trucks" v={String(x.trips.length)} />
        </dl>
        <div className="gt-centres">
          {x.trips.map((t) => (
            <div key={t.trip} className="gt-centre">
              <div className="gt-centre-name">{t.route}{t.vehicle ? ` · ${t.vehicle}` : ""}</div>
              <dl>
                <Row k="Departed" v={isoTime(t.departed_at)} />
                <Row k="Arrived" v={t.arrived_at ? isoTime(t.arrived_at) : t.status === "on_the_way" ? "On the way" : "—"} />
                <Row k="Stops delivered" v={`${t.delivered} of ${t.stops}`} />
                <Row k="Packs of this product" v={num(t.pieces, 0)} />
              </dl>
            </div>
          ))}
        </div>
      </>
    );
  }
  // records from v1 (schema gaia-trace/1) and anything new: show the facts plainly
  return (
    <dl>
      {Object.entries(rec.data ?? {}).map(([k, v]) => (
        <Row key={k} k={k.replace(/_/g, " ")} v={typeof v === "object" ? JSON.stringify(v) : String(v)} />
      ))}
    </dl>
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
