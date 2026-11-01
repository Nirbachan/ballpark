// Ballpark engine: text in, estimate out. No DOM access, so it is testable in Node.
window.Ballpark = window.Ballpark || {};

(function () {
  const D = window.Ballpark.DATA;

  // ---------- parsing ----------

  function protectPartner(s) {
    return s.replace(new RegExp(D.NOT_PARTNER.source, "gi"), (m) => m.replace(/partner/i, "partnerrole"));
  }

  function levelOf(text) {
    const t = protectPartner(text);
    for (const r of D.LEVELS) if (r.re.test(t)) return r.level;
    return null;
  }

  function familyOf(text) {
    for (const f of D.FAMILIES) if (f.re.test(text)) return f;
    return null;
  }

  function tierOf(company) {
    if (!company) return null;
    for (const t of D.TIERS) if (t.re.test(company)) return t.tier;
    return null;
  }

  function marketOf(location) {
    if (!location) return null;
    for (const l of D.LOCATIONS) if (l.re.test(location)) return l;
    return null;
  }

  // Split "Title at Company | Other role | ex-Company" into scored candidates.
  const SPLIT = /\s*[|•·\/]\s*|\s+[-–]\s+/;
  const FORMER = /^(ex[- ]|former|previously|prev\.?|alum)/i;

  function splitRole(seg) {
    const m = seg.match(/^(.*?)\s+(?:at|@)\s+(.+)$/i) || seg.match(/^(.*?)\s*@\s*(.+)$/);
    return m ? { title: m[1].trim(), company: m[2].replace(/[,.;]+$/, "").trim() } : { title: seg.trim(), company: "" };
  }

  function knownEmployer(text) {
    for (const t of D.TIERS) { const m = text.match(t.re); if (m) return m[0]; }
    return "";
  }

  // Pick the most role-like part of a headline, plus the current employer if stated.
  function parseHeadline(headline) {
    const segs = (headline || "").split(SPLIT).map((x) => x.trim()).filter((x) => x.length > 1);
    let best = null, bestScore = 0, company = "";
    for (const seg of segs) {
      if (FORMER.test(seg)) continue;
      const r = splitRole(seg);
      if (!company && r.company) company = r.company;
      const score = (levelOf(r.title) ? 2 : 0) + (familyOf(r.title) ? 1 : 0) + (r.company ? 1 : 0);
      if (score > bestScore) { best = r; bestScore = score; }
    }
    if (!company) company = knownEmployer(segs.filter((x) => !FORMER.test(x)).join(" | "));
    return { title: best ? best.title : "", company: (best && best.company) || company };
  }

  // Best available source for a person's current role, most reliable first.
  // sources: { experience: {title, company}, current: "Title at Company", headline, topCompany }
  function resolvePerson(src) {
    if (src.experience && src.experience.title) {
      return { title: src.experience.title, company: src.experience.company || src.topCompany || "", source: "their Experience section" };
    }
    if (src.current) {
      const r = splitRole(src.current.replace(/^(current|present)\s*:\s*/i, ""));
      if (r.title) return { ...r, company: r.company || src.topCompany || "", source: "their current role" };
    }
    const h = parseHeadline(src.headline);
    return { title: h.title, company: h.company || src.topCompany || "", source: "their headline" };
  }

  // ---------- estimating ----------

  function band(market, level, famMult, tierMult, premium) {
    const b = D.MARKETS[market].base;
    const base = level === 8 ? b[6] * D.EXEC_MULT : b[level - 1];
    return base * 1000 * famMult * tierMult * premium;
  }

  // input: { title, company, location, kind: "person" | "job" }
  function estimate(input) {
    const title = (input.title || "").trim();
    const basis = [];
    let confidence = 20;

    // Level: job titles may list two levels ("Senior Consultant/Manager").
    const segments = input.kind === "job" ? title.split("/").map((s) => s.trim()) : [title];
    const found = segments.map(levelOf).filter(Boolean);
    let levels = [...new Set(found)].sort((a, b) => a - b);
    // Mixed-role titles far apart ("Sr Manager / Consultant"): trust the first, main title.
    if (levels.length > 1 && levels[levels.length - 1] - levels[0] >= 2) levels = [found[0]];
    const family = familyOf(title);

    const notEnough = (reason) => ({ enough: false, reason, source: input.source || "", title, company: input.company || "", location: input.location || "" });
    if (/founder/i.test(title)) return notEnough("Founder pay depends on equity and funding, so a title can't predict it.");
    const companyOnly = !levels.length && !family && input.kind === "person" && !!input.company;
    if (!levels.length && !family && !companyOnly) {
      return notEnough(input.kind === "person"
        ? "Their headline doesn't name a role or employer. Open their profile once and Ballpark will read their current role."
        : "The title doesn't say enough about the role or seniority.");
    }

    let lo = 3, hi = 3;
    if (levels.length) {
      lo = levels[0]; hi = levels[levels.length - 1];
      confidence += lo === hi ? 30 : 15;
      basis.push(lo === hi ? D.LEVEL_NAMES[lo] + " level" : `${D.LEVEL_NAMES[lo]} to ${D.LEVEL_NAMES[hi]} level`);
    } else if (companyOnly) {
      basis.push("Role unclear, estimated for a typical mid-level role");
    } else {
      basis.push("Level unclear, assumed mid-level");
    }

    const famMult = family ? family.mult : 1.0;
    if (family) { confidence += 15; basis.push(family.label); }

    const loc = marketOf(input.location);
    const market = loc ? loc.market : D.DEFAULT_MARKET;
    const premium = loc ? loc.premium : 1.0;
    if (loc) confidence += 15;
    else basis.push(`Location not shown, assumed ${D.MARKETS[market].name}`);

    const tier = tierOf(input.company) || "D";
    const tierMult = (market === "IN" ? D.TIER_MULT.IN : D.TIER_MULT.OTHER)[tier];
    if (tierOf(input.company)) confidence += 20;
    basis.push(D.TIER_NAMES[tier]);

    if (!loc) confidence = Math.min(confidence, 70);
    if (lo !== hi) confidence = Math.min(confidence, 80);
    if (companyOnly) confidence = Math.min(confidence, 40);
    if (input.source === "their headline" && !levels.length) confidence = Math.min(confidence, 45);
    confidence = Math.max(10, Math.min(100, confidence));
    const spread = 0.12 + (100 - confidence) / 350;

    const midLo = band(market, lo, famMult, tierMult, premium);
    const midHi = band(market, hi, famMult, tierMult, premium);
    const low = midLo * (1 - spread);
    const high = midHi * (1 + spread);

    const currency = D.MARKETS[market].currency;
    let payBasis = D.PAY_BASIS[market] || D.PAY_BASIS.DEFAULT;
    if ((tier === "A" || tier === "B") && family && D.STOCK_FAMILIES.includes(family.id)) payBasis += ", includes stock";
    const fx = D.FX_TO_INR[currency];
    const scaleMin = D.MARKETS[market].base[0] * 1000 * 0.5;
    const scaleMax = D.MARKETS[market].base[6] * 1000 * D.EXEC_MULT * 2.5;

    return {
      enough: true, source: input.source || "",
      title, company: input.company || "", location: input.location || "",
      market, marketName: D.MARKETS[market].name, currency,
      low, high,
      inrLow: low * fx, inrHigh: high * fx,
      confidence, confidenceLabel: confidence >= 85 ? "high" : confidence >= 50 ? "medium" : "low",
      basis, scaleMin, scaleMax, payBasis,
      level: lo === hi ? lo : `${lo}-${hi}`, family: family ? family.id : "", tier
    };
  }

  // ---------- formatting ----------

  const SYMBOL = { USD: "$", GBP: "£", EUR: "€", SGD: "S$", CAD: "C$", AUD: "A$", AED: "AED ", SEK: "SEK " };

  function roundNice(v, step) { return Math.round(v / step) * step; }

  function fmtINR(low, high) {
    const L = 1e5, CR = 1e7;
    const lakh = (v) => {
      const x = v / L;
      return x < 10 ? String(roundNice(x, 0.5)).replace(/\.0$/, "") : String(Math.round(x));
    };
    const crore = (v) => (v / CR).toFixed(v / CR >= 10 ? 0 : 1).replace(/\.0$/, "");
    if (high < CR) return `₹${lakh(low)}–${lakh(high)} L`;
    if (low >= CR) return `₹${crore(low)}–${crore(high)} Cr`;
    return `₹${lakh(low)} L–${crore(high)} Cr`;
  }

  function fmtK(v) {
    const k = v / 1000;
    if (k >= 1000) return (k / 1000).toFixed(k >= 10000 ? 0 : 1).replace(/\.0$/, "") + "M";
    return String(k < 200 ? roundNice(k, 5) : roundNice(k, 10)) + "k";
  }

  function fmtRange(currency, low, high) {
    if (currency === "INR") return fmtINR(low, high);
    return `${SYMBOL[currency] || currency + " "}${fmtK(low)}–${fmtK(high)}`;
  }

  function fmtOne(currency, v) {
    if (currency === "INR") return v >= 1e7 ? `₹${(v / 1e7).toFixed(1).replace(/\.0$/, "")} Cr` : `₹${Math.round(v / 1e5 * 2) / 2} L`;
    return `${SYMBOL[currency] || currency + " "}${fmtK(v)}`;
  }

  window.Ballpark.engine = { fmtOne, resolvePerson, estimate, parseHeadline, fmtRange, marketOf, levelOf, familyOf, tierOf };
})();
