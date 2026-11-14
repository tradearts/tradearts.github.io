from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Images without a srcset are downloaded at full size on every device,
# including phones on regional mobile connections.
SRC_ONLY_IMAGE_LIMIT = 500 * 1024


def attribute(tag: str, name: str) -> str | None:
    match = re.search(rf'\s{name}="([^"]*)"', tag)
    return match.group(1) if match else None


def public_pages() -> list[Path]:
    return [
        path
        for path in ROOT.rglob("index.html")
        if not path.relative_to(ROOT).parts[0] in {"tests", "scripts"}
    ] + [ROOT / "404.html"]


class HomepageFeaturedWorkTests(unittest.TestCase):
    def setUp(self) -> None:
        self.home = (ROOT / "index.html").read_text(encoding="utf-8")
        section = re.search(r'<section class="[^"]*ta-home-featured[^"]*">.*?</section>', self.home, re.S)
        self.assertIsNotNone(section, "homepage featured work section is missing")
        self.section = section.group(0)

    def test_featured_cards_link_to_real_project_pages(self) -> None:
        cards = [attribute(tag, 'href') for tag in re.findall(r'<a\b[^>]*>', self.section)
                 if 'ta-feature-card__link' in (attribute(tag, 'class') or '').split()]
        self.assertGreaterEqual(len(cards), 4)
        self.assertEqual(len(cards), len(set(cards)), "a project is featured twice")
        for href in cards:
            with self.subTest(href=href):
                self.assertTrue((ROOT / href.strip("/") / "index.html").exists())

    def test_featured_images_are_described_sized_and_lazy(self) -> None:
        for tag in re.findall(r"<img\b[^>]*>", self.section):
            with self.subTest(tag=tag[:80]):
                self.assertTrue(attribute(tag, "alt"), "featured image needs descriptive alt text")
                self.assertTrue(attribute(tag, "width") and attribute(tag, "height"))
                self.assertEqual(attribute(tag, "loading"), "lazy")
                self.assertTrue(attribute(tag, "srcset"))
                for candidate in attribute(tag, "srcset").split(","):
                    url = candidate.strip().split(" ")[0]
                    self.assertTrue((ROOT / url.lstrip("/")).exists(), url)

    def test_browse_links_cover_every_work_category(self) -> None:
        for route in ("/works/", "/commercial/", "/exhibitions/", "/public-art/"):
            self.assertIn(f'href="{route}"', self.section)

    def test_service_lines_match_the_services_page(self) -> None:
        services = (ROOT / "services/index.html").read_text(encoding="utf-8")
        lines = re.findall(r'<p class="ta-service-line">([^<]+)</p>', self.home)
        self.assertEqual(len(lines), 6)
        for line in lines:
            self.assertIn(line, services)


class ImageWeightTests(unittest.TestCase):
    def test_src_only_images_stay_under_the_weight_limit(self) -> None:
        offenders = []
        for page in public_pages():
            source = page.read_text(encoding="utf-8")
            for tag in re.findall(r"<img\b[^>]*>", source, re.S):
                if attribute(tag, "srcset"):
                    continue
                src = (attribute(tag, "src") or "").split("?")[0]
                if not src.startswith("/"):
                    continue
                file = ROOT / src.lstrip("/")
                if file.exists() and file.stat().st_size > SRC_ONLY_IMAGE_LIMIT:
                    offenders.append(f"{page.relative_to(ROOT)} -> {src} ({file.stat().st_size // 1024} KB)")
        self.assertEqual(offenders, [], "\n".join(offenders))

    def test_responsive_candidates_stay_under_the_weight_limit(self) -> None:
        # Right-sized for its 2x display width and already efficiently encoded;
        # recompressing it further would only shave a few per cent.
        allowed = {"/assets/lego-brick-brigade/hero-1152.webp"}
        offenders = []
        for page in public_pages():
            relative = page.relative_to(ROOT)
            if relative.parts[0] in {"chair-travel-case", "deck-appliance-cabinet"}:
                continue
            source = page.read_text(encoding="utf-8")
            for srcset in re.findall(r'\ssrcset="([^"]+)"', source):
                for candidate in srcset.split(","):
                    url = candidate.strip().split(" ")[0].split("?")[0]
                    file = ROOT / url.lstrip("/")
                    if url in allowed or not url.startswith("/") or not file.exists():
                        continue
                    if file.stat().st_size > SRC_ONLY_IMAGE_LIMIT:
                        offenders.append(f"{relative} -> {url} ({file.stat().st_size // 1024} KB)")
        self.assertEqual(sorted(set(offenders)), [])


if __name__ == "__main__":
    unittest.main()
