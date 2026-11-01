// Ballpark: shared setup, job pills, profile learning. Person estimates live in person.js.
(function () {
  const BP = window.Ballpark;
  const A = BP.adapter, E = BP.engine, UI = BP.ui, S = BP.store;
  BP.VERSION = "1.3.1";

  const cache = new Map();
  BP.estimateCached = function (kind, input) {
    const key = [kind, input.title, input.company, input.location, input.source].join("|");
    if (!cache.has(key)) {
      if (cache.size > 800) cache.delete(cache.keys().next().value);
      cache.set(key, E.estimate({ ...input, kind }));
    }
    return cache.get(key);
  };

  // ---------- job pills ----------

  function addPill(card) {
    const job = A.extractJob(card);
    if (!job.title) return;
    const existing = card.querySelector("[data-ballpark='pill']");
    if (existing && existing.dataset.key === job.key) return;
    if (existing) existing.remove();
    const pill = UI.pill(BP.estimateCached("job", job));
    pill.dataset.key = job.key;
    const anchor = A.pillAnchor(card);
    if (anchor && anchor.parentNode && card.contains(anchor)) anchor.parentNode.insertBefore(pill, anchor.nextSibling);
    else card.appendChild(pill);
  }

  function scanJobs() {
    if (!location.pathname.startsWith("/jobs")) return;
    for (const card of A.allJobCards()) {
      try { addPill(card); } catch (err) { console.warn("[Ballpark] job card skipped", err); }
    }
  }

  // ---------- profile learning ----------

  function learnProfile() {
    const page = A.readProfilePage();
    if (!page || !page.slug) return;
    S.saveProfile(page.slug, { experience: page.experience, topCompany: page.topCompany, headline: page.headline, location: page.location });
  }

  let scanTimer = null;
  new MutationObserver((muts) => {
    if (muts.every((m) => A.isOurs(m.target))) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { scanJobs(); learnProfile(); }, 350);
  }).observe(document.body, { childList: true, subtree: true });

  // ---------- feedback ----------

  UI.onFeedback((verdict, est, kind) => {
    S.addFeedback({
      kind, verdict, title: est.title, company: est.company, location: est.location,
      market: est.market, currency: est.currency, low: Math.round(est.low || 0), high: Math.round(est.high || 0),
      signal: est.confidenceLabel, level: est.level, family: est.family, tier: est.tier
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") UI.hideNow();
    if (e.altKey && e.shiftKey && e.code === "KeyB") console.log("[Ballpark] diagnostics\n" + JSON.stringify(BP.person.diagnose(), null, 2));
  });

  S.load().then(() => {
    console.log(`[Ballpark] v${BP.VERSION} running, name hover ${S.get().personMode ? "on" : "off"}, right-click always available`);
    scanJobs();
    learnProfile();
  });
})();
