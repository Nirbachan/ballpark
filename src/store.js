// Settings and feedback, stored locally in Chrome. Nothing leaves the browser.
window.Ballpark = window.Ballpark || {};

(function () {
  const hasChrome = typeof chrome !== "undefined" && chrome.storage;
  const DEFAULTS = { personMode: true };
  let settings = { ...DEFAULTS };
  const listeners = [];

  let profiles = {};
  let saveTimer = null;

  function load() {
    if (!hasChrome) return Promise.resolve(settings);
    return Promise.all([
      chrome.storage.sync.get(DEFAULTS).then((s) => (settings = s)),
      chrome.storage.local.get("profiles").then((r) => (profiles = r.profiles || {}))
    ]);
  }

  // Current roles read from profiles you have opened, keyed by profile slug.
  function saveProfile(slug, data) {
    if (!slug) return;
    const prev = profiles[slug] || {};
    const next = { ...prev, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v)), at: Date.now() };
    if (JSON.stringify({ ...prev, at: 0 }) === JSON.stringify({ ...next, at: 0 })) return;
    profiles[slug] = next;
    const keys = Object.keys(profiles);
    if (keys.length > 3000) keys.sort((a, b) => profiles[a].at - profiles[b].at).slice(0, keys.length - 3000).forEach((k) => delete profiles[k]);
    clearTimeout(saveTimer);
    if (hasChrome) saveTimer = setTimeout(() => chrome.storage.local.set({ profiles }), 800);
  }

  if (hasChrome) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const k in changes) settings[k] = changes[k].newValue;
      listeners.forEach((fn) => fn(settings));
    });
  }

  async function addFeedback(row) {
    if (!hasChrome) return;
    const { feedback = [] } = await chrome.storage.local.get("feedback");
    feedback.push({ ...row, at: new Date().toISOString() });
    await chrome.storage.local.set({ feedback: feedback.slice(-2000) });
  }

  window.Ballpark.store = {
    load, addFeedback, saveProfile,
    getProfile: (slug) => profiles[slug] || null,
    get: () => settings,
    onChange: (fn) => listeners.push(fn)
  };
})();
