"""Content images on indexable pages carry descriptive alt text.

An empty alt is only allowed where it is deliberate: the image repeats a
visible heading or label in the same link/button, or it is an unbound
placeholder that is never shown.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNLISTED_BUILD_PAGES = {"chair-travel-case", "deck-appliance-cabinet"}

# Classes whose images are decorative duplicates or empty CMS placeholders.
DECORATIVE_CLASSES = (
    "vimeo-player__placeholder",  # unbound Vimeo poster slots (w-dyn-bind-empty)
    "home_feature-2_image",  # research cards: the card heading names the article
    "goods-image--alternate",  # shop hover image; the primary image is described
)


def indexable_pages():
    for path in sorted(ROOT.rglob("*.html")):
        relative = path.relative_to(ROOT)
        if relative.parts[0] in UNLISTED_BUILD_PAGES or relative.as_posix() == "404.html":
            continue
        source = path.read_text(encoding="utf-8")
        if "data-legacy-redirect" in source or re.search(r'<meta name="robots" content="noindex', source):
            continue
        yield relative.as_posix(), source


class ImageAltTextTests(unittest.TestCase):
    def test_content_images_have_alt_text(self) -> None:
        missing = []
        for relative, source in indexable_pages():
            for match in re.finditer(r"<img\b[^>]*>", source, re.S):
                tag = match.group(0)
                alt = re.search(r'\balt="([^"]*)"', tag)
                if alt is None:
                    missing.append(f"{relative}: no alt: {tag[:120]}")
                    continue
                if alt.group(1).strip():
                    continue
                classes = (re.search(r'\bclass="([^"]*)"', tag) or [None, ""])[1]
                if any(name in classes for name in DECORATIVE_CLASSES):
                    continue
                if "data-summary-image" in tag:  # order summary, beside the product link
                    continue
                before = source[max(0, match.start() - 600):match.start()]
                if re.search(r'<button\b[^>]*\baria-label="[^"]+"[^>]*>\s*$', before):
                    continue  # gallery thumbnail inside a labelled button
                missing.append(f"{relative}: empty alt: {tag[:120]}")
        self.assertEqual(missing, [])

    def test_alt_text_does_not_mention_prices(self) -> None:
        for relative, source in indexable_pages():
            for alt in re.findall(r'<img\b[^>]*\balt="([^"]*)"', source):
                self.assertNotRegex(alt, r"\$\s?\d", relative)


if __name__ == "__main__":
    unittest.main()
