# Nourish AI configuration (Google Gemini)

The app calls the Gemini REST API directly from this server (`POST /api/nutrition` with action `chat`, `review`, `recommend`, `planAI` or `estimateFood`). The browser sends the visitor's saved data along with the request; the backend builds nutrition context from it, then calls `generativelanguage.googleapis.com`. The server stores nothing, so there is no database. The browser never calls Gemini directly, and the key never reaches it.

This is a plain server-to-API call, not an MCP (Model Context Protocol) connection. MCP connects an *editor or agent* (like Cursor) to external tools; it is not how a deployed web app talks to an LLM provider at runtime. A hosted site has no MCP client running, so there is nothing for an MCP server to connect to here. The REST call below is the correct approach for this app.

Gemini has a free tier. Create a key in Google AI Studio (https://aistudio.google.com/apikey) and use it as shown below.

## What uses Gemini

- **Ask Bloom chat and weekly review** — short JSON replies (one `reply` field, or three review sections) formatted for display on the server.
- **Daily tip** (`recommend`) — JSON with `breakfast`, `lunch`, `dinner`, and `tip`; the server formats the card (no free-form parsing).
- **AI planner** (`planAI`) — a day or week of meals aimed at the profile's calorie and protein target, not limited to the built-in food list.
- **Custom food estimate** (`estimateFood`) — fills in calories/protein/carbs/fat/fiber for a food the visitor types, for them to review before adding it.

All four fail the same way if the key is missing or rejected, and none of them ever send the key to the browser.

## Configuration

| Variable | Required | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Your Gemini API key. Server-only. |
| `GEMINI_MODEL` | No | Defaults to **`gemini-3.8-flash`** (Google’s current flash model). See [Choosing a model](#choosing-a-model-speed-vs-quality) below. |
| `GEMINI_TIMEOUT_MS` | No | Max wait for one Gemini call (default **120000** = 2 min). Raise up to **180000** on slow networks; restart after changing. |

### Choosing a model (speed vs quality)

Ask Bloom only talks to **Google Gemini** today (same API key). Pick the model with `GEMINI_MODEL` in `.dev.vars` — no code changes.

Google has **retired `gemini-2.0-flash`** for new API calls; use **3.8 flash** or a Studio alias.

| Model | Good for | Notes |
| --- | --- | --- |
| **`gemini-3.8-flash`** (default) | Tips, chat, estimates, planner | Main flash model; app disables extra “thinking” tokens for speed |
| **`gemini-3.5-flash-lite`** | Same tasks when 3.8 is busy | Google’s current **lite** model; uses OpenAPI-style JSON schema in API calls |
| **`gemini-flash-latest`** | Studio alias | Often points at the newest flash |

Example `.dev.vars`:

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.8-flash
```

If responses are still slow, the bottleneck is usually **network latency to Google** (try another Wi‑Fi, turn off VPN) or **free-tier queueing**.

Using **OpenAI, Groq, etc.** would need a different API integration; this project is built for Gemini only.

### Local development

Create `.dev.vars` in the project root (it is gitignored):

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.8-flash
# GEMINI_TIMEOUT_MS=180000
```

Restart the dev server after changing it. The dev server uses `dist/server/wrangler.json`; on start, the root `.dev.vars` is copied there automatically so Wrangler can load your secrets.

Use the API key from [Google AI Studio](https://aistudio.google.com/apikey). Newer keys may start with `AIza` or `AQ.` — paste the exact value from Studio’s “curl” example.

### Hosted (Cloudflare)

Store the key as a secret so it is never in source control:

```
npx wrangler secret put GEMINI_API_KEY
```

Optionally set `GEMINI_MODEL` the same way. Redeploy after changing secrets.

## Behavior

- Prompts send a **compact** profile context and require **JSON schema** responses. On fast networks answers arrive in a few seconds; slow routes to Google may need the full **120s** default (or more via `GEMINI_TIMEOUT_MS`).
- Missing or invalid key: HTTP 503 with `AI_CONFIGURATION_ERROR`.
- Rate limit (free-tier quota): HTTP 429 with `AI_RATE_LIMITED`.
- Google **model overload** (503 “high demand”): HTTP 503 with `AI_OVERLOADED` — wait and retry, or try `GEMINI_MODEL=gemini-3.5-flash-lite` in `.dev.vars`.
- Provider, network, or timeout failures return sanitized errors (502 / 504).
- Blocked or empty responses return `AI_BLOCKED` / `AI_EMPTY_RESPONSE`.
- Failed calls do not save fake assistant replies. The other nutrition tools keep working without a key.
- The Daily tip (`recommend`) is saved in the browser's data for that day, so it does not call Gemini on every page load.
- Any reply, tip or plan that names something listed under allergies, intolerances or dislikes is rejected with `AI_EXCLUDED_FOOD` and not saved — a server-side check on top of asking the model to avoid it.
- Visitor data is kept in this browser's `localStorage` only. Ending the session deletes it. The server validates each request and rejects data it cannot read.

## Verification

1. Open the AI Assistant page and send a nutrition question.
2. Confirm the browser makes a same-origin `/api/nutrition` request with no Gemini key in it.
3. Confirm a reply appears and stays in the conversation after reload.
4. Remove the key and confirm a clear error appears and the draft is preserved for retry.

Tests run with `node --test tests/*.test.cjs`. They mock the Gemini responses and use a saved-state fixture (the same shape the browser stores), so they do not prove a live key works.
