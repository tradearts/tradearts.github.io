#!/usr/bin/env python3
"""Fail on broken links, redirecting canonicals and recurring export defects."""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.tradearts.work"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, dict[str, str]]] = []
        self.images: list[dict[str, str]] = []
        self.iframes: list[dict[str, str]] = []
        self.metas: list[dict[str, str]] = []
        self.canonicals: list[str] = []
        self.main_ids: list[str] = []
        self.ids: list[str] = []
        self.h1_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): (value or "") for key, value in attrs}
        tag = tag.lower()
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "a":
            self.links.append((values.get("href", ""), values))
        elif tag == "img":
            self.images.append(values)
        elif tag == "iframe":
            self.iframes.append(values)
        elif tag == "meta":
            self.metas.append(values)
        elif tag == "link" and "canonical" in values.get("rel", "").lower().split():
            self.canonicals.append(values.get("href", ""))
        elif tag == "main" or values.get("role", "").lower() == "main":
            self.main_ids.append(values.get("id", ""))
        elif tag == "h1":
            self.h1_count += 1


def expected_url(path: Path) -> str:
    relative = path.relative_to(ROOT).as_posix()
    if relative == "index.html":
        return SITE + "/"
    return SITE + "/" + relative.removesuffix("index.html")


def local_target(value: str) -> Path | None:
    if not value.startswith("/") or value.startswith("//"):
        return None
    route = unquote(urlsplit(value).path)
    if route == "/":
        return ROOT / "index.html"
    target = ROOT / route.lstrip("/")
    if route.endswith("/"):
        return target / "index.html"
    return target


def is_noindex(parser: PageParser) -> bool:
    return any(
        meta.get("name", "").lower() == "robots"
        and "noindex" in meta.get("content", "").lower()
        for meta in parser.metas
    )


def validate_page(path: Path, errors: list[str], indexed_urls: set[str]) -> None:
    relative = path.relative_to(ROOT).as_posix()
    source = path.read_text(encoding="utf-8")
    parser = PageParser()
    parser.feed(source)
    noindex = is_noindex(parser)

    if path.name == "404.html":
        if parser.canonicals:
            errors.append(f"{relative}: 404 page must not have a canonical URL")
        if not noindex:
            errors.append(f"{relative}: 404 page must be noindex")
    else:
        wanted = expected_url(path)
        if parser.canonicals != [wanted]:
            errors.append(f"{relative}: expected canonical {wanted!r}, found {parser.canonicals!r}")
        og_urls = [
            meta.get("content", "")
            for meta in parser.metas
            if meta.get("property", "").lower() == "og:url"
        ]
        if og_urls != [wanted]:
            errors.append(f"{relative}: og:url does not match the canonical URL")
        if not noindex:
            indexed_urls.add(wanted)

    if parser.main_ids != ["main"]:
        errors.append(f"{relative}: expected one <main id=\"main\"> element")
    if parser.h1_count != 1:
        errors.append(f"{relative}: expected one h1, found {parser.h1_count}")
    duplicate_ids = sorted(key for key, count in Counter(parser.ids).items() if count > 1)
    if duplicate_ids:
        errors.append(f"{relative}: duplicate element IDs: {', '.join(duplicate_ids)}")
    if 'class="skip-link"' not in source:
        errors.append(f"{relative}: missing keyboard skip link")
    if "/assets/site-fixes.css" not in source or "/assets/site-fixes.js" not in source:
        errors.append(f"{relative}: missing shared accessibility assets")

    for image in parser.images:
        if "alt" not in image:
            errors.append(f"{relative}: image missing alt attribute: {image.get('src', '')}")

    for iframe in parser.iframes:
        if not iframe.get("src"):
            errors.append(f"{relative}: iframe has an empty src")
        if not iframe.get("title"):
            errors.append(f"{relative}: iframe has no title")

    for href, attrs in parser.links:
        if attrs.get("target") == "_blank" and href.startswith(("http://", "https://")):
            rel = set(attrs.get("rel", "").lower().split())
            if not {"noopener", "noreferrer"}.issubset(rel):
                errors.append(f"{relative}: external new-tab link lacks rel protection: {href}")
        target = local_target(href)
        if target is None:
            continue
        route = urlsplit(href).path
        if target.is_dir():
            errors.append(f"{relative}: internal link redirects instead of ending in /: {href}")
        elif not target.exists():
            errors.append(f"{relative}: broken internal link: {href}")

    for meta in parser.metas:
        kind = meta.get("property", "").lower() or meta.get("name", "").lower()
        if kind in {"og:image", "twitter:image"}:
            value = meta.get("content", "")
            if not value.startswith(SITE + "/"):
                errors.append(f"{relative}: {kind} must use an absolute www URL")

    banned = {
        "[YOUR-INSTAGRAM-HANDLE]": "placeholder social profile",
        "this snippet initiates Vimeo": "obsolete Vimeo snippet",
        "gsap.": "missing GSAP dependency",
        "ta_schemas": "duplicate schema injector",
        "ta_faq": "sitewide FAQ schema injector",
        "ta_reviews": "sitewide review schema injector",
        'src=""': "empty resource URL",
        '<meta name="relume-color-schemes"': "meta tag inside exported CSS",
    }
    for needle, label in banned.items():
        if needle in source:
            errors.append(f"{relative}: contains {label}")

    for match in re.finditer(
        r'<script\b(?=[^>]*application/ld\+json)[^>]*>(.*?)</script>',
        source,
        flags=re.I | re.S,
    ):
        try:
            json.loads(match.group(1))
        except json.JSONDecodeError as exc:
            errors.append(f"{relative}: invalid JSON-LD ({exc})")


def validate_sitemap(indexed_urls: set[str], errors: list[str]) -> int:
    root = ET.parse(ROOT / "sitemap.xml").getroot()
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = {node.text or "" for node in root.findall("sm:url/sm:loc", namespace)}
    if urls != indexed_urls:
        for missing in sorted(indexed_urls - urls):
            errors.append(f"sitemap.xml: missing {missing}")
        for extra in sorted(urls - indexed_urls):
            errors.append(f"sitemap.xml: lists non-indexed or missing page {extra}")
    for url in urls:
        if not url.startswith(SITE + "/") or (url != SITE + "/" and not url.endswith("/")):
            errors.append(f"sitemap.xml: non-canonical URL {url}")
    return len(urls)


def main() -> int:
    errors: list[str] = []
    indexed_urls: set[str] = set()
    pages = [path for path in sorted(ROOT.rglob("*.html")) if ".git" not in path.parts]
    for path in pages:
        validate_page(path, errors, indexed_urls)
    sitemap_count = validate_sitemap(indexed_urls, errors)

    if errors:
        print(f"Site validation failed with {len(errors)} issue(s):")
        for error in errors:
            print(f"- {error}")
        return 1
    print(
        f"Site validation passed: {len(pages)} HTML pages, "
        f"{sitemap_count} indexed URLs, no broken local links."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
