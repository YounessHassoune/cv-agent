/**
 * Self-check for the draft comparison that makes `compile_pdf` idempotent.
 * `node agent/lib/variants.test.ts`. If this breaks, a repeat compile either
 * spends a revision it should not, or reuses a draft that actually changed.
 */
import assert from "node:assert/strict";
import { sameCv } from "./variants.ts";

// Key order differs between the stored copy (JSON) and the incoming one (Zod).
assert.ok(sameCv({ a: 1, b: [2, 3] }, { b: [2, 3], a: 1 }));
assert.ok(sameCv({ x: { p: "1", q: [] } }, { x: { q: [], p: "1" } }));

// An absent key and an explicitly undefined one are the same document.
assert.ok(sameCv({ a: 1 }, { a: 1, b: undefined }));

// Real differences must still register.
assert.ok(!sameCv({ a: 1 }, { a: 2 }));
assert.ok(!sameCv({ bullets: ["x", "y"] }, { bullets: ["y", "x"] }), "order matters in arrays");
assert.ok(!sameCv({ a: 1 }, { a: "1" }), "1 is not \"1\"");
assert.ok(!sameCv({ a: 1 }, { a: 1, b: 2 }));
assert.ok(!sameCv({ end: "" }, { end: "Mar 2024" }));

console.log("variants: all checks passed");
