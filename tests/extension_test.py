"""Loads the real extension in Chromium on LinkedIn URLs (served from tests/pages) and checks name hover,
the hover setting, right-click, diagnostics and job pills end to end.
Run: pip install playwright && playwright install chromium && python3 tests/extension_test.py"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *x: os.path.join(ROOT, "tests", "pages", *x)
PAGES = {
    "https://www.linkedin.com/feed/": P("feed", "index.html"),
    "https://www.linkedin.com/search/results/people/": P("search", "results", "people", "index.html"),
    "https://www.linkedin.com/in/arjun-n/": P("in", "arjun-n", "index.html"),
    "https://www.linkedin.com/in/aakash-r/": P("in", "aakash-r", "index.html"),
    "https://www.linkedin.com/jobs/search/": P("jobs", "search", "index.html"),
    "https://www.linkedin.com/jobs/collections/": P("extra.html"),
}
CARD = "() => { const h=document.querySelector('[data-ballpark=card]'); const c=h&&h.shadowRoot.querySelector('.card'); return c&&!c.hidden ? c.innerText : ''; }"
HOVERS = [  # (url, selector, expected text; None = no card)
    ("https://www.linkedin.com/feed/", "#factor", "Talent Acquisition Lead, Razorpay"),
    ("https://www.linkedin.com/feed/", "#fphoto", "Talent Acquisition Lead, Razorpay"),
    ("https://www.linkedin.com/feed/", "#mention", "Not enough to estimate"),
    ("https://www.linkedin.com/search/results/people/", "#u1", "Instructional Designer"),
    ("https://www.linkedin.com/search/results/people/", "#u2", "Learning Designer, Swiggy"),
    ("https://www.linkedin.com/in/arjun-n/", "#name", "Senior Instructional Designer, Byju's"),
    ("https://www.linkedin.com/in/arjun-n/", "#photo", "Senior Instructional Designer, Byju's"),
    ("https://www.linkedin.com/in/arjun-n/", "#contact", None),
    ("https://www.linkedin.com/jobs/collections/", "#host >> #sh", "Senior Product Manager, Flipkart"),
    ("https://www.linkedin.com/jobs/collections/", "#hire", "Talent Acquisition Manager, Swiggy"),
]

def main():
    fails = 0
    def check(name, ok, got=""):
        nonlocal fails
        fails += not ok
        print("PASS" if ok else "FAIL", name, "" if ok else f"-> {got[:120]!r}")
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), headless=False, channel="chromium",
            args=["--headless=new", f"--disable-extensions-except={ROOT}", f"--load-extension={ROOT}"], viewport={"width": 1100, "height": 760})
        def route(r):
            f = PAGES.get(r.request.url.split("?")[0])
            r.fulfill(status=200, content_type="text/html", body=open(f).read()) if f else r.fulfill(status=204, body="")
        ctx.route("https://*.linkedin.com/**", route)
        sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker")
        pg = ctx.new_page()

        # Real-LinkedIn profile structure: name link with an internal ID, "· 1st", no heading, late Experience.
        pg.goto("https://www.linkedin.com/in/aakash-r/"); pg.wait_for_timeout(800)
        pg.hover("#name"); pg.wait_for_timeout(900)
        got = pg.evaluate(CARD)
        check("hover is on by default (fresh install)", bool(got), got)
        check("'· 1st' is never read as a headline", "1st" not in got.split("\n")[1] if got else False, got)
        pg.mouse.move(1080, 740); pg.wait_for_timeout(400)
        pg.evaluate("loadExperience()"); pg.wait_for_timeout(800)
        pg.hover("#name"); pg.wait_for_timeout(900)
        got = pg.evaluate(CARD); check("profile reads late-loading Experience", "Senior Manager, Learning & Development, Swiggy" in got, got)

        pg.goto("https://www.linkedin.com/feed/"); pg.wait_for_timeout(800)
        sw.evaluate("chrome.storage.sync.set({personMode: false})"); pg.wait_for_timeout(300)
        pg.hover("#factor"); pg.wait_for_timeout(900)
        check("switching hover off stops cards", pg.evaluate(CARD) == "", pg.evaluate(CARD))
        pg.mouse.move(1080, 740); pg.wait_for_timeout(400)

        sw.evaluate("chrome.storage.sync.set({personMode: true})")
        for url, sel, want in HOVERS:
            if pg.url.split("?")[0] != url: pg.goto(url); pg.wait_for_timeout(800)
            pg.mouse.move(1080, 740); pg.wait_for_timeout(400)
            pg.locator(sel).hover(); pg.wait_for_timeout(900)
            got = pg.evaluate(CARD)
            check(f"hover {url.split('.com')[1]} {sel}", (got == "") if want is None else (want in got), got)

        sw.evaluate("chrome.storage.sync.set({personMode: false})")
        pg.goto("https://www.linkedin.com/search/results/people/"); pg.wait_for_timeout(800)
        pg.dispatch_event("#u3", "contextmenu")
        tab = sw.evaluate("chrome.tabs.query({active:true}).then(t => t[0].id)")
        sw.evaluate(f"chrome.tabs.sendMessage({tab}, {{type:'ballpark-person', url:'https://www.linkedin.com/in/ria-m/'}})"); pg.wait_for_timeout(600)
        got = pg.evaluate(CARD); check("right-click works with hover off", "Talent Acquisition, Razorpay" in got, got)
        menu = sw.evaluate("new Promise(r => chrome.contextMenus.update('ballpark-person', {}, () => r(!chrome.runtime.lastError)))")
        check("right-click menu item registered", menu)

        pg.hover("#u1"); pg.wait_for_timeout(300)
        rep = sw.evaluate(f"chrome.tabs.sendMessage({tab}, {{type:'ballpark-diagnose'}})")
        check("diagnostics report returned", bool(rep and rep.get("detectedAs") == "A"), str(rep)[:120])
        check("diagnostics masks names", "Sana" not in (rep or {}).get("markup", ""))

        pg.goto("https://www.linkedin.com/jobs/search/"); pg.wait_for_timeout(1000)
        n = pg.evaluate("document.querySelectorAll('[data-ballpark=pill]').length"); check("job pills render", n == 4, str(n))
        ctx.close()
    print("\nAll passed" if not fails else f"\n{fails} failed"); sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
