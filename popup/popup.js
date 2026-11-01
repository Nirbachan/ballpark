const $ = (id) => document.getElementById(id);
const SIGNALS = [["high", "Strong"], ["medium", "Partial"], ["low", "Weak"]];

async function init() {
  const { personMode = true } = await chrome.storage.sync.get({ personMode: true });
  $("personMode").checked = personMode;
  $("personMode").addEventListener("change", (e) => chrome.storage.sync.set({ personMode: e.target.checked }));
  render();
}

async function render() {
  const { feedback = [] } = await chrome.storage.local.get("feedback");
  const n = feedback.length;
  $("export").disabled = $("clear").disabled = n === 0;
  $("empty").hidden = n > 0;
  $("summary").hidden = n === 0;
  if (!n) return;

  const count = (v, rows = feedback) => rows.filter((r) => r.verdict === v).length;
  const c = count("close"), lo = count("low"), hi = count("high");
  const pct = (x, of = n) => Math.round((x / of) * 100);

  $("closePct").textContent = pct(c) + "%";
  $("closeText").textContent = `of ${n} estimates you rated were close`;
  $("barClose").style.width = pct(c) + "%";
  $("barLow").style.width = pct(lo) + "%";
  $("barHigh").style.width = pct(hi) + "%";
  $("nClose").textContent = c; $("nLow").textContent = lo; $("nHigh").textContent = hi;

  $("bySignal").innerHTML = SIGNALS.map(([k, label]) => {
    const rows = feedback.filter((r) => r.signal === k);
    return `<tr><td>${label}</td><td>${rows.length}</td><td>${rows.length ? pct(count("close", rows), rows.length) + "%" : "–"}</td></tr>`;
  }).join("");

  const skew = lo - hi;
  $("bias").textContent = n < 10 ? "Rate at least 10 estimates to see a reliable pattern."
    : Math.abs(skew) < n * 0.15 ? "No clear bias: misses are split between too low and too high."
    : skew > 0 ? "Estimates tend to run low. Consider raising the bands in src/data.js."
    : "Estimates tend to run high. Consider lowering the bands in src/data.js.";
}

$("export").addEventListener("click", async () => {
  const { feedback = [] } = await chrome.storage.local.get("feedback");
  const cols = ["at", "kind", "verdict", "title", "company", "location", "market", "currency", "low", "high", "signal", "level", "family", "tier"];
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...feedback.map((r) => cols.map((k) => cell(r[k])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `ballpark-feedback-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
});

$("clear").addEventListener("click", async () => {
  if (!confirm("Delete all saved feedback? This can't be undone.")) return;
  await chrome.storage.local.remove("feedback");
  render();
});

init();

$("diag").addEventListener("click", async () => {
  const msg = $("diagMsg");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const report = await chrome.tabs.sendMessage(tab.id, { type: "ballpark-diagnose" });
    if (!report) throw new Error("no reply");
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    msg.textContent = "Copied. Paste it into your chat.";
  } catch (err) {
    msg.textContent = "Ballpark isn't running on this tab. Open LinkedIn, refresh the page, and try again.";
  }
});
