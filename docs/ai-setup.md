# Nourish AI configuration

The existing assistant sends questions to `POST /api/nutrition` with action `chat` (or `review`). That backend authenticates the current visitor, builds nutrition context from the visitor's saved profile and records, then calls the OpenAI Responses API. The browser never calls OpenAI directly.

## Required hosted configuration

| Runtime variable | Required | Configuration |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Store a valid OpenAI API credential as a **secret** in this Site's runtime environment. |
| `OPENAI_MODEL` | No | Model available to the configured OpenAI project. The existing default is `gpt-4.1-mini`. |

Use the OpenAI Developers plugin's `openai-platform-api-key` workflow for secure key setup, then configure `OPENAI_API_KEY` through Sites runtime environment configuration with `is_secret: true`. Publish the Site after configuring the secret so the deployment uses the updated environment revision.

The backend reads `env.OPENAI_API_KEY` and `env.OPENAI_MODEL` from `cloudflare:workers`. Hosted secrets are runtime bindings, not build-time frontend variables. Do not put key values in source files, `.openai/hosting.json`, public assets, a `VITE_*`/`NEXT_PUBLIC_*` variable, or chat messages. Local `.env*` files are ignored by Git; they are not deployed as a substitute for hosted secret configuration.

No schema, guest-session, or food-calculation changes are needed for activation. Missing configuration returns HTTP 503; provider, authentication, rate-limit, and timeout failures return sanitized errors. Failed calls do not save fake assistant replies. The other nutrition tools remain available.

## Verification after configuring the secret

1. Open the existing AI Assistant page and send a nutrition question.
2. Confirm the browser makes a same-origin `/api/nutrition` request without an OpenAI Authorization header or key.
3. Confirm loading clears, a reply appears in the selected conversation, and that conversation remains after reload.
4. Check an unavailable-provider case displays an error and preserves the draft for Retry.

Automated tests run with `node --test tests/nourish-fixes.test.cjs`. They use an in-memory database and mocked OpenAI responses. They do not prove that a production key has been configured or that a live OpenAI request succeeded.
