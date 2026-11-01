// Right-click menu: "Estimate pay with Ballpark" on any LinkedIn profile link.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ballpark-person",
    title: "Estimate pay with Ballpark",
    contexts: ["link"],
    documentUrlPatterns: ["https://*.linkedin.com/*"],
    targetUrlPatterns: ["https://*.linkedin.com/in/*"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ballpark-person" && tab && tab.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: "ballpark-person", url: info.linkUrl });
  }
});
