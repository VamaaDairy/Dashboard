"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import {
  addSite, approveSignup, attendanceOn, createNotice, decideClaim, decideLeave, deleteNotice, deletePayslip, importPayslips,
  rejectSignup, removeSite, replyRequest, savePayslip, setLoginActive, teamLive, trail,
  type AttendanceRow, type TeamMember, type TrailPoint, type TrailVisit,
} from "@/lib/employee/admin";
import type { PayLine } from "@/lib/employee";

/** Signed in with edit rights on this screen - checked here as well as in the proxy, since actions are plain POSTs. */
async function gate(key: string) {
  const u = await userFromToken((await cookies()).get("session")?.value);
  if (!u || !atLeast(levelFor(u, key), "edit")) throw new Error("You can look at this page but not change it.");
  return u;
}

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(text(f, k));
const done = (path: string, err?: string | null, note?: string): never => {
  revalidatePath(path);
  const q = err ? `?err=${encodeURIComponent(err)}` : note ? `?ok=${encodeURIComponent(note)}` : "";
  redirect(`${path}${q}`);
};

// ---------------------------------------------------------------- accounts

const ACCOUNTS = "/employee-app/accounts";

export async function approveSignupAction(f: FormData) {
  await gate("emp.accounts");
  const staff = text(f, "staffUid");
  if (!staff) return done(ACCOUNTS, "Choose which employee this person is.");
  done(ACCOUNTS, await approveSignup(num(f, "id"), staff), "Account approved. They can sign in with their number now.");
}

export async function rejectSignupAction(f: FormData) {
  await gate("emp.accounts");
  await rejectSignup(num(f, "id"), text(f, "remark"));
  done(ACCOUNTS);
}

export async function toggleLoginAction(f: FormData) {
  await gate("emp.accounts");
  await setLoginActive(num(f, "id"), text(f, "active") === "1");
  done(ACCOUNTS);
}

export async function addSiteAction(f: FormData) {
  await gate("emp.accounts");
  const name = text(f, "name"), lat = num(f, "lat"), lng = num(f, "lng"), r = Math.round(num(f, "radius") || 300);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return done(ACCOUNTS, "Enter a name and the site's latitude and longitude.");
  if (r < 50 || r > 5000) return done(ACCOUNTS, "The punch radius should be between 50 and 5000 metres.");
  await addSite(name.slice(0, 80), lat, lng, r);
  done(ACCOUNTS);
}

export async function removeSiteAction(f: FormData) {
  await gate("emp.accounts");
  await removeSite(num(f, "id"));
  done(ACCOUNTS);
}

// ---------------------------------------------------------------- leave

export async function decideLeaveAction(f: FormData) {
  const u = await gate("emp.leaves");
  done("/employee-app/leaves", await decideLeave(num(f, "id"), text(f, "decision") === "approve", u.name, text(f, "remark")));
}

// ---------------------------------------------------------------- claims

export async function decideClaimAction(f: FormData) {
  const u = await gate("emp.claims");
  const action = text(f, "decision");
  if (action !== "approve" && action !== "reject" && action !== "pay") return done("/employee-app/claims", "Unknown action.");
  const amt = text(f, "amount");
  const approved = amt ? Number(amt) : null;
  if (approved !== null && (!Number.isFinite(approved) || approved <= 0)) return done("/employee-app/claims", "Enter a valid approved amount.");
  done("/employee-app/claims", await decideClaim(num(f, "id"), action, u.name, approved, text(f, "remark")));
}

// ---------------------------------------------------------------- requests

export async function replyRequestAction(f: FormData) {
  const u = await gate("emp.requests");
  const reply = text(f, "reply");
  if (!reply) return done("/employee-app/requests", "Write a reply.");
  await replyRequest(num(f, "id"), u.name, reply, text(f, "close") === "1");
  done("/employee-app/requests");
}

// ---------------------------------------------------------------- notices

const KINDS = ["notice", "urgent", "policy", "holiday", "celebration"];
const AUDIENCES = ["all", "sales", "staff"];

export async function createNoticeAction(f: FormData) {
  const u = await gate("emp.notices");
  const title = text(f, "title").slice(0, 120), body = text(f, "body").slice(0, 4000);
  const kind = text(f, "kind"), audience = text(f, "audience"), staffUid = text(f, "staffUid") || null;
  if (!title || !body) return done("/employee-app/notices", "Add a title and the message.");
  if (!KINDS.includes(kind) || !AUDIENCES.includes(audience)) return done("/employee-app/notices", "Unknown kind or audience.");
  if (audience === "staff" && !staffUid) return done("/employee-app/notices", "Choose the employee this message is for.");
  await createNotice({ title, body, kind, audience, staffUid, pinned: text(f, "pinned") === "1" }, u.name);
  done("/employee-app/notices", null, "Sent. It shows in the app straight away.");
}

export async function deleteNoticeAction(f: FormData) {
  await gate("emp.notices");
  await deleteNotice(num(f, "id"));
  done("/employee-app/notices");
}

// ---------------------------------------------------------------- salary slips

const lines = (raw: string): PayLine[] =>
  raw.split(/\r?\n/).map((l) => {
    const i = l.lastIndexOf(":");
    return i > 0 ? { label: l.slice(0, i).trim(), amount: Number(l.slice(i + 1).replace(/[₹,\s]/g, "")) } : null;
  }).filter((l): l is PayLine => !!l && !!l.label && Number.isFinite(l.amount) && l.amount !== 0);

export async function savePayslipAction(f: FormData) {
  const u = await gate("emp.payslips");
  const month = text(f, "month"), staffUid = text(f, "staffUid");
  const back = `/employee-app/payslips?month=${/^\d{4}-\d{2}$/.test(month) ? month : ""}`;
  if (!staffUid || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return done(back.split("?")[0], "Choose the employee and the month.");
  const earnings = lines(text(f, "earnings")), deductions = lines(text(f, "deductions"));
  if (!earnings.length) return done(back.split("?")[0], "Add at least one earning, one per line like  Basic: 20000");
  const dim = num(f, "daysInMonth"), dp = num(f, "daysPaid");
  await savePayslip({ staffUid, month, daysInMonth: dim > 0 ? dim : null, daysPaid: dp > 0 ? dp : null, earnings, deductions, note: text(f, "note").slice(0, 300) || null }, u.name);
  revalidatePath("/employee-app/payslips");
  redirect(`${back}&ok=${encodeURIComponent("Salary slip saved. The employee sees it in the app.")}`);
}

export async function deletePayslipAction(f: FormData) {
  await gate("emp.payslips");
  await deletePayslip(num(f, "id"));
  revalidatePath("/employee-app/payslips");
  redirect(`/employee-app/payslips?month=${text(f, "month")}`);
}

export async function importPayslipsAction(f: FormData) {
  const u = await gate("emp.payslips");
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return done("/employee-app/payslips", "Choose the CSV file.");
  if (file.size > 2_000_000) return done("/employee-app/payslips", "The file is too large.");
  const r = await importPayslips(await file.text(), u.name);
  const msg = `${r.saved} salary slip${r.saved === 1 ? "" : "s"} saved.${r.errors.length ? ` ${r.errors.length} row(s) skipped: ${r.errors.slice(0, 5).join(" ")}` : ""}`;
  done("/employee-app/payslips", r.saved === 0 ? msg : null, r.saved ? msg : undefined);
}

// ---------------------------------------------------------------- read-only data for the live screens

async function viewer(key: string) {
  const u = await userFromToken((await cookies()).get("session")?.value);
  return u && atLeast(levelFor(u, key), "view") ? u : null;
}

export async function teamSnapshot(): Promise<TeamMember[] | null> {
  return (await viewer("emp.live")) ? teamLive() : null;
}

export async function teamTrail(staffUid: string, date: string): Promise<{ points: TrailPoint[]; visits: TrailVisit[]; name: string | null } | null> {
  return (await viewer("emp.live")) ? trail(staffUid, date) : null;
}

export async function attendanceSnapshot(date: string): Promise<AttendanceRow[] | null> {
  return (await viewer("emp.attendance")) ? attendanceOn(date) : null;
}
