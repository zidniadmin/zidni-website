# Zidni Innovationz website

Static one-page site (`index.html`). No build step.

## Publish with GitHub Pages
1. Create a GitHub repository (for example `zidni-website`) and push these files to the `main` branch.
2. Repository > Settings > Pages > Source: **Deploy from a branch** > `main` / root.
3. The site is live at `https://<your-username>.github.io/zidni-website/`.
4. Custom domain `www.zidni.ae`: add a `CNAME` file containing `www.zidni.ae`, set the same domain in Settings > Pages,
   and at your domain registrar add a DNS **CNAME** record `www` pointing to `<your-username>.github.io`. Enable "Enforce HTTPS".

To update the site later, edit `index.html` and commit. GitHub redeploys within a minute or two.

## Where enquiries are stored
The page works without a back end: with no endpoint set, the form opens the visitor's email or WhatsApp.
To store enquiries in **Zoho Books**:
1. Create a Zoho API client (api-console.zoho.com, Self Client) with scope `ZohoBooks.contacts.CREATE`, and generate a refresh token.
2. Create a free Cloudflare Worker from `relay/worker.js` and add the variables listed at the top of that file.
3. In `index.html`, set `window.ZIDNI_ENQUIRY_URL="https://<your-worker>.workers.dev";` (first script tag) and commit.

Each enquiry then becomes a Contact in Zoho Books with the message in its Notes. If the relay is unreachable, the form falls back to email/WhatsApp, so no enquiry is lost.
The Zoho credentials stay in Cloudflare secrets and are never in this repository or the website.
