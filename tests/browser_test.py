"""Hover tests on LinkedIn-shaped pages. Run: pip install playwright && playwright install chromium && python3 tests/browser_test.py"""
import functools, http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = os.path.join(ROOT, "tests", "pages")
FILES = ["data", "engine", "store", "adapter", "ui", "person", "main"]
CARD = "() => { const h=document.querySelector('[data-ballpark=card]'); const c=h&&h.shadowRoot.querySelector('.card'); return c&&!c.hidden ? c.innerText : ''; }"

# (page, element id, text the card must contain; None = no card expected)
CASES = [
    ("/in/arjun-n/", "name", "Senior Instructional Designer, Byju's"),
    ("/in/arjun-n/", "photo", "Senior Instructional Designer, Byju's"),
    ("/in/arjun-n/", "contact", None),
    ("/in/meera-k/", "self", "Senior Manager, Human Capital, Deloitte"),
    ("/feed/", "factor", "Talent Acquisition Lead, Razorpay"),
    ("/feed/", "fphoto", "Talent Acquisition Lead, Razorpay"),
    ("/feed/", "mention", "Not enough to estimate"),
    ("/search/results/people/", "u1", "Instructional Designer"),
    ("/search/results/people/", "u2", "Learning Designer, Swiggy"),
    ("/search/results/people/", "u3", "Talent Acquisition, Razorpay"),
    ("/search/results/people/", "u4", "Not enough to estimate"),
]
PILLS = ["₹36–46 L", "₹18–38 L", "AED 460k–580k", "₹10–15 L"]

def main():
    H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=PAGES)
    H.log_message = lambda *a: None
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", 0), H)
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    failures = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        def open_page(path):
            pg = b.new_page(viewport={"width": 1100, "height": 760})
            pg.goto(base + path)
            for f in FILES: pg.add_script_tag(path=os.path.join(ROOT, "src", f + ".js"))
            pg.wait_for_timeout(500)
            pg.evaluate("window.Ballpark.store.get().personMode = true")
            return pg
        pages = {}
        for path, el, expect in CASES:
            pg = pages.get(path) or pages.setdefault(path, open_page(path))
            pg.mouse.move(1080, 740); pg.wait_for_timeout(350)
            pg.hover("#" + el); pg.wait_for_timeout(800)
            text = pg.evaluate(CARD)
            ok = (not text) if expect is None else (expect in text)
            failures += not ok
            print(("PASS" if ok else "FAIL"), f"{path} #{el}", "" if ok else f"-> got: {text[:120]!r}")
        pg = open_page("/jobs/search/")
        pills = pg.evaluate("[...document.querySelectorAll('[data-ballpark=pill]')].map(h=>h.shadowRoot.querySelector('.pill').innerText)")
        for want in PILLS:
            ok = any(want in x for x in pills); failures += not ok
            print(("PASS" if ok else "FAIL"), "job pill", want)
        b.close()
    srv.shutdown()
    print(f"\n{'All passed' if not failures else str(failures) + ' failed'}")
    sys.exit(1 if failures else 0)

if __name__ == "__main__":
    main()
