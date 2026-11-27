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
 * A public showcase: the back of one milk pouch, drawn as it would be printed, with the batch QR small in
 * its corner. Nothing here is read from our database.
 */
export default async function ScanDemoPage() {
  const qr = await QRCode.toString(BATCH_URL, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div className="gt-page gd-page">
      <section className="gt-hero">
        <p className="gt-eyebrow">Batch check on Stellar</p>
        <h1 className="gt-title">Scan the back of the pack</h1>
        <p className="gd-lead">Point your phone camera at the small QR. It opens this exact batch, read from the blockchain.</p>
      </section>

      {/* the back of a 500 ml pouch: sealed ends, white upper panel, blue lower band */}
      <figure className="gd-pack" aria-label="Back of the Toned Milk 500 ml pouch, with the batch QR in its corner">
        <div className="gd-seal" />
        <div className="gd-face">
          <div className="gd-upper">
            <div className="gd-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/trace/gaia-logo.png" alt="Gaia" />
              <div>
                <p className="gd-name">Toned Milk</p>
                <p className="gd-sub">Pasteurised · Homogenised</p>
              </div>
            </div>
            <table className="gd-nutri">
              <caption>Nutrition information per 100 ml</caption>
              <tbody>
                <tr><th>Fat</th><td>3.0 g</td></tr>
                <tr><th>Protein</th><td>3.3 g</td></tr>
                <tr><th>Milk solids-not-fat</th><td>8.5 g</td></tr>
              </tbody>
            </table>
            <p className="gd-small">Ingredients: toned milk. Keep refrigerated below 4 °C.</p>
          </div>
          <div className="gd-band">
            <dl className="gd-codes">
              <div><dt>Net qty</dt><dd>500 ml</dd></div>
              <div><dt>Batch no.</dt><dd>{BATCH}</dd></div>
            </dl>
            <div className="gd-qrbox">
              <div className="gd-qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <p>Scan to trace</p>
            </div>
          </div>
        </div>
        <div className="gd-seal" />
      </figure>

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
