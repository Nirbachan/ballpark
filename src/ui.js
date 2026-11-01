// Ballpark UI: one floating card and one pill style, both isolated in Shadow DOM.
window.Ballpark = window.Ballpark || {};

(function () {
  const E = window.Ballpark.engine;
  const D = window.Ballpark.DATA;

  const TOKENS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .t { --ink:#1C2530; --muted:#5E6875; --line:#E4E8EC; --bg:#FFFFFF; --track:#E7EEE9; --field:#2F6E4F;
         --high:#2F6E4F; --medium:#A77A1F; --low:#B0503A; --pill:#F1F6F2; --pillline:#CFE0D5;
         font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
         color: var(--ink); font-variant-numeric: tabular-nums; }
    @media (prefers-color-scheme: dark) {
      .t:not(.light) { --ink:#E6EAEE; --muted:#9AA4AE; --line:#333C45; --bg:#1E252C; --track:#2A3530; --field:#6BBF94;
           --high:#6BBF94; --medium:#D9A94A; --low:#E08A73; --pill:#21302A; --pillline:#35503F; }
    }
    .t.dark { --ink:#E6EAEE; --muted:#9AA4AE; --line:#333C45; --bg:#1E252C; --track:#2A3530; --field:#6BBF94;
           --high:#6BBF94; --medium:#D9A94A; --low:#E08A73; --pill:#21302A; --pillline:#35503F; }
    .dot { width:7px; height:7px; border-radius:50%; flex:none; }
    .high .dot, .dot.high { background: var(--high); }
    .medium .dot, .dot.medium { background: var(--medium); }
    .low .dot, .dot.low { background: var(--low); }
  `;

  const CARD_CSS = `
    .card { position: fixed; z-index: 2147483647; width: 304px; padding: 14px 16px 12px;
      background: var(--bg); border: 1px solid var(--line); border-radius: 12px;
      box-shadow: 0 10px 30px rgba(20, 30, 40, .16); }
    .card[hidden] { display: none; }
    @media (prefers-reduced-motion: no-preference) {
      .card:not([hidden]) { animation: in .12s ease-out; }
      @keyframes in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
    }
    .name { font-weight: 600; font-size: 14px; }
    .role { color: var(--muted); font-size: 12px; margin-top: 1px; }
    .fig { font-size: 23px; font-weight: 650; letter-spacing: -0.02em; margin-top: 12px; line-height: 1.15; }
    .fig small { font-size: 12px; font-weight: 400; color: var(--muted); letter-spacing: 0; margin-left: 4px; }
    .inr { color: var(--muted); font-size: 12px; margin-top: 2px; }
    .ladder { margin-top: 12px; }
    .track { position: relative; height: 6px; border-radius: 3px; background: var(--track); }
    .seg { position: absolute; top: 0; height: 6px; border-radius: 3px; background: var(--field); min-width: 6px; }
    .ends { display: flex; justify-content: space-between; color: var(--muted); font-size: 11px; margin-top: 4px; }
    .conf { display: flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 12px; }
    .conf b { font-weight: 600; }
    .basis { color: var(--muted); font-size: 12px; margin-top: 3px; }
    .none { margin-top: 10px; }
    .none b { display: block; font-weight: 600; }
    .none span { color: var(--muted); font-size: 12px; }
    .src { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
    .src p { margin: 0 0 6px; font-size: 12px; color: var(--muted); }
    .links { display: flex; flex-wrap: wrap; gap: 6px; }
    .links a { font-size: 12px; color: var(--ink); text-decoration: none; padding: 3px 9px;
      border: 1px solid var(--line); border-radius: 999px; }
    .links a:hover, .links a:focus-visible { border-color: var(--field); color: var(--field); outline: none; }
    .foot { margin-top: 10px; color: var(--muted); font-size: 11px; }
    .paid { color: var(--muted); font-size: 12px; margin-top: 2px; }
    .val { color: var(--muted); font-size: 11px; margin-top: 3px; }
    .fb { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 12px; }
    .fb span { color: var(--muted); flex-basis: 100%; }
    .fb button { font: inherit; font-size: 12px; color: var(--ink); background: none; cursor: pointer;
      border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
    .fb button:hover, .fb button:focus-visible { border-color: var(--field); color: var(--field); outline: none; }
    .fb.done { color: var(--muted); }
  `;

  const PILL_CSS = `
    .pill { display: inline-flex; align-items: center; gap: 6px; margin-top: 5px; padding: 2px 9px 2px 7px;
      border-radius: 999px; background: var(--pill); border: 1px solid var(--pillline);
      font-size: 12px; font-weight: 600; cursor: default; white-space: nowrap; }
    .pill:focus-visible { outline: 2px solid var(--field); outline-offset: 2px; }
    .pill.na { font-weight: 400; color: var(--muted); }
    .pill em { font-style: normal; font-weight: 400; color: var(--muted); }
  `;

  // Follow LinkedIn's own theme setting when it is detectable, else the OS setting.
  function theme() {
    const c = document.documentElement.classList;
    return c.contains("theme--dark") ? "dark" : c.contains("theme--light") ? "light" : "";
  }

  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- links to real data (opened by the user, never fetched by us) ----------

  function shortTitle(t) {
    return (t || "").split(/\s[-–|]\s|\(|,/)[0].replace(/\s+/g, " ").trim();
  }

  function sourceLinks(est) {
    const role = shortTitle(est.title);
    const co = (est.company || "").replace(/\b(limited|ltd\.?|pvt\.?|private|inc\.?|llp|llc|gmbh|b\.?v\.?)\b/gi, "").trim();
    const q = (site) => "https://www.google.com/search?q=" + encodeURIComponent(`${co} "${role}" salary site:${site}`);
    const india = est.market === "IN";
    const list = [
      india && ["AmbitionBox", q("ambitionbox.com")],
      ["Glassdoor", q(india ? "glassdoor.co.in" : "glassdoor.com")],
      ["Levels.fyi", q("levels.fyi")],
      india && ["6figr", q("6figr.com")],
      ["Reddit", q("reddit.com")]
    ].filter(Boolean);
    return list.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${n}</a>`).join("");
  }

  // ---------- card ----------

  let host, root, card, hideTimer = null;

  function ensure() {
    if (host) return;
    host = document.createElement("div");
    host.setAttribute("data-ballpark", "card");
    root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${TOKENS}${CARD_CSS}</style><div class="t"><div class="card" hidden role="tooltip"></div></div>`;
    card = root.querySelector(".card");
    card.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    card.addEventListener("mouseleave", () => hideSoon());
    document.documentElement.appendChild(host);
  }

  function logPos(v, min, max) {
    const p = (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return Math.max(0, Math.min(1, p)) * 100;
  }

  function validated(label) {
    const c = D.CALIBRATION[label];
    return c && c.n ? `Real pay fell in range ${Math.round(c.hitRate * 100)}% of the time in ${c.n} tests`
                    : "Not yet validated against real salaries";
  }

  let feedbackHandler = null;

  function body(est, mode, person) {
    const read = est.title ? [est.title, est.company].filter(Boolean).join(", ")
      : est.company ? `Role unclear, works at ${est.company}` : (person.headline || "No headline");
    const head = mode === "person"
      ? `<div class="name">${esc(person.name)}</div><div class="role">${esc(read)}</div>`
      : `<div class="name">${esc(shortTitle(est.title))}</div><div class="role">${esc([est.company, est.location].filter(Boolean).join(", "))}</div>`;

    if (!est.enough) {
      return `${head}${mode === "person" && est.source ? `<div class="val">Role read from ${esc(est.source)}</div>` : ""}<div class="none"><b>Not enough to estimate</b><span>${esc(est.reason)}</span></div>
        ${mode === "job" && est.title ? `<div class="src"><p>Check real numbers</p><div class="links">${sourceLinks({ ...est, market: "IN" })}</div></div>` : ""}`;
    }

    const local = E.fmtRange(est.currency, est.low, est.high);
    const inr = est.currency === "INR" ? "" :
      `<div class="inr">About ${E.fmtRange("INR", est.inrLow, est.inrHigh)} at ₹${D.FX_TO_INR[est.currency]} per ${est.currency}</div>`;
    const a = logPos(est.low, est.scaleMin, est.scaleMax), b = logPos(est.high, est.scaleMin, est.scaleMax);
    const parts = (est.location || "").split(",").map((x) => x.trim()).filter(Boolean);
    const place = parts.length > 1 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts[0] || "";
    const where = (mode === "person" && place ? `<div class="role">${esc(place)}</div>` : "")
      + (mode === "person" && est.source ? `<div class="val">Role read from ${esc(est.source)}</div>` : "");

    return `${head}${where}
      <div class="fig">${local}</div>
      <div class="paid">${esc(est.payBasis)}</div>${inr}
      <div class="ladder" aria-hidden="true">
        <div class="track"><div class="seg" style="left:${a}%;width:${Math.max(b - a, 2)}%"></div></div>
        <div class="ends"><span>Entry</span><span>Executive</span></div>
      </div>
      <div class="conf ${est.confidenceLabel}"><span class="dot"></span><b>${D.SIGNAL_TEXT[est.confidenceLabel]}</b></div>
      <div class="basis">${esc(est.basis.join(", "))}</div>
      <div class="val">${validated(est.confidenceLabel)}</div>
      ${mode === "job" ? `<div class="src"><p>Check real numbers</p><div class="links">${sourceLinks(est)}</div></div>` : ""}
      <div class="fb"><span>Was this close?</span>
        <button data-v="close">Close</button><button data-v="low">Too low</button><button data-v="high">Too high</button></div>
      <div class="foot">${mode === "person" ? "An estimate for the role, not what this person earns." : "Estimated from the title, employer and city."}</div>`;
  }

  function show(anchor, est, mode, person) {
    ensure();
    clearTimeout(hideTimer);
    root.querySelector(".t").className = "t " + theme();
    card.innerHTML = body(est, mode, person || {});
    card.hidden = false;
    const r = anchor.getBoundingClientRect(), w = 304, gap = 8, h = card.offsetHeight;
    const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    let top = r.bottom + gap;
    if (top + h > innerHeight - 8) top = r.top - gap - h;
    top = Math.max(8, top);
    card.style.left = left + "px";
    card.style.top = top + "px";

    const fb = card.querySelector(".fb");
    if (fb) fb.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (feedbackHandler) feedbackHandler(b.dataset.v, est, mode);
      fb.classList.add("done");
      fb.textContent = "Saved. See your results in the Ballpark menu.";
    });
  }

  function hideSoon(ms = 220) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (card) card.hidden = true; }, ms);
  }

  function hideNow() { clearTimeout(hideTimer); if (card) card.hidden = true; }

  // ---------- pill ----------

  function pill(est) {
    const h = document.createElement("span");
    h.setAttribute("data-ballpark", "pill");
    h.style.cssText = "display:block;";
    const r = h.attachShadow({ mode: "open" });
    const label = est.enough ? E.fmtRange(est.currency, est.low, est.high) : "No estimate";
    const cls = est.enough ? est.confidenceLabel : "na";
    const inr = est.enough && est.currency !== "INR" ? ` <em>${esc(E.fmtRange("INR", est.inrLow, est.inrHigh))}</em>` : "";
    r.innerHTML = `<style>${TOKENS}${PILL_CSS}</style><span class="t ${theme()}"><span class="pill ${cls}" tabindex="0"
      aria-label="Estimated pay ${esc(label)}. Hover or focus for details.">${est.enough ? '<span class="dot"></span>' : ""}${esc(label)}${inr}</span></span>`;
    const p = r.querySelector(".pill");
    const open = () => show(p, est, "job");
    h.addEventListener("mouseenter", open);
    h.addEventListener("mouseleave", () => hideSoon());
    p.addEventListener("focus", open);
    p.addEventListener("blur", () => hideSoon());
    h.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }, true);
    return h;
  }

  window.Ballpark.ui = { show, hideSoon, hideNow, pill, onFeedback: (fn) => (feedbackHandler = fn),
    isVisible: () => !!(card && !card.hidden) };
})();
