import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email over plain SMTP, so any provider works. Recommended free one: Brevo
 * (300 emails/day free, no domain needed - verify a single sender address):
 *   SMTP_HOST=smtp-relay.brevo.com  SMTP_PORT=587  SMTP_USER=<login shown in Brevo>  SMTP_PASS=<SMTP key>
 *   MAIL_FROM="Gaia <you@yourdomain.com>"   (must be the verified sender)
 * Gmail also works (500/day): smtp.gmail.com, port 587, an app password as SMTP_PASS.
 */
let transport: Transporter | null = null;

export const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  if (!mailConfigured()) throw new Error("Email is not set up: add SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM.");
  const port = Number(process.env.SMTP_PORT ?? 587);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
}
