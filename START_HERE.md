# The Daily Bloom - GitHub source export

This is the actual React/TypeScript full-stack project, including the latest two-tone Ask Bloom title. It is not a single HTML page. Open this entire folder in VS Code. The application source is unchanged from the source checkout. This export adds this guide and a checksum manifest, extends .gitignore for local secrets, and omits generated TypeScript cache.

## 1. Upload to GitHub

Create a new empty repository in your GitHub account. Do not initialize it with another README or .gitignore. Extract this ZIP first. Open the extracted The_Daily_Bloom folder in VS Code and open its terminal in that folder. Run these commands one at a time, replacing YOUR_USERNAME and YOUR_REPOSITORY with your own details:

```sh
git init
git add .
git commit -m "Add The Daily Bloom project"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Use GitHub's normal authentication when prompted; do not put access tokens into source files. If Git asks for your commit name/email, configure your own name and GitHub email first. The ZIP has no existing .git history or remote. It includes hidden configuration files: upload the entire extracted folder, not just app/ or this ZIP itself. No repository has been created or pushed for you.

## 2. Install dependencies

The project requires Node.js >=22.13.0 and specifies pnpm 11.25.0 in package.json. After installing Node.js and that pnpm version, run in the project root:

```sh
pnpm install --frozen-lockfile
```

The lockfile is pnpm-lock.yaml. Do not use npm ci: no package-lock.json is included. A clean checkout defaults to the portable execution profile, including on Windows.

## 3. Initialize a NEW local development database

Before first use, build and apply the included migration to a local-only database:

```sh
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_natural_agent_zero.sql
pnpm dev
```

Open the localhost URL printed by the development server (normally port 5173). Do not use VS Code Live Server / Go Live. Apply the migration only to a fresh local database, not repeatedly to an initialized database. The exported project includes the schema, not existing production profiles, logs or conversations. You will create a new local guest profile. See README.md for the retained framework details.

## 4. Main files to edit

- app/nutrition-app.tsx: pages, HTML-like JSX, form controls and client interactions.
- app/globals.css: colours, typography, layout and visual styling.
- components/nutrition/: branding, animation and reusable nutrition UI.
- app/api/nutrition/route.ts: server-side application and assistant API.
- app/api/guest-session/route.ts: guest session endpoint.
- lib/nutrition.ts: nutrition data and calculations.
- db/ and drizzle/: database definitions/migration.
- public/: images and icons.

## 5. Checks

```sh
node --test tests/*.test.cjs
pnpm build
node scripts/check-navigation-glass.mjs
```

## 6. Hosting and AI configuration

GitHub stores the code. GitHub Pages alone cannot run this project's Cloudflare Worker backend, D1 database or server-side AI endpoint. Uploading this source does not update the currently published Sites website. Deploying elsewhere requires a compatible runtime, your own D1 binding, database migration and deployment configuration. Hosted ChatGPT sign-in is platform-managed and will not automatically work on another host. Local portable development uses the starter's local sign-in simulation.

.openai/hosting.json is retained because the build imports it. Its project_id identifies the existing Site; it is not a credential. Do not reuse that Site identity when creating an unrelated hosted deployment. No production secrets, authentication cookies, database contents or source-repository credentials are exported.

Ask Bloom's backend is present but requires your own server-only OPENAI_API_KEY configuration for live responses. Missing AI configuration does not activate AI. See docs/ai-setup.md; never put a key in frontend code or commit it to GitHub.

Keep .env*, .dev.vars*, node_modules/, dist/, .next/, .wrangler/, .sites-runtime/, private keys and local data out of Git. Dependencies and build output are regenerated locally.
