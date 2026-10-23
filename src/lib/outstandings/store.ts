import "server-only";
import { one, query } from "@/lib/db";

export interface OsSettings {
  testMode: boolean;
  testRecipientEmail: string;
}

/** Singleton row (id 1), created by the migration with test mode ON. */
export async function getSettings(): Promise<OsSettings> {
  const r = await one<{ test_mode: boolean; test_recipient_email: string }>(`select test_mode, test_recipient_email from os_setting where id = 1`);
  return { testMode: r?.test_mode ?? true, testRecipientEmail: r?.test_recipient_email ?? "darshan@vamaadairy.com" };
}

export async function setTestMode(testMode: boolean) {
  await query(`update os_setting set test_mode = $1 where id = 1`, [testMode]);
}

export async function setRecipient(ledgerName: string, email: string) {
  const e = email.trim();
  if (!e) throw new Error("Recipient email cannot be empty.");
  await query(
    `insert into os_recipient (ledger_name, email) values ($1, $2)
     on conflict (ledger_name) do update set email = excluded.email, updated_at = now()`,
    [ledgerName, e],
  );
}

export async function getRecipient(ledgerName: string): Promise<string | null> {
  return (await one<{ email: string }>(`select email from os_recipient where ledger_name = $1`, [ledgerName]))?.email ?? null;
}

export async function getRecipients(): Promise<Map<string, string>> {
  const rows = await query<{ ledger_name: string; email: string }>(`select ledger_name, email from os_recipient`);
  return new Map(rows.map((r) => [r.ledger_name, r.email]));
}

/** When each party last had a live (not test-mode) statement sent. */
export async function lastLiveSent(): Promise<Map<string, Date>> {
  const rows = await query<{ ledger_name: string; at: Date }>(
    `select ledger_name, max(sent_at) as at from os_email_log where status = 'sent' and not test_mode group by ledger_name`,
  );
  return new Map(rows.map((r) => [r.ledger_name, r.at]));
}
