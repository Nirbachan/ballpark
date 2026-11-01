// Person estimates: hover (when switched on), right-click (always), and diagnostics.
(function () {
  const BP = window.Ballpark;
  const A = BP.adapter, E = BP.engine, UI = BP.ui, S = BP.store;
  const DELAY = 450;

  let pending = null, current = null, lastEvent = null, lastContext = null, lastError = "";

  // ---------- reading a person ----------

  function sources(link) {
    const p = A.extractPerson(link);
    const c = S.getProfile(p.slug) || {};
    const src = {
      experience: p.experience || c.experience || null,
      current: p.current || "",
      headline: p.headline || c.headline || "",
      topCompany: p.topCompany || c.topCompany || ""
    };
    return { person: { ...p, headline: src.headline }, src, location: p.location || c.location || "" };
  }

  function fromProfileHeading() {
    const page = A.readProfilePage() || {};
    const c = S.getProfile(page.slug) || {};
    return {
      person: { name: page.name, headline: page.headline },
      src: { experience: page.experience || c.experience, current: "", headline: page.headline || c.headline, topCompany: page.topCompany || c.topCompany },
      location: page.location || c.location || ""
    };
  }

  function estimateFor(target) {
    const own = location.pathname.startsWith("/in/") && (target.tagName !== "A" || A.isProfileSubject(target));
    const { person, src, location: loc } = own ? fromProfileHeading() : sources(target);
    const role = E.resolvePerson(src);
    let est = BP.estimateCached("person", { ...role, location: loc });
    // On their own profile, the Experience section loads only when scrolled into view.
    if (own && !est.enough) est = { ...est, reason: "Couldn't find a role on this profile yet. Scroll down until the Experience section loads, then hover again." };
    return { person, role, est };
  }

  function show(target) {
    try {
      const { person, est } = estimateFor(target);
      UI.show(target, est, "person", person);
      lastError = "";
    } catch (err) {
      lastError = String(err && err.stack || err);
      console.error("[Ballpark] could not read this person", err);
      UI.show(target, { enough: false, reason: "Something went wrong reading this person. Open the Ballpark menu and click Copy diagnostics.", title: "", company: "" }, "person", { name: "" });
    }
  }

  // ---------- finding what the pointer is on ----------

  // composedPath sees inside shadow DOM, where e.target alone can't.
  function targetFrom(e) {
    const path = e.composedPath ? e.composedPath() : [e.target];
    for (const el of path) {
      if (!el || el === document || el === window) break;
      if (A.isOurs(el)) return null;
      if (el.tagName === "A" && A.isPersonLink(el)) return el;
    }
    if (location.pathname.startsWith("/in/")) {
      const tc = A.profileTopCard();
      if (tc && path.some((el) => el === tc.nameEl || (el.tagName === "IMG" && tc.top.contains(el)))) return tc.nameEl;
    }
    return null;
  }

  // ---------- hover ----------

  document.addEventListener("mouseover", (e) => {
    lastEvent = e.composedPath ? e.composedPath()[0] : e.target;
    if (!S.get().personMode) return;
    const t = targetFrom(e);
    if (!t || t === current) return;
    current = t;
    clearTimeout(pending);
    pending = setTimeout(() => show(t), DELAY);
  }, true);

  document.addEventListener("mouseout", (e) => {
    if (!current) return;
    const to = e.relatedTarget;
    if (to && (current.contains(to) || A.isOurs(to))) return;
    clearTimeout(pending);
    current = null;
    UI.hideSoon(300);
  }, true);

  // Only a real page scroll closes the card; LinkedIn's inner widgets scroll constantly.
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    if (Math.abs(window.scrollY - lastY) > 40) UI.hideNow();
    lastY = window.scrollY;
  }, { passive: true });

  // ---------- right-click fallback: works even if hover detection fails ----------

  document.addEventListener("contextmenu", (e) => {
    lastContext = targetFrom(e) || (e.composedPath ? e.composedPath()[0] : e.target);
  }, true);

  document.addEventListener("mousedown", (e) => {
    if (UI.isVisible() && !A.isOurs(e.composedPath ? e.composedPath()[0] : e.target) && !current) UI.hideSoon(0);
  }, true);

  function linkForUrl(url) {
    const slug = A.slugOf(url);
    if (lastContext && lastContext.tagName === "A" && A.slugOf(A.hrefOf(lastContext)) === slug) return lastContext;
    const near = lastContext && lastContext.closest && lastContext.closest("a");
    if (near && A.slugOf(A.hrefOf(near)) === slug) return near;
    return [...document.querySelectorAll(A.PROFILE_LINK)].find((a) => A.slugOf(A.hrefOf(a)) === slug) || null;
  }

  // ---------- diagnostics (masked: no names or text leave as-is) ----------

  const mask = (s) => String(s || "").replace(/\p{Lu}/gu, "X").replace(/\p{Ll}/gu, "x").replace(/\d/g, "9").slice(0, 80);

  function outline(el, depth = 0) {
    if (!el || depth > 5) return "";
    if (el.nodeType === 3) { const t = el.textContent.trim(); return t ? "  ".repeat(depth) + '"' + mask(t) + '"\n' : ""; }
    if (el.nodeType !== 1) return "";
    const attrs = ["id", "class", "role", "href", "aria-label", "data-view-name", "aria-hidden"].map((k) => {
      let v = el.getAttribute(k);
      if (!v) return "";
      if (k === "href") v = v.replace(/\/in\/[^/?#]+/, "/in/SLUG").split("?")[0];
      if (k === "aria-label") v = mask(v);
      return `${k}="${v.slice(0, 70)}"`;
    }).filter(Boolean).join(" ");
    let out = "  ".repeat(depth) + `<${el.tagName.toLowerCase()}${attrs ? " " + attrs : ""}${el.shadowRoot ? " [shadow-root]" : ""}>\n`;
    const kids = [...(el.shadowRoot ? el.shadowRoot.childNodes : []), ...el.childNodes].slice(0, 10);
    for (const k of kids) out += outline(k, depth + 1);
    return out;
  }

  function diagnose() {
    const el = lastEvent;
    const link = el && el.closest ? el.closest("a") : null;
    const chain = [];
    for (let n = el, i = 0; n && i < 10; n = A.parentOf(n), i++) {
      if (n.nodeType === 1) chain.push(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).slice(0, 3).join(".") : ""));
    }
    const report = {
      version: BP.VERSION,
      page: location.pathname.replace(/\/in\/[^/]+/, "/in/SLUG"),
      personHoverOn: S.get().personMode,
      profileLinksOnPage: document.querySelectorAll(A.PROFILE_LINK).length,
      acceptedProfileLinks: [...document.querySelectorAll(A.PROFILE_LINK)].filter(A.isPersonLink).length,
      lastHovered: chain,
      insideShadowDom: !!(el && el.getRootNode && el.getRootNode() !== document),
      nearestLink: link ? { href: A.hrefOf(link).replace(/\/in\/[^/?#]+/, "/in/SLUG").split("?")[0], accepted: A.isPersonLink(link) } : null,
      lastError
    };
    try {
      const t = el && targetFrom({ composedPath: () => { const p = []; for (let n = el; n; n = A.parentOf(n)) p.push(n); return p; }, target: el });
      report.detectedAs = t ? t.tagName : "nothing";
      if (t) { const r = estimateFor(t); report.roleRead = r.role; report.estimated = r.est.enough ? E.fmtRange(r.est.currency, r.est.low, r.est.high) : "not enough: " + r.est.reason; }
    } catch (err) { report.error = String(err); }
    const block = el && (A.parentOf(A.parentOf(A.parentOf(link || el))) || el);
    report.markup = outline(block);
    return report;
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
      if (msg && msg.type === "ballpark-person") {
        const t = linkForUrl(msg.url) || lastContext;
        if (t) show(t);
      }
      if (msg && msg.type === "ballpark-diagnose") reply(diagnose());
    });
  }

  BP.person = { show, targetFrom, diagnose, estimateFor };
})();
