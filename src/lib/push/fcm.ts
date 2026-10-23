import "server-only";
import { readFileSync } from "node:fs";
import { importPKCS8, SignJWT } from "jose";

/**
 * Firebase Cloud Messaging over its HTTP v1 API. Credentials are a Firebase service account
 * (Firebase console > Project settings > Service accounts > Generate new private key), given as
 * either FIREBASE_SERVICE_ACCOUNT (the JSON, or the JSON base64-encoded) or
 * FIREBASE_SERVICE_ACCOUNT_FILE (path to the downloaded .json). Without them nothing is sent.
 */

interface Account { project_id: string; client_email: string; private_key: string; token_uri?: string }

let account: Account | null | undefined;

function loadAccount(): Account | null {
  if (account !== undefined) return account;
  account = null;
  try {
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim();
    const raw = inline ? (inline.startsWith("{") ? inline : Buffer.from(inline, "base64").toString("utf8")) : file ? readFileSync(file, "utf8") : null;
    if (raw) {
      const j = JSON.parse(raw) as Account;
      if (j.project_id && j.client_email && j.private_key) account = j;
    }
  } catch (e) {
    console.error("[push] could not read the Firebase service account:", e);
  }
  return account;
}

export const pushConfigured = () => loadAccount() !== null;

let cached: { token: string; expires: number } | null = null;

async function accessToken(a: Account): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const uri = a.token_uri ?? "https://oauth2.googleapis.com/token";
  const key = await importPKCS8(a.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(a.client_email)
    .setSubject(a.client_email)
    .setAudience(uri)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const res = await fetch(uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(`Google token request failed: ${j.error_description ?? res.status}`);
  cached = { token: j.access_token, expires: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Extra values the app receives with the notification (e.g. orderKey). */
  data?: Record<string, string>;
}

/** "sent", "gone" (this token is dead and should be forgotten) or "failed". */
export type SendResult = "sent" | "gone" | "failed";

/** Sends to one phone token, or - with `topic` - to every phone subscribed to it. */
export async function sendPush(target: { token: string } | { topic: string }, m: PushMessage): Promise<SendResult> {
  const a = loadAccount();
  if (!a) return "failed";
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${await accessToken(a)}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          ...target,
          notification: { title: m.title, body: m.body },
          data: m.data ?? {},
          android: { priority: "HIGH", notification: { channel_id: "gaia_default" } },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
    });
    if (res.ok) return "sent";
    const err = (await res.json().catch(() => null)) as { error?: { status?: string; message?: string } } | null;
    console.error("[push] FCM refused:", res.status, err?.error?.status, err?.error?.message);
    return res.status === 404 || err?.error?.status === "UNREGISTERED" ? "gone" : "failed";
  } catch (e) {
    console.error("[push] send failed:", e);
    return "failed";
  }
}
