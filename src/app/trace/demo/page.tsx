import type { Metadata } from "next";
import QRCode from "qrcode";
import { STELLAR } from "@/lib/trace/stellar";
import "../trace.css";
import "./demo.css";

/** The batch the QR on the back of this pack opens: a demo twin whose 4 steps are on Stellar. */
const BATCH = "GAIA-DEMO-TM500-20261125";
const BATCH_URL = `https://production.vamadairy.in/trace/${BATCH}`;

export const metadata: Metadata = {
  title: "Scan the pack | Gaia Dairy",
  description: "Scan the QR on the back of the pack to see this batch, read from the Stellar blockchain.",
};

/**
 * A public showcase: one pack, front and back, with the back's QR printed large so it can be scanned
 * straight off the screen. Nothing here is read from our database.
 */
export default async function ScanDemoPage() {
  const qr = await QRCode.toString(BATCH_URL, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#2f3992", light: "#ffffff" },
  });

  return (
    <div className="gt-page gd-page">
      <header className="gt-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trace/gaia-logo.png" alt="Gaia" className="gt-logo" />
      </header>

      <section className="gt-hero">
        <p className="gt-eyebrow">Batch check on Stellar</p>
        <h1 className="gt-title">Scan the back of the pack</h1>
        <p className="gd-lead">Find the small QR on the back of the pouch and point your phone camera at it. It opens this exact batch, read from the blockchain.</p>
      </section>

      <div className="gd-stage">
        <figure className="gd-back" aria-label="Back of the pack with the batch QR printed in its corner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trace/toned-milk-500.png" alt="" className="gd-pouch" />
          {/* the printed back label of the pouch; the QR sits small in its corner, as on a real pack */}
          <div className="gd-label">
            <p className="gd-l-name">Toned Milk</p>
            <p className="gd-l-sub">Pasteurised · Homogenised</p>
            <dl className="gd-l-rows">
              <div><dt>Net qty</dt><dd>500 ml</dd></div>
              <div><dt>Batch no.</dt><dd>{BATCH}</dd></div>
            </dl>
            <div className="gd-l-foot">
              <p className="gd-l-hint">Scan to trace this pack from source to shelf</p>
              <div className="gd-qr" dangerouslySetInnerHTML={{ __html: qr }} />
            </div>
          </div>
        </figure>

        <figure className="gd-front">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trace/toned-milk-500.png" alt="Gaia Toned Milk 500 ml, front of the pack" />
          <figcaption>Front</figcaption>
        </figure>
      </div>

      <a className="gd-open" href={`/trace/${BATCH}`}>
        On your phone already? Open the batch
      </a>

      <ul className="gd-steps">
        <li><b>1</b> Milk collected</li>
        <li><b>2</b> Processed</li>
        <li><b>3</b> Packed</li>
        <li><b>4</b> Dispatched</li>
      </ul>
      <p className="gd-note">
        Every step is a record on Stellar {STELLAR.network} and is re-checked on the phone that scans it.
      </p>
    </div>
  );
}
