import "server-only";
/**
 * lib/outstandings/graph.ts
 *
 * Sends mail through Microsoft Graph (application permission `Mail.Send`,
 * client-credentials OAuth2) as the accounts@vamaadairy.com mailbox. Chosen
 * over SMTP so this doesn't depend on Microsoft's legacy basic-auth SMTP
 * path, which tenants are increasingly disabling.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is missing. Set GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET / GRAPH_SENDER_EMAIL in .env.`,
    )
  }
  return value
}

export class GraphError extends Error {}

let cachedToken: { value: string; expiresAt: number } | null = null

async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const tenantId = requireEnv("GRAPH_TENANT_ID")
  const clientId = requireEnv("GRAPH_CLIENT_ID")
  const clientSecret = requireEnv("GRAPH_CLIENT_SECRET")

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.access_token) {
    const detail = body?.error_description || body?.error || `HTTP ${res.status}`
    throw new GraphError(`Could not get a Microsoft Graph token: ${detail}`)
  }

  cachedToken = {
    value: body.access_token as string,
    expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000,
  }
  return cachedToken.value
}

export interface InlineImageAttachment {
  name: string
  contentType: string
  /** Base64-encoded file bytes. */
  contentBytes: string
  /** Referenced from the HTML body as `cid:<contentId>`. */
  contentId: string
}

export async function sendMail({
  to,
  subject,
  html,
  inlineImages,
}: {
  to: string
  subject: string
  html: string
  inlineImages?: InlineImageAttachment[]
}): Promise<void> {
  const senderEmail = requireEnv("GRAPH_SENDER_EMAIL")
  const token = await getGraphToken()

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
          attachments: inlineImages?.map((img) => ({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: img.name,
            contentType: img.contentType,
            contentBytes: img.contentBytes,
            contentId: img.contentId,
            isInline: true,
          })),
        },
      }),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new GraphError(`Graph sendMail failed (HTTP ${res.status}): ${detail}`)
  }
}
