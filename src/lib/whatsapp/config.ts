import "server-only";

/** Everything the WhatsApp shop reads from the environment, in one place. */
export const wa = {
  graphVersion: process.env.WA_GRAPH_VERSION || "v25.0",
  token: process.env.WA_ACCESS_TOKEN ?? "",
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID ?? "",
  wabaId: process.env.WA_BUSINESS_ACCOUNT_ID ?? "",
  catalogId: process.env.WA_CATALOG_ID ?? "",
  verifyToken: process.env.WA_VERIFY_TOKEN ?? "",
  appSecret: process.env.WA_APP_SECRET ?? "",
};

export const groq = {
  apiKey: process.env.GROQ_API_KEY ?? "",
  model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  /** Used when the main model hits its per-minute limit. Each Groq model has its own quota. */
  fallbackModel: process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b",
};

export const shop = {
  name: process.env.SHOP_NAME || "Vamaa Dairy",
  /** Free text the assistant may quote: timings, delivery area, return policy... */
  info: process.env.SHOP_INFO ?? "",
  deliveryFee: Number(process.env.SHOP_DELIVERY_FEE || 0),
  freeDeliveryAbove: Number(process.env.SHOP_FREE_DELIVERY_ABOVE || 0),
  codEnabled: (process.env.SHOP_COD_ENABLED ?? "true") !== "false",
  upiId: process.env.SHOP_UPI_ID ?? "",
  upiName: process.env.SHOP_UPI_NAME || process.env.SHOP_NAME || "Vamaa Dairy",
};

export const razorpay = {
  keyId: process.env.RAZORPAY_KEY_ID ?? "",
  keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
};

/** What's set and what isn't - shown on the setup page, never the values. */
export function configStatus() {
  return {
    whatsapp: !!(wa.token && wa.phoneNumberId),
    verifyToken: !!wa.verifyToken,
    appSecret: !!wa.appSecret,
    catalog: !!(wa.catalogId || wa.wabaId),
    groq: !!groq.apiKey,
    groqModel: groq.model,
    upi: !!shop.upiId,
    razorpay: !!(razorpay.keyId && razorpay.keySecret),
    razorpayWebhook: !!razorpay.webhookSecret,
    cod: shop.codEnabled,
  };
}
