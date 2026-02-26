# Canva OAuth Helper (Render-ready)

Minimal Node/Express service that handles Canva's OAuth2 + PKCE flow and stores the resulting access/refresh tokens to disk. Deploy it to Render (or any Node-friendly host) to get a stable HTTPS redirect URL for your automation pipeline.

## 📂 Contents

- `server.js` – Express app with `/canva/auth`, `/canva/callback`, `/canva/tokens`
- `package.json` – declares dependencies (`express`, `node-fetch`, `dotenv`)

## 🚀 Deploy to Render

1. **Create a repo**
   ```bash
   cd ~/.openclaw/workspace/canva-oauth-service
   git init .
   git remote add origin <your_repo>
   git add .
   git commit -m "Add Canva OAuth helper"
   git push origin main
   ```

2. **Create a new Render Web Service**
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: the free tier works (Tiny)

3. **Set environment variables**
   | Key | Description |
   | --- | --- |
   | `CANVA_CLIENT_ID` | From Canva integration/app |
   | `CANVA_CLIENT_SECRET` | From Canva integration/app |
   | `CANVA_REDIRECT_URI` | `https://<render-service>.onrender.com/canva/callback` |
   | `CANVA_AUTH_URL` | `https://www.canva.com/api/oauth/authorize` |
   | `CANVA_TOKEN_URL` | `https://api.canva.com/rest/v1/oauth/token` |
   | `CANVA_SCOPES` | (optional) default `openid profile design:read design:write` |
   | `CANVA_TOKEN_PATH` | (optional) where to store token JSON (defaults to `tokens/canva-tokens.json`) |

4. **Redeploy** – once Render finishes building, it will give you a public HTTPS URL (e.g. `https://sob-canva-auth.onrender.com`). Use `https://sob-canva-auth.onrender.com/canva/callback` as the redirect URI in the Canva Developer Portal *and* in your local `.env.merch`.

5. **Run the flow**
   - Visit `https://sob-canva-auth.onrender.com/canva/auth`
   - Approve Canva's consent screen
   - The service stores tokens on its filesystem (accessible at `/canva/tokens`)

6. **Download tokens**
   - `curl https://sob-canva-auth.onrender.com/canva/tokens` to fetch the JSON (copy into `merch-automation/tokens/canva-tokens.json`).

## 📝 Notes

- Render's free tier sleeps after 15 minutes idle; wake it by visiting `/healthz` or `/canva/auth`.
- Tokens persist as long as the service's disk persists (Render retains `/data`). For long-term storage, consider wiring `CANVA_TOKEN_PATH=/data/canva-tokens.json` and enabling Render's persistent disk.
- Locally you can run `CANVA_REDIRECT_URI=http://localhost:5000/canva/callback` for testing.

Enjoy the stable redirect URL ✨
