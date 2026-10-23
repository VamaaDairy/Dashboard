"use server";

import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { fetchLedgerVouchers, type LedgerVoucher } from "@/lib/outstandings/tally";
import { getRecipient, getSettings, setRecipient, setTestMode, type OsSettings } from "@/lib/outstandings/store";
import { outstandingDebtors, parseRange, sendStatement, sendStatementsBulk, type SendResult } from "@/lib/outstandings/statement";

type Fail = { ok: false; error: string };

/** Sending mail and changing recipients needs edit access to Outstandings. */
async function actor() {
  const me = await userFromToken((await cookies()).get("session")?.value);
  return me && atLeast(levelFor(me, "outstandings"), "edit") ? me : null;
}
const denied: Fail = { ok: false, error: "You do not have permission to do this." };
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function saveRecipient(ledgerName: string, email: string): Promise<{ ok: true } | Fail> {
  if (!(await actor())) return denied;
  try {
    if (!ledgerName) throw new Error("ledgerName is required.");
    await setRecipient(ledgerName, email);
    return { ok: true };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function sendOne(ledgerName: string, from: string, to: string): Promise<{ ok: true; result: SendResult } | Fail> {
  if (!(await actor())) return denied;
  try {
    return { ok: true, result: await sendStatement(ledgerName, parseRange(from, to)) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function sendMany(ledgerNames: string[], from: string, to: string): Promise<{ ok: true; results: SendResult[] } | Fail> {
  if (!(await actor())) return denied;
  try {
    const names = [...new Set(ledgerNames.map((n) => n.trim()).filter(Boolean))];
    if (names.length === 0) throw new Error("Pick at least one party.");
    return { ok: true, results: await sendStatementsBulk(names, parseRange(from, to)) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function changeTestMode(testMode: boolean): Promise<{ ok: true; settings: OsSettings } | Fail> {
  if (!(await actor())) return denied;
  try {
    await setTestMode(testMode);
    return { ok: true, settings: await getSettings() };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export interface PartyLedger {
  name: string;
  balance: number;
  tallyEmail: string;
  recipientEmail: string | null;
  vouchers: LedgerVoucher[];
}

/** A party's balance and its Tally ledger lines for the period. */
export async function loadPartyLedger(name: string, from: string, to: string): Promise<{ ok: true; ledger: PartyLedger } | Fail> {
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "outstandings"), "view")) return denied;
  try {
    const range = parseRange(from, to);
    const party = (await outstandingDebtors()).find((d) => d.name === name);
    if (!party) throw new Error(`No outstanding party "${name}". Refresh from Tally first.`);
    const [vouchers, recipientEmail] = await Promise.all([fetchLedgerVouchers(name, range.from, range.to), getRecipient(name)]);
    return { ok: true, ledger: { name, balance: party.balance, tallyEmail: party.tallyEmail, recipientEmail, vouchers } };
  } catch (e) { return { ok: false, error: msg(e) }; }
}
