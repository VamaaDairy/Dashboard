import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { query } from "@/lib/db";
import { DEBTORS_ROOT, fetchLedgerVouchers, getTree } from "./tally";
import { sendMail } from "./graph";
import { getRecipient, getRecipients, getSettings, lastLiveSent } from "./store";
import { LOGO_CONTENT_ID, renderStatementEmail } from "./template";

/** Read once per server process; the file never changes at runtime. */
let logo: string | null = null;
const logoBase64 = () => (logo ??= readFileSync(join(process.cwd(), "src/lib/outstandings/assets/logo.jpg")).toString("base64"));

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** An inclusive statement period of calendar dates. */
export interface DateRange { from: Date; to: Date }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function parseRange(from: string, to: string): DateRange {
  if (!ISO.test(from) || !ISO.test(to)) throw new Error("Pick the statement dates.");
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const r = { from: new Date(fy, fm - 1, fd), to: new Date(ty, tm - 1, td) };
  if (r.from > r.to) throw new Error("The 'from' date is after the 'to' date.");
  return r;
}

export interface Debtor {
  name: string;
  /** debit-positive: what the party owes */
  balance: number;
  tallyEmail: string;
  /** the address a statement would actually go to, if one was set here */
  recipientEmail: string | null;
  /** when a live statement last went to this party */
  lastSent: string | null;
}

/** Every party under Sundry Debtors, at any depth, that currently owes money - biggest first. */
export async function outstandingDebtors(force = false): Promise<Debtor[]> {
  const [tree, recipients, sent] = await Promise.all([getTree(force), getRecipients(), lastLiveSent()]);
  return tree.ledgers
    .filter((l) => l.balance > 0)
    .map((l) => ({
      name: l.name, balance: l.balance, tallyEmail: l.email,
      recipientEmail: recipients.get(l.name) ?? null, lastSent: sent.get(l.name)?.toISOString() ?? null,
    }))
    .sort((a, b) => b.balance - a.balance);
}

async function ledgerBalance(name: string): Promise<number> {
  const l = (await getTree()).ledgers.find((x) => x.name === name);
  if (!l) throw new Error(`No ledger found for "${name}" under ${DEBTORS_ROOT}. Refresh from Tally first.`);
  return l.balance;
}

export interface Statement { subject: string; html: string }

export async function buildStatement(ledgerName: string, range?: DateRange): Promise<Statement> {
  const balance = await ledgerBalance(ledgerName);
  const now = new Date();
  // default window: the trailing 30 days
  const from = range?.from ?? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const to = range?.to ?? now;
  const vouchers = await fetchLedgerVouchers(ledgerName, from, to);
  return renderStatementEmail({ name: ledgerName, balance }, vouchers, {
    periodLabel: `${fmt(from)} – ${fmt(to)}`, fromLabel: fmt(from), asOfLabel: fmt(now),
  });
}

export interface ResolvedRecipient {
  /** the party's own recipient, if any */
  intended: string | null;
  /** who it is delivered to - the same, unless test mode redirects it */
  actual: string;
  testMode: boolean;
}

/**
 * The one place that decides where a send goes. In test mode everything goes to the test recipient;
 * otherwise a party with no recipient is refused rather than guessed at.
 */
export async function resolveRecipient(ledgerName: string): Promise<ResolvedRecipient> {
  const [settings, recipient] = await Promise.all([getSettings(), getRecipient(ledgerName)]);
  if (settings.testMode) return { intended: recipient, actual: settings.testRecipientEmail, testMode: true };
  if (!recipient) throw new Error(`No recipient email set for "${ledgerName}". Set one on the Statements page before sending live.`);
  return { intended: recipient, actual: recipient, testMode: false };
}

async function logAttempt(ledgerName: string, r: ResolvedRecipient | null, status: "sent" | "failed", error: string | null) {
  await query(
    `insert into os_email_log (ledger_name, intended_recipient, actual_recipient, test_mode, status, error)
     values ($1, $2, $3, $4, $5, $6)`,
    [ledgerName, r?.intended ?? "", r?.actual ?? "", r?.testMode ?? false, status, error],
  );
}

export interface SendResult {
  ledgerName: string;
  success: boolean;
  intendedRecipient?: string | null;
  actualRecipient?: string;
  testMode?: boolean;
  error?: string;
}

/** Builds, addresses, sends and logs one party's statement. Never throws. */
export async function sendStatement(ledgerName: string, range?: DateRange): Promise<SendResult> {
  let recipient: ResolvedRecipient | null = null;
  try {
    // addressed first: a party with no email is refused before any Tally round-trip
    recipient = await resolveRecipient(ledgerName);
    const statement = await buildStatement(ledgerName, range);
    await sendMail({
      to: recipient.actual,
      subject: statement.subject,
      html: statement.html,
      inlineImages: [{ name: "logo.jpg", contentType: "image/jpeg", contentBytes: logoBase64(), contentId: LOGO_CONTENT_ID }],
    });
    await logAttempt(ledgerName, recipient, "sent", null);
    return { ledgerName, success: true, intendedRecipient: recipient.intended, actualRecipient: recipient.actual, testMode: recipient.testMode };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logAttempt(ledgerName, recipient, "failed", message).catch(() => undefined);
    return { ledgerName, success: false, error: message };
  }
}

/** Sends to every listed party, a few at a time; one party's failure never stops the rest. */
export async function sendStatementsBulk(ledgerNames: string[], range?: DateRange): Promise<SendResult[]> {
  const results: SendResult[] = new Array(ledgerNames.length);
  let next = 0;
  async function worker() {
    for (let i = next++; i < ledgerNames.length; i = next++) results[i] = await sendStatement(ledgerNames[i], range);
  }
  await Promise.all(Array.from({ length: Math.min(3, ledgerNames.length) }, worker));
  return results;
}
