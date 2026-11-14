"""Regression checks for the October 2026 design/SEO/AEO audit changes."""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.tradearts.work"
# Hand-built noindex pages published exactly as committed (see normalize_site.py).
UNLISTED_BUILD_PAGES = {"chair-travel-case", "deck-appliance-cabinet"}


def graph(path: Path) -> list[dict]:
    source = path.read_text(encoding="utf-8")
    block = re.search(r'<script type="application/ld\+json">\s*(.*?)\s*</script>', source, re.S)
    return json.loads(block.group(1))["@graph"]


class AuditImprovementTests(unittest.TestCase):
    def test_organization_is_a_local_business_with_visible_address(self) -> None:
        org = next(n for n in graph(ROOT / "index.html") if n["@id"] == SITE + "/#organization")
        self.assertIn("LocalBusiness", org["@type"])
        self.assertEqual(org["address"]["postalCode"], "2482")
        contact = (ROOT / "contact/index.html").read_text(encoding="utf-8")
        self.assertIn(org["address"]["streetAddress"], contact)
        self.assertTrue(org["logo"].endswith("trade-arts.png"))

    def test_faq_markup_only_repeats_visible_questions(self) -> None:
        for route in ("info", "services"):
            path = ROOT / route / "index.html"
            source = path.read_text(encoding="utf-8")
            faq = next(n for n in graph(path) if n["@type"] == "FAQPage")
            self.assertGreaterEqual(len(faq["mainEntity"]), 4)
            for question in faq["mainEntity"]:
                self.assertIn(question["name"].replace("'", "&#x27;"), source.replace("'", "&#x27;"))
                self.assertTrue(question["acceptedAnswer"]["text"])

    def test_no_page_uses_the_logo_as_its_share_image(self) -> None:
        for path in ROOT.rglob("*.html"):
            if path.relative_to(ROOT).parts[0] in UNLISTED_BUILD_PAGES:
                continue
            source = path.read_text(encoding="utf-8")
            match = re.search(r'property="og:image" content="([^"]+)"', source)
            if match:
                self.assertFalse(match.group(1).endswith("trade-arts.png"), path)
        self.assertTrue((ROOT / "assets/social/trade-arts-workshop-1200x630.jpg").is_file())

    def test_service_pages_link_to_related_research(self) -> None:
        for path in (ROOT / "services").glob("*/index.html"):
            source = path.read_text(encoding="utf-8")
            self.assertEqual(source.count('class="ta-related-research"'), 1, path)
            for href in re.findall(r'ta-related-research.*?</section>', source, re.S)[0:1]:
                for link in re.findall(r'href="(/blog/[^"]+)"', href):
                    self.assertTrue((ROOT / link.strip("/") / "index.html").is_file(), link)

    def test_headings_use_self_hosted_outfit(self) -> None:
        css = (ROOT / "assets/site-fixes.css").read_text(encoding="utf-8")
        self.assertIn('--_typography---font-styles--heading: "Outfit"', css)
        for weight in ("600", "700"):
            self.assertTrue((ROOT / f"assets/fonts/outfit-latin-{weight}-normal.woff2").is_file())

    def test_consent_banner_docks_bottom_left_on_desktop_and_stays_compact_on_mobile(self) -> None:
        css = (ROOT / "assets/site-fixes.css").read_text(encoding="utf-8")
        desktop = re.search(r"^\.consent-banner \{([^}]+)\}", css, re.M).group(1)
        self.assertRegex(desktop, r"position:\s*fixed")
        self.assertRegex(desktop, r"right:\s*auto")
        self.assertRegex(desktop, r"left:\s*1rem")
        self.assertRegex(desktop, r"bottom:\s*1rem")
        width = float(re.search(r"max-width:\s*([\d.]+)rem", desktop).group(1))
        self.assertLessEqual(width * 16, 430)
        mobile = re.search(r"@media \(max-width: 767px\) \{\s*\.consent-banner \{([^}]+)\}", css).group(1)
        self.assertRegex(mobile, r"left:\s*\.5rem")
        self.assertRegex(mobile, r"right:\s*\.5rem")
        self.assertRegex(mobile, r"padding:\s*\.85rem")
        consent = (ROOT / "assets/consent.js").read_text(encoding="utf-8")
        self.assertIn('data-choice="denied"', consent)
        self.assertIn('data-choice="granted"', consent)
        self.assertIn("keepFocusInside", consent)

    def test_footer_phone_is_tappable(self) -> None:
        source = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="tel:+61431802800"', source)

    def test_unlisted_build_pages_stay_noindex_and_out_of_the_sitemap(self) -> None:
        import sys
        sys.path.insert(0, str(ROOT / "scripts"))
        import normalize_site

        self.assertEqual(normalize_site.UNLISTED_BUILD_PAGES, UNLISTED_BUILD_PAGES)
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        for route in UNLISTED_BUILD_PAGES:
            source = (ROOT / route / "index.html").read_text(encoding="utf-8")
            self.assertRegex(source, r'<meta name="robots" content="noindex')
            self.assertNotIn(f"/{route}/", sitemap)


if __name__ == "__main__":
    unittest.main()
