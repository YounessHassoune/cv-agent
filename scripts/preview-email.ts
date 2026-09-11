/**
 * Renders the verification email to an HTML file you can open in a browser.
 * The inline `cid:` logo has no meaning outside a mail client, so it is swapped
 * for a data URI here — the rest of the markup is exactly what Resend sends.
 *
 *   node scripts/preview-email.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { verificationHtml } from "../agent/lib/email.ts";

const out = process.argv[2] ?? "email-preview.html";
const logo = await readFile("public/logo-mark.png");

const html = verificationHtml(
  "https://example.com/api/auth/verify?token=preview",
  "Youness Hassoune",
  true,
).replace("cid:wellsuited-logo", `data:image/png;base64,${logo.toString("base64")}`);

await writeFile(out, html);
console.log(`Wrote ${out}`);
