import "server-only";
/**
 * lib/outstandings/template.ts
 *
 * Renders the outstanding-balance + monthly-ledger statement as a single
 * self-contained HTML document: table-based layout, every style inline, no
 * external CSS/JS/fonts — the constraints email clients actually render
 * reliably under.
 */

import type { LedgerVoucher } from "./tally"

export interface StatementParty {
  name: string
  /** Debit-positive: what the party currently owes, per Tally's own closing balance. */
  balance: number
  /** 0 = not set (the Tally pull does not carry credit terms yet) */
  creditPeriodDays?: number
}

const inr = (n: number) =>
  Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const BRAND_BLUE = "#4A6FA5"
const INK = "#1f2937"
const MUTED = "#6b7280"
const BORDER = "#e5e7eb"

/** Referenced from the header `<img>` below and matched against the inline attachment's contentId when sending. */
export const LOGO_CONTENT_ID = "vamaa-logo"

export function renderStatementEmail(
  party: StatementParty,
  vouchers: LedgerVoucher[],
  opts: { periodLabel: string; fromLabel: string; asOfLabel: string },
): { subject: string; html: string } {
  const name = escapeHtml(party.name)
  const subject = `Account Statement for Reconciliation & Request for Balance Payment — ${party.name} (as of ${opts.asOfLabel})`

  const totalDebit = vouchers.reduce((s, v) => s + Math.max(0, -v.amount), 0)
  const totalCredit = vouchers.reduce((s, v) => s + Math.max(0, v.amount), 0)
  // Debit-positive balance at the start of the period, backed out from the
  // current closing balance and this period's net movement.
  const openingBalance = party.balance - (totalDebit - totalCredit)

  const rows =
    vouchers.length === 0
      ? `<tr><td colspan="5" style="padding:14px 12px;color:${MUTED};text-align:center;font-style:italic;">No transactions recorded this period.</td></tr>`
      : vouchers
          .map((v) => {
            const debit = Math.max(0, -v.amount)
            const credit = Math.max(0, v.amount)
            return `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};white-space:nowrap;">${escapeHtml(v.date)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};">${escapeHtml(v.voucherType)}${v.narration ? "<br/><span style=\"color:" + MUTED + ";font-size:12px;\">" + escapeHtml(v.narration) + "</span>" : ""}</td>
              <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};text-align:right;">${debit ? inr(debit) : ""}</td>
              <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};text-align:right;">${credit ? inr(credit) : ""}</td>
            </tr>`
          })
          .join("")

  const creditTermsRow =
    (party.creditPeriodDays ?? 0) > 0
      ? `<tr>
          <td style="padding:6px 0;color:${MUTED};">Credit Terms</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">Payment due within ${party.creditPeriodDays} days of invoice date</td>
        </tr>`
      : ""

  const html = `<div style="background:#f3f4f6;padding:24px 12px;font-family:'Segoe UI',Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-collapse:collapse;border:1px solid ${BORDER};">
    <tr>
      <td style="background:${BRAND_BLUE};padding:20px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;padding-right:16px;">
              <img src="cid:${LOGO_CONTENT_ID}" width="72" height="72" alt="Vamaa Dairy" style="display:block;border-radius:10px;background:#ffffff;" />
            </td>
            <td style="vertical-align:middle;">
              <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.3px;">Vamaa Dairy</div>
              <div style="color:#dbe6f7;font-size:13px;margin-top:2px;">Accounts Department</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;">
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">Dear Sir,</p>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">Greetings from Vamaa Dairy!</p>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">
          We are pleased to share the attached account statement for your kind review and reconciliation.
        </p>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">
          We would also sincerely request you to kindly arrange for the release of the outstanding balance
          payment at your earliest convenience.
        </p>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">
          Your support and cooperation in this regard would be highly appreciated.
        </p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
          Thank you for your continued association and support.<br/>
          Best Regards,<br/>
          Vamaa Dairy
        </p>

        <table role="presentation" width="100%" style="border-collapse:collapse;background:#f9fafb;border:1px solid ${BORDER};margin-bottom:24px;">
          <tr>
            <td style="padding:16px 18px 0 18px;" colspan="2">
              <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">
                <tr>
                  <td style="padding:6px 0;color:${MUTED};">Party</td>
                  <td style="padding:6px 0;text-align:right;font-weight:600;">${name}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:${MUTED};">Opening Balance (as of ${escapeHtml(opts.fromLabel)})</td>
                  <td style="padding:6px 0;text-align:right;font-weight:600;">${openingBalance < 0 ? "(" : ""}&#8377; ${inr(openingBalance)}${openingBalance < 0 ? ")" : ""}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:${MUTED};">Closing Balance / Outstanding as of ${escapeHtml(opts.asOfLabel)}</td>
                  <td style="padding:6px 0;text-align:right;font-weight:600;">${party.balance < 0 ? "(" : ""}&#8377; ${inr(party.balance)}${party.balance < 0 ? ")" : ""}</td>
                </tr>
                ${creditTermsRow}
              </table>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:18px;">
              <div style="background:${BRAND_BLUE};color:#ffffff;padding:14px 16px;text-align:right;">
                <span style="font-size:13px;opacity:0.85;">Total Outstanding</span><br/>
                <span style="font-size:24px;font-weight:700;">&#8377; ${inr(party.balance)}</span>
              </div>
            </td>
          </tr>
        </table>

        <h2 style="font-size:14px;margin:0 0 10px;color:${INK};">Ledger — ${escapeHtml(opts.periodLabel)}</h2>
        <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;border:1px solid ${BORDER};">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid ${BORDER};">Date</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:1px solid ${BORDER};">Particulars</th>
              <th style="padding:8px 12px;text-align:right;border-bottom:1px solid ${BORDER};">Debit</th>
              <th style="padding:8px 12px;text-align:right;border-bottom:1px solid ${BORDER};">Credit</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#f9fafb;font-weight:600;">
              <td colspan="2" style="padding:8px 12px;">Total</td>
              <td style="padding:8px 12px;text-align:right;">${inr(totalDebit)}</td>
              <td style="padding:8px 12px;text-align:right;">${inr(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>

        <p style="font-size:13px;color:${MUTED};line-height:1.6;margin-top:24px;">
          If you have already made this payment, please disregard this notice. For any queries regarding
          this statement, please contact us at
          <a href="mailto:accounts@vamaadairy.com" style="color:${BRAND_BLUE};">accounts@vamaadairy.com</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#f9fafb;border-top:1px solid ${BORDER};font-size:11px;color:${MUTED};text-align:center;">
        This is a computer-generated statement from Vamaa Dairy's Accounts Department and requires no signature.
      </td>
    </tr>
  </table>
</div>`

  return { subject, html }
}
