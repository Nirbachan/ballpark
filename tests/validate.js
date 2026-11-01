// Measures Ballpark against salaries you know. Run: node tests/validate.js [file.csv]
const fs = require("fs");
const path = require("path");
global.window = {};
require(path.join(__dirname, "../src/data.js"));
require(path.join(__dirname, "../src/engine.js"));
const E = window.Ballpark.engine;
const D = window.Ballpark.DATA;

const file = process.argv[2] || path.join(__dirname, "validation.csv");
const TARGET_HIT = 0.7, MAX_MISS = 2;

function parseCSV(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const cells = [];
    let cur = "", q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { cells.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] || ""])));
}

function parseAmount(s) {
  const m = String(s).replace(/[,₹$€£\s]/g, "").match(/^([\d.]+)(l|lakh|lakhs|cr|crore|k|m)?$/i);
  if (!m) return NaN;
  const n = parseFloat(m[1]), u = (m[2] || "").toLowerCase();
  return n * ({ l: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, k: 1e3, m: 1e6 }[u] || 1);
}

const rows = parseCSV(fs.readFileSync(file, "utf8"));
const results = [];
for (const r of rows) {
  const actual = parseAmount(r.actual);
  if (!r.title || !actual) continue;
  const est = E.estimate({ kind: r.kind || "job", title: r.title, company: r.company, location: r.location });
  if (!est.enough) { results.push({ r, skipped: est.reason }); continue; }
  const mid = (est.low + est.high) / 2;
  results.push({
    r, est, actual,
    hit: actual >= est.low && actual <= est.high,
    ratio: mid / actual,
    range: E.fmtRange(est.currency, est.low, est.high)
  });
}

const scored = results.filter((x) => !x.skipped);
const skipped = results.filter((x) => x.skipped);
if (!scored.length) {
  console.log(`No usable rows in ${path.relative(process.cwd(), file)}.`);
  console.log("Add salaries you know (see the header comments in the file), then run this again.");
  process.exit(0);
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "–");
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const hits = scored.filter((x) => x.hit).length;
const errs = scored.map((x) => Math.abs(x.ratio - 1));
const logBias = median(scored.map((x) => Math.log(x.ratio)));
const worst = Math.max(...scored.map((x) => Math.max(x.ratio, 1 / x.ratio)));

function group(key, label) {
  const g = {};
  for (const x of scored) (g[key(x)] = g[key(x)] || []).push(x);
  console.log(`\nBy ${label}`);
  for (const [k, xs] of Object.entries(g)) {
    const h = xs.filter((x) => x.hit).length;
    console.log(`  ${String(k).padEnd(22)} ${String(xs.length).padStart(3)} tested   ${pct(h, xs.length).padStart(4)} inside range`);
  }
  return g;
}

console.log(`Ballpark validation: ${scored.length} salaries scored, ${skipped.length} skipped (not enough signal)\n`);
console.log(`Inside range     ${pct(hits, scored.length)}   target ${TARGET_HIT * 100}%   ${hits / scored.length >= TARGET_HIT ? "PASS" : "FAIL"}`);
console.log(`Worst miss       ${worst.toFixed(2)}x   limit ${MAX_MISS}x   ${worst <= MAX_MISS ? "PASS" : "FAIL"}`);
console.log(`Median error     ${Math.round(median(errs) * 100)}% from the midpoint`);
console.log(`Bias             ${Math.abs(logBias) < 0.05 ? "none" : logBias > 0 ? "runs high by " + Math.round((Math.exp(logBias) - 1) * 100) + "%" : "runs low by " + Math.round((1 - Math.exp(logBias)) * 100) + "%"}`);

group((x) => x.est.marketName, "market");
const bySignal = group((x) => D.SIGNAL_TEXT[x.est.confidenceLabel], "signal strength");
group((x) => x.est.basis.find((b) => /employer|services/i.test(b)) || "?", "employer tier");

console.log("\nBiggest misses");
for (const x of [...scored].sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio))).slice(0, 5)) {
  const dir = x.ratio > 1 ? "too high" : "too low";
  console.log(`  ${x.r.title} @ ${x.r.company || "?"}: estimated ${x.range}, actual ${E.fmtOne(x.est.currency, x.actual)} (${dir}, ${Math.max(x.ratio, 1 / x.ratio).toFixed(2)}x)`);
}

const cal = {};
for (const x of scored) {
  const k = x.est.confidenceLabel;
  cal[k] = cal[k] || { hits: 0, n: 0 };
  cal[k].n++; if (x.hit) cal[k].hits++;
}
const snippet = Object.fromEntries(Object.entries(cal).filter(([, v]) => v.n >= 5)
  .map(([k, v]) => [k, { hitRate: +(v.hits / v.n).toFixed(2), n: v.n }]));
console.log("\nPaste into CALIBRATION in src/data.js (signals with 5+ tests only):");
console.log("  CALIBRATION: " + JSON.stringify(snippet) + ",");
