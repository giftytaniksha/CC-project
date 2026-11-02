#!/usr/bin/env node
/** Local Gemini smoke test (reads GEMINI_API_KEY from project .dev.vars). */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const devVars = readFileSync(path.join(root, ".dev.vars"), "utf8");
const key = devVars
  .split("\n")
  .map((l) => l.trim())
  .find((l) => l.startsWith("GEMINI_API_KEY="))
  ?.slice("GEMINI_API_KEY=".length)
  .trim();
if (!key) {
  console.error("No GEMINI_API_KEY in .dev.vars");
  process.exit(1);
}

const model =
  devVars
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("GEMINI_MODEL="))
    ?.slice("GEMINI_MODEL=".length)
    .trim() || "gemini-3.8-flash";

async function call(label, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  console.log(`\n=== ${label} ===`);
  console.log("status", r.status);
  console.log(text.slice(0, 500));
}

await call("minimal (Studio curl shape)", {
  contents: [{ parts: [{ text: "Say hi in 3 words" }] }],
  generationConfig: { maxOutputTokens: 20 },
});

await call("app shape (systemInstruction + user)", {
  systemInstruction: { parts: [{ text: "You are a helpful nutrition assistant." }] },
  contents: [{ role: "user", parts: [{ text: "One sentence tip for drinking water." }] }],
  generationConfig: { maxOutputTokens: 100, temperature: 0.6 },
});
