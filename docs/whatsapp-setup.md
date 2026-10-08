# WhatsApp shop – setup (test mode)

Customers chat, browse, order, pay and review on WhatsApp. A Groq-hosted model replies;
everything shows in the dashboard under **WhatsApp shop** (Chats, Orders, Catalog & setup, Reviews).
Products come **only** from your Meta/WhatsApp catalog.

## 1. Meta app + test number (developers.facebook.com)
1. **My Apps → Create app → Business**, then add the **WhatsApp** product.
2. **WhatsApp → API Setup** gives you a free test number. Copy:
   - **Phone number ID** → `WA_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID** → `WA_BUSINESS_ACCOUNT_ID`
   - **Temporary access token** → `WA_ACCESS_TOKEN` (expires in 24 h. For a long-lived one:
     business.facebook.com → Settings → System users → Add → assign the app and WABA →
     Generate token with `whatsapp_business_messaging`, `whatsapp_business_management`, `catalog_management`)
3. In **To**, add and verify up to 5 phone numbers. Only these can chat with a test number.
4. **App settings → Basic → App secret** → `WA_APP_SECRET`

## 2. Catalog (the product source)
1. business.facebook.com → **Commerce Manager → Create catalog (E-commerce)** → add products
   (name, price, image, content ID / SKU, availability).
2. **WhatsApp Manager → Catalog** → connect that catalog to your WABA. Turn on *Show catalog* and *Cart*.
3. Optional: set `WA_CATALOG_ID` to that catalog's ID. If you leave it empty, the app finds the connected catalog.
4. Dashboard → **Catalog & setup → Sync from WhatsApp catalog**. The assistant also re-syncs every 30 min.

## 3. Groq
console.groq.com/keys → `GROQ_API_KEY`. The default model is `openai/gpt-oss-120b`. You can set `GROQ_MODEL=llama-3.3-70b-versatile` instead.

## 4. Payments
- **Simplest:** set `SHOP_UPI_ID`. The customer gets UPI details and sends a screenshot. The screenshot is attached
  to the order as "check proof", and you press **Mark paid**.
- **Automatic:** set Razorpay **test** keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`). The customer gets a payment link.
  In Razorpay → Webhooks, add `https://<public-url>/api/payments/razorpay` with event `payment_link.paid`
  and a secret (`RAZORPAY_WEBHOOK_SECRET`). The order is marked paid automatically.
- Cash on delivery is on unless `SHOP_COD_ENABLED=false`.

## 5. Public URL for the webhook
Meta must reach your laptop over HTTPS. Install a tunnel and run it next to `npm run dev`:

```
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```

Copy the `https://….trycloudflare.com` URL it prints (it changes on every run), then:
Meta app → **WhatsApp → Configuration → Webhook → Edit**
- Callback URL: `https://<that-url>/api/whatsapp/webhook`
- Verify token: the same value as `WA_VERIFY_TOKEN` (any secret string you choose)
- **Verify and save**, then under Webhook fields **Subscribe** to `messages`.

## 6. Try it
From a verified phone, message the test number "hi". The reply appears on the phone, and the chat shows up live in
**WhatsApp shop → Chats**. Ask for products, send a cart from the catalog, give an address, choose UPI/COD.
The order then appears in **Orders**. Mark it Delivered and the customer gets a ⭐ rating request.

## Notes
- **24-hour rule:** free-form messages (including status updates) are delivered only within 24 h of the customer's
  last message. Outside that window, WhatsApp requires pre-approved templates, and the chat shows a warning.
- **Taking over a chat:** press **AI replying** in a chat to switch it to *You're handling*. The bot also hands
  off by itself on complaints, refunds and requests for a person. Those chats are flagged red.
- The model has no vision. Photos are stored and shown to you, and the bot is told only that a photo arrived.
