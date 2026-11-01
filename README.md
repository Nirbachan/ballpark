# Ballpark

A Chrome extension that shows estimated salary ranges on LinkedIn.

- **Right-click any person's name or photo** and choose "Estimate pay with Ballpark", or turn on name hover in the Ballpark menu, to see an estimated pay range for their role, in their local currency, with the INR equivalent for anyone outside India.
- **Glance at any job listing** to see a small pill with the estimated range. Hover the pill to see how it was estimated and open real salary data on AmbitionBox, Glassdoor, Levels.fyi, 6figr or Reddit.

It estimates pay for a **role**, never what a specific person earns.

## How the estimate works

```
midpoint = market band[level] × role family × employer tier × city premium
range    = midpoint ± spread, where spread widens as confidence falls
```

Bands are anchored in each market's own currency (India in INR, UAE in AED, and so on) instead of scaling US figures, so India's gap between IT services and product companies is modelled directly.

**Signal strength** (strong, partial, weak) says how much the title, employer and location told the model. It is not accuracy. Accuracy comes only from validation, below, and once measured it is shown on every card.

Every figure states what it includes: CTC in India, total pay elsewhere, and "includes stock" where top employers pay a large share in equity.

When a headline states no role or seniority, Ballpark says so instead of guessing.

## Privacy and scope

- Runs entirely in your browser. No server, no analytics, no network requests. Settings and feedback are stored locally in Chrome.
- Person hover is off by default: a range next to someone's name can read as a claim about them.
- Reads only what LinkedIn has already shown on your screen. Never crawls, scrolls or clicks.
- Salary sites are never scraped. The source links open a normal search you choose to follow.
- A personal research prototype, not published to the Chrome Web Store.

## Install

1. Download and unzip. Open `chrome://extensions` and turn on Developer mode.
2. Click **Load unpacked** and select the folder containing `manifest.json`.
3. Refresh any open LinkedIn tabs.

## Tests

Run these before every release:

- `node tests/validate.js`: accuracy against salaries you know
- `python3 tests/extension_test.py`: loads the real extension in Chromium on LinkedIn addresses and checks hover, the hover setting, right-click, diagnostics and job pills end to end
- `python3 tests/browser_test.py`: hover and pill checks on LinkedIn-shaped pages in `tests/pages/` (needs `pip install playwright` and `playwright install chromium`)

When LinkedIn changes its layout and something breaks, save a copy of the broken markup into `tests/pages/` and add a case, so it stays fixed.

## Tuning

All numbers live in `src/data.js`: market bands, role families, levels, employer tiers, city premiums and exchange rates. No other file needs changing to recalibrate. LinkedIn selectors live only in `src/adapter.js`.

## Validation

Two ways to measure accuracy:

1. **Known salaries.** Add rows to `tests/validation.csv`, then run `node tests/validate.js`. It reports the share of real salaries inside the range (target 70%), the worst miss (limit 2x), bias, results by market, signal and employer tier, and the biggest misses. It also prints a `CALIBRATION` line to paste into `src/data.js`, so every card shows its measured hit rate.
2. **Feedback while browsing.** Every card asks "Was this close?". Results appear in the Ballpark menu and export as CSV.

Results so far:

| Measure | Result |
|---|---|
| Salaries tested | |
| Inside range | |
| Worst miss | |
