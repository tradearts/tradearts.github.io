from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

LEGACY_REDIRECTS = {
    "work/superfun-console/index.html": "/commercial-project/superfun-console/",
    "work/up-there-x-new-balance/index.html": "/commercial-project/up-there-x-new-balance/",
    "work/reindeer-lights/index.html": "/exhibition/reindeer-lights/",
    "work/helicopter-display-models/index.html": "/exhibition/helicopter-display-models/",
    "work/pterodactyl/index.html": "/exhibition/pterodactyl/",
    "work/bunya-cone-replica/index.html": "/exhibition/bunya-cone-replica/",
    "work/australian-museum-spiders/index.html": "/exhibition/australian-museum-spiders/",
    "work/real-madrid-world-of-football/index.html": "/exhibition/real-madrid-world-of-football/",
    "work/reserve-bank-museum-nz/index.html": "/exhibition/reserve-bank-museum-nz/",
    "work/madiba/index.html": "/exhibition/madiba/",
    "work/promhouse/index.html": "/exhibition/promhouse/",
    "work/revitalise-coffs-harbour/index.html": "/public-art/revitalise-coffs-harbour/",
}


class SafeFixTests(unittest.TestCase):
    def test_legacy_routes_have_accessible_redirect_pages(self) -> None:
        for relative, destination in LEGACY_REDIRECTS.items():
            with self.subTest(relative=relative):
                source = (ROOT / relative).read_text(encoding="utf-8")
                absolute = "https://www.tradearts.work" + destination
                self.assertIn(f'<link rel="canonical" href="{absolute}">', source)
                self.assertIn('content="noindex, follow"', source)
                self.assertRegex(source, rf'http-equiv="refresh"[^>]+url={re.escape(destination)}')
                self.assertIn(f'href="{destination}"', source)
                self.assertIn("Skip to content", source)

    def test_research_archive_links_every_article_without_fake_pagination(self) -> None:
        source = (ROOT / "research/index.html").read_text(encoding="utf-8")
        article_routes = {
            "/" + path.parent.relative_to(ROOT).as_posix() + "/"
            for path in (ROOT / "blog").glob("*/index.html")
        }
        linked_routes = set(re.findall(r'href="(/blog/[^"?#]+/)"', source))
        self.assertEqual(linked_routes, article_routes)
        self.assertNotIn("3be7f81f_page", source)
        self.assertNotIn("w-pagination-next", source)

    def test_skip_link_focus_rule_forces_link_onscreen(self) -> None:
        css = (ROOT / "assets/site-fixes.css").read_text(encoding="utf-8")
        focus_rule = re.search(r"\.skip-link:focus(?:-visible)?[^}]*\{([^}]+)\}", css, re.S)
        if focus_rule is None:
            self.fail("Missing skip-link focus rule")
        declarations = focus_rule.group(1)
        self.assertRegex(declarations, r"transform\s*:\s*none\s*!important")
        self.assertRegex(declarations, r"top\s*:\s*[^;]+")

    def test_public_phone_schema_is_valid_and_unmasked(self) -> None:
        for path in [ROOT / "index.html", ROOT / "scripts/normalize_site.py"]:
            source = path.read_text(encoding="utf-8")
            self.assertNotIn("****", source)
            self.assertIn("+61431802800", source)

    def test_blog_carousel_dependency_is_immutably_pinned(self) -> None:
        commit = "00901b9ce10eaecfd8279350da06e5a5a246c1ac"
        for path in (ROOT / "blog").glob("*/index.html"):
            source = path.read_text(encoding="utf-8")
            self.assertNotIn("splide@main", source)
            self.assertIn(f"splide@{commit}", source)

    def test_shop_pages_do_not_claim_ineffective_cache_headers(self) -> None:
        for path in (ROOT / "shop").rglob("*.html"):
            source = path.read_text(encoding="utf-8")
            self.assertNotRegex(source, r'<meta\s+http-equiv="Cache-Control"')

    def test_scanning_workflow_describes_scanning_not_printing(self) -> None:
        source = (ROOT / "services/3d-scanning/index.html").read_text(encoding="utf-8")
        section = source.split(">How we work<", 1)[1].split(">Technical capabilities<", 1)[0]
        self.assertNotIn("3D Printing &amp; CNC", section)
        for phrase in ["Project review", "Capture", "Scan alignment", "Quality check", "File delivery"]:
            self.assertIn(phrase, section)

    def test_tracking_pages_initialise_consent_before_google(self) -> None:
        consent = (ROOT / "assets/consent.js").read_text(encoding="utf-8")
        for storage in ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"]:
            self.assertRegex(consent, rf"{storage}['\"]?\s*:\s*['\"]denied")
        self.assertIn("Essential only", consent)
        self.assertIn("Accept analytics", consent)
        self.assertRegex(consent, r"analytics_storage\s*:\s*analyticsChoice\s*===\s*GRANTED\s*\?\s*['\"]granted")
        for storage in ["ad_storage", "ad_user_data", "ad_personalization"]:
            self.assertNotRegex(consent, rf"{storage}['\"]?\s*:\s*['\"]granted")
        self.assertIn("data-consent", consent)
        tracking_pages = 0
        for path in ROOT.rglob("*.html"):
            source = path.read_text(encoding="utf-8")
            if "a03713ff8717-lb9e6lq19p-1.1.1.js" not in source:
                continue
            tracking_pages += 1
            consent_at = source.find('/assets/consent.js')
            analytics_at = source.find("a03713ff8717-lb9e6lq19p-1.1.1.js")
            self.assertGreaterEqual(consent_at, 0, path.as_posix())
            self.assertLess(consent_at, analytics_at, path.as_posix())
            self.assertNotIn("googletagmanager.com", source, path.as_posix())
            self.assertNotIn("google_tags_first_party", source, path.as_posix())
            analytics_tags = re.findall(r'<script[^>]*a03713ff8717[^>]*>', source)
            self.assertEqual(len(analytics_tags), 1, path.as_posix())
            self.assertIn('type="text/plain"', analytics_tags[0], path.as_posix())
            self.assertIn('data-consent="analytics"', analytics_tags[0], path.as_posix())
        self.assertGreater(tracking_pages, 40)

    def test_research_articles_sort_by_real_date(self) -> None:
        from scripts.normalize_site import sort_archive_articles

        articles = [
            {"slug": "dec", "date": "2 December 2025", "title": "December"},
            {"slug": "jan", "date": "15 January 2026", "title": "January"},
            {"slug": "nov", "date": "28 November 2025", "title": "November"},
        ]
        ordered = sort_archive_articles(articles)
        self.assertEqual([article["slug"] for article in ordered], ["jan", "dec", "nov"])

    def test_shop_uses_optimised_assets_within_transfer_budget(self) -> None:
        replacements = {
            "workshop-gloves-1.png": "workshop-gloves-1-optimised.webp",
            "hivis-ta-hoodie-1.png": "hivis-ta-hoodie-1-optimised.webp",
            "hivis-ta-hoodie-2.png": "hivis-ta-hoodie-2-optimised.webp",
            "tool-tape-measure-skate-v1.png": "tool-tape-measure-skate-v1-optimised.webp",
            "tool-bolt-skate-v1.png": "tool-bolt-skate-v1-optimised.webp",
            "tool-spanner-skate-v1.png": "tool-spanner-skate-v1-optimised.webp",
            "tool-hammer-skate-v1.png": "tool-hammer-skate-v1-optimised.webp",
            "tool-screwdriver-skate-v1.png": "tool-screwdriver-skate-v1-optimised.webp",
            "shop-hero-worker-painting-v1.jpg": "shop-hero-worker-painting-v1-optimised.webp",
        }
        searchable = [*ROOT.joinpath("shop").rglob("*.html"), *ROOT.joinpath("shop").rglob("*.css"), *ROOT.joinpath("shop").rglob("*.js")]
        combined = "\n".join(path.read_text(encoding="utf-8") for path in searchable)
        image_root = ROOT / "shop/assets/images"
        for original, optimised in replacements.items():
            self.assertNotIn(f"/shop/assets/images/{original}", combined)
            image = image_root / optimised
            self.assertTrue(image.exists(), optimised)
            budget = 160_000 if optimised.startswith("shop-hero") else 300_000
            self.assertLess(image.stat().st_size, budget, optimised)
        shop_home = (ROOT / "shop/index.html").read_text(encoding="utf-8")
        gloves_tag = re.search(r'<img[^>]+workshop-gloves-1-optimised\.webp[^>]*>', shop_home)
        if gloves_tag is None:
            self.fail("Missing optimised gloves image")
        self.assertIn('loading="lazy"', gloves_tag.group(0))

    def test_contact_form_captures_basic_project_qualifiers(self) -> None:
        source = (ROOT / "contact/index.html").read_text(encoding="utf-8")
        for field in ["project_type", "company", "location", "target_date", "budget_range"]:
            self.assertRegex(source, rf'name="{field}"')
        self.assertIn("We usually reply within two business days", source)
        self.assertIn('href="/privacy/"', source)

    def test_shared_stylesheet_is_loaded_once_per_page(self) -> None:
        for path in ROOT.rglob("*.html"):
            source = path.read_text(encoding="utf-8")
            self.assertEqual(source.count("/assets/site-fixes.css"), 1, path.as_posix())

    def test_privacy_notice_matches_consent_and_contact_collection(self) -> None:
        source = (ROOT / "privacy/index.html").read_text(encoding="utf-8")
        self.assertIn("optional analytics", source.lower())
        self.assertIn("Privacy settings", source)
        self.assertIn("project type, location, target date and indicative budget", source)


if __name__ == "__main__":
    unittest.main()
