// Zidni Innovationz - enquiry relay (Cloudflare Worker)
// Receives the website form, stores it as a Contact in Zoho Books, and notifies by email.
// Credentials live only in Worker secrets; nothing secret is ever placed in the website.
//
// Secrets / variables to set in Cloudflare (Workers > Settings > Variables):
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN   (secrets)
//   ZOHO_ORG_ID        Zoho Books organization id
//   ZOHO_DC            data centre suffix of your Zoho account: "com", "ae", "eu", "in", ...
//   ALLOWED_ORIGIN     e.g. https://www.zidni.ae  (comma-separate to allow more, e.g. the github.io address)
//   NOTIFY_WEBHOOK     optional: a webhook URL (Zoho Flow / Make / Slack) that sends the alert email

const j = (o, s, h) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...h } });

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim());
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return j({ ok: false }, 405, cors);
    if (!allowed.includes(origin)) return j({ ok: false, error: "origin" }, 403, cors);

    let d;
    try { d = await req.json(); } catch { return j({ ok: false, error: "json" }, 400, cors); }
    if (d.hp) return j({ ok: true }, 200, cors);                       // honeypot: silently drop bots
    const clean = (v, n) => String(v || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
    const e = {
      name: clean(d.name, 120), company: clean(d.company, 160), email: clean(d.email, 160),
      phone: clean(d.phone, 40), service: clean(d.service, 120), message: clean(d.message, 2000)
    };
    if (!e.name || !/^\S+@\S+\.\S+$/.test(e.email) || !e.message) return j({ ok: false, error: "invalid" }, 400, cors);

    // 1. access token from the stored refresh token
    const dc = env.ZOHO_DC || "com";
    const tok = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
      method: "POST",
      body: new URLSearchParams({
        refresh_token: env.ZOHO_REFRESH_TOKEN, client_id: env.ZOHO_CLIENT_ID,
        client_secret: env.ZOHO_CLIENT_SECRET, grant_type: "refresh_token"
      })
    }).then(r => r.json());
    if (!tok.access_token) return j({ ok: false, error: "auth" }, 502, cors);

    // 2. create the Contact in Zoho Books
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const body = {
      contact_name: e.company || e.name,
      company_name: e.company,
      contact_type: "customer",
      notes: `WEBSITE ENQUIRY ${stamp} UTC\nService: ${e.service}\n\n${e.message}`,
      contact_persons: [{ first_name: e.name, email: e.email, phone: e.phone, is_primary_contact: true }]
    };
    const r = await fetch(`https://www.zohoapis.${dc}/books/v3/contacts?organization_id=${env.ZOHO_ORG_ID}`, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${tok.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || out.code !== 0) return j({ ok: false, error: "books" }, 502, cors);

    // 3. optional alert (Zoho Flow / Make / Slack webhook)
    if (env.NOTIFY_WEBHOOK) {
      await fetch(env.NOTIFY_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...e, stamp }) }).catch(() => {});
    }
    return j({ ok: true }, 200, cors);
  }
};
