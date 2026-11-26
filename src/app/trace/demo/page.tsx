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
        <p className="gd-lead">Point your phone camera at the QR. It opens this exact batch, read from the blockchain.</p>
      </section>

      <div className="gd-stage">
        <figure className="gd-back" aria-label="Back of the pack with the batch QR">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trace/toned-milk-500.png" alt="" className="gd-pouch" />
          <div className="gd-label">
            <div className="gd-qr" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="gd-scan">Scan to check this batch</p>
            <p className="gd-batch">{BATCH}</p>
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
