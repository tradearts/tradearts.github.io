"""llms.txt stays a short, factual pointer to pages that exist."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.tradearts.work"


class LlmsTxtTests(unittest.TestCase):
    def setUp(self) -> None:
        self.text = (ROOT / "llms.txt").read_text(encoding="utf-8")

    def test_links_point_to_indexed_pages(self) -> None:
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        links = re.findall(r"\]\((https://www\.tradearts\.work/[^)]*)\)", self.text)
        self.assertGreaterEqual(len(links), 20)
        for url in links:
            self.assertIn(f"<loc>{url}</loc>", sitemap, url)
            self.assertTrue((ROOT / url.removeprefix(SITE + "/") / "index.html").is_file(), url)

    def test_contact_details_match_the_site(self) -> None:
        contact = (ROOT / "contact/index.html").read_text(encoding="utf-8")
        self.assertIn("Unit 1/24 Towers Drive", contact)
        self.assertIn("Unit 1/24 Towers Drive, Mullumbimby NSW 2482", self.text)
        self.assertIn("info@tradearts.work", self.text)
        self.assertIn("0431 802 800", self.text)

    def test_no_prices_or_rates(self) -> None:
        self.assertNotRegex(self.text, r"\$\s?\d|per hour|/hr|hourly")

    def test_unlisted_build_pages_are_not_mentioned(self) -> None:
        for route in ("chair-travel-case", "deck-appliance-cabinet"):
            self.assertNotIn(route, self.text)


if __name__ == "__main__":
    unittest.main()
