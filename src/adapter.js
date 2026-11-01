// Every LinkedIn-specific selector lives in this file and nowhere else.
window.Ballpark = window.Ballpark || {};

(function () {
  const D = window.Ballpark.DATA;
  const E = window.Ballpark.engine;

  const JOB_LINK = "a[href*='/jobs/view/'], a[href*='currentJobId=']";
  const PROFILE_LINK = "a[href*='/in/']";

  // Walk up through shadow roots as well as normal parents.
  function parentOf(node) {
    if (!node) return null;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode && node.getRootNode();
    return root && root.host ? root.host : null;
  }

  const CARD_SELECTORS = [
    "li[data-occludable-job-id]", "[data-job-id]", ".job-card-container",
    ".jobs-search-results__list-item", "li.scaffold-layout__list-item", "[data-view-name*='job-card']"
  ].join(",");
  const TITLE_SELECTORS = ["a.job-card-list__title", "a.job-card-container__link", "a[href*='/jobs/view/']", "a[href*='currentJobId=']"].join(",");
  const COMPANY_SELECTORS = [".artdeco-entity-lockup__subtitle", ".job-card-container__primary-description",
    ".job-card-container__company-name", ".job-details-jobs-unified-top-card__company-name"].join(",");
  const LOCATION_SELECTORS = [".artdeco-entity-lockup__caption", ".job-card-container__metadata-wrapper li",
    ".job-card-container__metadata-item", ".job-details-jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__tertiary-description-container"].join(",");

  // ---------- shared helpers ----------

  function clean(text) {
    return (text || "").split("\n")[0].replace(/\s+with verification\s*$/i, "").replace(/\s+/g, " ").trim();
  }

  function linesOf(el) {
    const lines = (el.innerText || "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    return lines.filter((l, i) => l !== lines[i - 1]);
  }

  const isNoise = (l) => D.NOISE.test(l) || /\b(ago|reposted|posted)\b/i.test(l) && !E.marketOf(l);
  const isOurs = (el) => !!(el && el.closest && el.closest("[data-ballpark]"));

  // ---------- job cards ----------

  function looksLikeJobCard(node) {
    if (!node || node.nodeType !== 1) return false;
    if (!node.querySelector(JOB_LINK) && !(node.matches && node.matches(JOB_LINK))) return false;
    const r = node.getBoundingClientRect();
    if (r.height < 40 || r.height > 420 || r.width > 900) return false;
    return linesOf(node).length >= 2;
  }

  function findJobCard(el) {
    if (!el || !el.closest) return null;
    const known = el.closest(CARD_SELECTORS);
    if (known) return known;
    let node = el, best = null;
    for (let i = 0; i < 14 && node && node !== document.body; i++, node = node.parentElement) {
      if (looksLikeJobCard(node)) best = node;
      else if (best) break;
    }
    return best;
  }

  function allJobCards() {
    const set = new Set();
    document.querySelectorAll(CARD_SELECTORS).forEach((c) => set.add(c));
    document.querySelectorAll(JOB_LINK).forEach((a) => { const c = findJobCard(a); if (c) set.add(c); });
    const all = [...set].filter((c) => !isOurs(c));
    return all.filter((c) => !all.some((o) => o !== c && c.contains(o)));
  }

  // Pure: works on text lines, testable outside the browser.
  function parseJobLines(lines, known) {
    const title = known.title || "";
    const rest = lines.filter((l) => l !== title && !isNoise(l));
    const locationLine = known.location || rest.find((l) => E.marketOf(l) || l.includes("·") || /\((On-site|Hybrid|Remote)\)/i.test(l)) || "";
    const location = locationLine.split("·")[0].trim();
    let company = known.company && known.company !== title ? known.company : "";
    if (!company) company = rest.find((l) => l !== locationLine && !l.includes("·") && !E.marketOf(l)) || "";
    return { title, company, location };
  }

  function extractJob(card) {
    const lines = linesOf(card).map(clean);
    const titleEl = card.querySelector(TITLE_SELECTORS);
    const companyEl = card.querySelector(COMPANY_SELECTORS) || card.querySelector("a[href*='/company/']");
    const locationEl = card.querySelector(LOCATION_SELECTORS);
    const title = clean(titleEl && titleEl.innerText) || lines[0] || "";
    const job = parseJobLines(lines, {
      title,
      company: clean(companyEl && companyEl.innerText),
      location: clean(locationEl && locationEl.innerText)
    });
    job.key = [card.getAttribute("data-occludable-job-id") || card.getAttribute("data-job-id") || "", job.title, job.company].join("|");
    return job;
  }

  function pillAnchor(card) {
    let el = card.querySelector(LOCATION_SELECTORS) || card.querySelector(COMPANY_SELECTORS);
    if (el && el.tagName === "LI") el = el.closest("ul") || el;
    return el || card.querySelector(TITLE_SELECTORS);
  }

  // ---------- people ----------

  const tidyName = (l) => (l || "").replace(/^View\s+/i, "").replace(/[’']s?\s+(profile|graphic link|photo).*$/i, "")
    .replace(/,?\s*#?open_?to_?work.*$/i, "").trim();

  function nameOf(link) {
    const t = linesOf(link).map(tidyName).filter((l) => l && !isNoise(l) && !/^(view|status is)/i.test(l));
    if (t[0]) return t[0];
    // Photo links carry the name only in an attribute.
    const img = link.querySelector("img[alt]");
    const cand = [link.getAttribute("aria-label"), img && img.getAttribute("alt"), link.getAttribute("title")]
      .map(tidyName).find((x) => x && x.length > 1 && !isNoise(x) && !/^(profile|photo|image)$/i.test(x));
    return cand || "";
  }

  // Pure: given text lines around a name, find the headline and location.
  function parsePersonLines(lines, name) {
    const rest = lines.filter((l) => l !== name && !l.startsWith(name + " ") && !isNoise(l) && l.length > 2);
    const current = rest.find((l) => /^(current|present)\s*:/i.test(l)) || "";
    const others = rest.filter((l) => l !== current && !/^(past|previous|skills|summary)\s*:/i.test(l));
    const location = others.find((l) => E.marketOf(l) && l.length < 80 && !/\b(at|@)\b/i.test(l)) || "";
    const headline = others.find((l) => l !== location && l.length > 3) || "";
    return { headline, location, current };
  }

  // Same person whatever the link's tracking parameters: compare by profile slug.
  function slugOf(href) {
    if (href && href.href) href = href.href;
    const m = String(href || "").match(/\/in\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]).toLowerCase() : "";
  }

  function hrefOf(a) { return (a && (a.href || a.getAttribute("href"))) || ""; }

  // Any link to a profile counts. A readable name is nice to have, not required.
  function isPersonLink(a) {
    if (!a || a.tagName !== "A" || isOurs(a)) return false;
    const href = hrefOf(a);
    if (!/\/in\/[^/?#]+/.test(href)) return false;
    if (/\/(recent-activity|details?|edit|skills|opportunities)\//.test(href)) return false;
    if (/\/overlay\//.test(href) && !/about-this-profile/.test(href) && !a.querySelector("h1, h2")) return false;
    return true;
  }

  function nameFromSlug(slug) {
    return (slug || "").replace(/-[0-9a-f]{6,}$/i, "").replace(/-\d+$/, "").split("-").filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  }

  // ---------- profile page: read the person's own top card and Experience section ----------

  function visibleTexts(el) {
    const spans = [...el.querySelectorAll("span[aria-hidden='true']")].map((x) => clean(x.innerText)).filter(Boolean);
    return spans.length ? spans.filter((t, i) => t !== spans[i - 1]) : linesOf(el).map(clean);
  }

  // First (current) position. Handles single roles and grouped roles at one company.
  function readExperience() {
    const anchor = document.getElementById("experience");
    let section = anchor && (anchor.closest("section") || anchor.parentElement);
    if (!section) {
      const h = [...document.querySelectorAll("main section h2, main section h3")].find((x) => /^\s*experience\s*$/i.test(x.innerText || ""));
      section = h && h.closest("section");
    }
    if (!section) return null;
    const item = section.querySelector("li");
    if (!item) return null;
    const texts = visibleTexts(item);
    // Grouped roles put the company first and a total tenure second ("Full-time · 5 yrs 3 mos").
    const grouped = /\b\d+\s*(yrs?|mos?|years?|months?)\b/i.test(texts[1] || "") && !/\b(19|20)\d{2}\b/.test(texts[1] || "");
    const nested = item.querySelector("ul li");
    if (grouped && nested) {
      const inner = visibleTexts(nested);
      return { title: inner[0] || "", company: texts[0] || "", current: /present/i.test(inner.join(" ")) };
    }
    return { title: texts[0] || "", company: (texts[1] || "").split("·")[0].trim(), current: /present/i.test(texts.join(" ")) };
  }

  // The profile's own name: a heading if there is one, else the "About this profile" link.
  function profileNameEl() {
    const main = document.querySelector("main") || document.body;
    return main.querySelector("h1")
      || main.querySelector("a[href*='about-this-profile'] h1, a[href*='about-this-profile'] h2, a[href*='about-this-profile']")
      || main.querySelector("h2");
  }

  function profileTopCard() {
    const n = profileNameEl();
    if (!n) return null;
    let top = n.closest("section");
    if (!top) { top = n; for (let i = 0; i < 5 && top.parentElement && top.parentElement !== document.body; i++) top = top.parentElement; }
    return { nameEl: n, top };
  }

  function readProfilePage() {
    if (!location.pathname.startsWith("/in/")) return null;
    const tc = profileTopCard();
    if (!tc) return null;
    const { nameEl, top } = tc;
    const name = (nameEl.tagName === "A" ? nameOf(nameEl) : clean(nameEl.innerText)) || nameFromSlug(slugOf(location.pathname));

    // Stable class names first, then read the card's text lines after the name.
    const parsed = parsePersonLines(linesOf(top).map(clean), name);
    const headlineEl = top.querySelector(".text-body-medium");
    const locationEl = top.querySelector(".text-body-small.inline, span.text-body-small");
    const headlineTxt = clean(headlineEl && headlineEl.innerText);
    const locationTxt = clean(locationEl && locationEl.innerText);

    const companyBtn = top.querySelector("[aria-label*='Current company' i], [aria-label*='current company' i]");
    const topCompany = companyBtn ? (companyBtn.getAttribute("aria-label") || "").replace(/^.*current company:?\s*/i, "").replace(/\.\s*click.*$/i, "").trim() : "";
    const exp = readExperience();
    return {
      slug: slugOf(location.pathname),
      name,
      headline: headlineTxt && !isNoise(headlineTxt) ? headlineTxt : parsed.headline,
      location: locationTxt && E.marketOf(locationTxt) ? locationTxt : parsed.location,
      topCompany,
      experience: exp && exp.title ? { title: exp.title, company: exp.company } : null
    };
  }

  // Is this link the person whose profile is open? Their name link often uses an internal ID, not the page address.
  function isProfileSubject(link) {
    if (!location.pathname.startsWith("/in/")) return false;
    const href = hrefOf(link);
    if (/about-this-profile/.test(href)) return true;
    if (slugOf(href) && slugOf(href) === slugOf(location.pathname)) return true;
    const tc = profileTopCard();
    return !!(tc && tc.top.contains(link) && (link.contains(tc.nameEl) || tc.nameEl.contains(link) || link === tc.nameEl));
  }

  function extractPerson(link) {
    const slug = slugOf(hrefOf(link));
    const name = nameOf(link) || nameFromSlug(slug);

    // On their own profile page, use the full top card and Experience section.
    if (isProfileSubject(link)) {
      const page = readProfilePage();
      if (page) return { ...page, name: page.name || name, onOwnProfile: true };
    }

    // 1) Feed and comment author links often contain the headline themselves.
    const own = parsePersonLines(linesOf(link).map(clean), name);
    if (own.headline || own.current) return { name, slug, ...own };

    // 2) Otherwise grow outwards, reading only the lines that come after this person's name.
    let node = link;
    for (let i = 0; i < 9 && node && node !== document.body; i++) {
      node = parentOf(node);
      if (!node || node === document.body) break;
      if (node.getBoundingClientRect().height > 360) break;
      const lines = linesOf(node).map(clean);
      // A name that starts a line is a header ("Dev Patel • 2nd"); one inside a sentence is an @mention.
      const at = lines.findIndex((l) => l === name || l.startsWith(name + " "));
      if (at === -1) {
        if (lines.some((l) => l.includes(name))) break; // mention: don't read post text as a role
        continue;
      }
      const parsed = parsePersonLines(lines.slice(at), name);
      if (parsed.headline || parsed.current) return { name, slug, ...parsed };
      const people = new Set([...node.querySelectorAll(PROFILE_LINK)].map((a) => slugOf(hrefOf(a))).filter(Boolean));
      if (people.size > 1) break;
    }
    return { name, slug, headline: "", location: "", current: "" };
  }

  window.Ballpark.adapter = { isProfileSubject, profileTopCard, nameOf, nameFromSlug, parentOf, hrefOf,
    allJobCards, extractJob, pillAnchor, findJobCard, parseJobLines,
    PROFILE_LINK, isPersonLink, extractPerson, parsePersonLines, isOurs, slugOf, readProfilePage
  };
})();
