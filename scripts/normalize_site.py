#!/usr/bin/env python3
"""Apply repeatable post-export fixes to the Trade Arts static site."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.tradearts.work"
DEFAULT_SOCIAL_IMAGE = (
    SITE
    + "/assets/webflow/"
    + "f4b160e2d050-6891a3a3a2ca8320c7c67c8b_"
    + "68509c3dcd98b1f9aca2cbcb_68351c06930016f8c178df83_trade-arts.png"
)

SCHEMA = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Organization",
            "@id": SITE + "/#organization",
            "name": "Trade Arts",
            "url": SITE + "/",
            "description": (
                "Australian design and fabrication studio delivering custom builds "
                "for film, television, exhibitions, public art and cultural projects."
            ),
            "email": "info@tradearts.work",
            "telephone": "+61431802800",
            "logo": DEFAULT_SOCIAL_IMAGE,
            "image": DEFAULT_SOCIAL_IMAGE,
            "areaServed": ["Gold Coast", "Northern New South Wales", "Australia"],
            "sameAs": [
                "https://www.instagram.com/tradearts______",
                "https://www.linkedin.com/company/tradearts/",
            ],
        },
        {
            "@type": "WebSite",
            "@id": SITE + "/#website",
            "url": SITE + "/",
            "name": "Trade Arts",
            "publisher": {"@id": SITE + "/#organization"},
            "inLanguage": "en-AU",
        },
    ],
}


def page_url(path: Path) -> str:
    relative = path.relative_to(ROOT).as_posix()
    if relative == "index.html":
        return SITE + "/"
    return SITE + "/" + relative.removesuffix("index.html")


def insert_before_head(text: str, addition: str) -> str:
    return text.replace("</head>", addition + "\n</head>", 1)


def insert_before_body_end(text: str, addition: str) -> str:
    return text.replace("</body>", addition + "\n</body>", 1)


def meta_tag(name: str, value: str, *, prop: bool = False) -> str:
    attribute = "property" if prop else "name"
    return '<meta {}="{}" content="{}">'.format(
        attribute, name, html.escape(value, quote=True)
    )


def get_attr(tag: str, attribute: str) -> str | None:
    match = re.search(
        rf"\b{re.escape(attribute)}\s*=\s*([\"'])(.*?)\1", tag, re.I | re.S
    )
    return html.unescape(match.group(2)) if match else None


def set_attr(tag: str, attribute: str, value: str) -> str:
    escaped = html.escape(value, quote=True)
    pattern = rf"\b{re.escape(attribute)}\s*=\s*([\"'])(.*?)\1"
    if re.search(pattern, tag, re.I | re.S):
        return re.sub(
            pattern,
            lambda match: '{}="{}"'.format(attribute, escaped),
            tag,
            count=1,
            flags=re.I | re.S,
        )
    closing = "/>" if tag.rstrip().endswith("/>") else ">"
    base = re.sub(r"\s*/?>\s*$", "", tag)
    return base + f' {attribute}="{escaped}"' + closing


def normalize_internal_url(value: str) -> str:
    if not value.startswith("/") or value.startswith("//"):
        return value
    parts = urlsplit(value)
    route = parts.path
    if route == "/" or route.endswith("/") or Path(route).suffix:
        return value
    if (ROOT / route.lstrip("/")).is_dir():
        parts = parts._replace(path=route + "/")
        return urlunsplit(parts)
    return value


def normalize_links(text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        value = html.unescape(match.group("value"))
        return '{}{}{}{}'.format(
            match.group("prefix"),
            match.group("quote"),
            html.escape(normalize_internal_url(value), quote=True),
            match.group("quote"),
        )

    return re.sub(
        r'(?P<prefix>\bhref\s*=\s*)(?P<quote>["\'])(?P<value>.*?)(?P=quote)',
        replace,
        text,
        flags=re.I | re.S,
    )


def normalize_external_targets(text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        tag = match.group(0)
        target = get_attr(tag, "target")
        href = get_attr(tag, "href") or ""
        if target == "_blank" and href.startswith(("http://", "https://")):
            tag = set_attr(tag, "rel", "noopener noreferrer")
        return tag

    return re.sub(r"<a\b[^>]*>", replace, text, flags=re.I | re.S)


def replace_canonical(text: str, canonical: str | None) -> str:
    text = re.sub(
        r'<link\b(?=[^>]*\brel\s*=\s*["\']canonical["\'])[^>]*>\s*',
        "",
        text,
        flags=re.I | re.S,
    )
    if canonical:
        text = insert_before_head(
            text, '<link rel="canonical" href="{}">'.format(canonical)
        )
    return text


def normalize_social_metadata(text: str, canonical: str | None) -> str:
    image = DEFAULT_SOCIAL_IMAGE
    for match in re.finditer(r"<meta\b[^>]*>", text, flags=re.I | re.S):
        tag = match.group(0)
        prop = (get_attr(tag, "property") or "").lower()
        name = (get_attr(tag, "name") or "").lower()
        if prop == "og:image":
            image = get_attr(tag, "content") or image
            break
        if name == "twitter:image":
            image = get_attr(tag, "content") or image
    if image.startswith("/"):
        image = SITE + image

    text = re.sub(
        r'<meta\b(?=[^>]*(?:\bproperty\s*=\s*["\']og:(?:url|image)["\']|'
        r'\bname\s*=\s*["\']twitter:image["\']))[^>]*>\s*',
        "",
        text,
        flags=re.I | re.S,
    )
    additions = []
    if canonical:
        additions.append(meta_tag("og:url", canonical, prop=True))
    additions.append(meta_tag("og:image", image, prop=True))
    additions.append(meta_tag("twitter:image", image))
    text = insert_before_head(text, "\n".join(additions))
    return text


def remove_exported_schema(text: str) -> str:
    text = re.sub(
        r'\s*<script\b(?=[^>]*application/ld\+json)[^>]*>.*?</script>',
        "",
        text,
        flags=re.I | re.S,
    )
    text = re.sub(
        r'\s*<script\b(?=[^>]*\bsrc\s*=\s*["\'][^"\']*'
        r'(?:ta_schemas|ta_faq|ta_reviews(?:_schema)?)[^"\']*["\'])[^>]*>'
        r'\s*</script>',
        "",
        text,
        flags=re.I | re.S,
    )
    text = re.sub(
        r'\s*<!--\s*(?:Trade Arts - Structured Data for SEO & AI Search|'
        r'Paste this into Webflow:.*?|Organization \+ LocalBusiness Schema|'
        r'WebSite Schema \(enables sitelinks in search\))\s*-->',
        "",
        text,
        flags=re.I | re.S,
    )
    return text


def normalize_media(text: str) -> tuple[str, bool]:
    had_media = "data-vimeo-player-init" in text
    text = re.sub(
        r'\s*<script\b[^>]*src=["\']https://player\.vimeo\.com/api/player\.js["\'][^>]*>'
        r'\s*</script>',
        "",
        text,
        flags=re.I | re.S,
    )
    text = re.sub(
        r"\s*<script>\s*// this snippet initiates Vimeo.*?</script>",
        "\n",
        text,
        flags=re.I | re.S,
    )
    text = re.sub(
        r'<iframe\b(?=[^>]*class=["\'][^"\']*\bvimeo-player__iframe\b)[^>]*>'
        r'\s*</iframe>',
        "",
        text,
        flags=re.I | re.S,
    )
    text = re.sub(r'\s+allowfullscreen=["\']true["\']', " allowfullscreen", text, flags=re.I)
    text = re.sub(r'\s+height=["\']auto["\']', "", text, flags=re.I)
    return text, had_media


def normalize_iframe_titles(text: str) -> str:
    def replace(match: re.Match[str]) -> str:
        tag = match.group(0)
        if get_attr(tag, "title"):
            return tag
        src = get_attr(tag, "src") or ""
        title = "Interactive 3D project model" if "sketchfab.com" in src else "Embedded project media"
        return set_attr(tag, "title", title)

    return re.sub(r"<iframe\b[^>]*>", replace, text, flags=re.I | re.S)


def normalize_work_image_alts(text: str, path: Path) -> str:
    if path.parent.parent != ROOT / "work":
        return text
    h1 = re.search(r"<h1\b[^>]*>(.*?)</h1>", text, flags=re.I | re.S)
    project = re.sub(r"<[^>]+>", "", h1.group(1)).strip() if h1 else path.parent.name
    counter = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal counter
        tag = match.group(0)
        if get_attr(tag, "alt") != "":
            return tag
        classes = get_attr(tag, "class") or ""
        src = get_attr(tag, "src") or ""
        if "w-condition-invisible" in classes or "w-dyn-bind-empty" in classes:
            return tag
        if "vimeo-player-basic-placeholder" in src:
            return tag
        counter += 1
        label = f"{project} fabrication detail {counter}"
        return set_attr(tag, "alt", label)

    return re.sub(r"<img\b[^>]*>", replace, text, flags=re.I | re.S)


def normalize_homepage(text: str) -> str:
    # Make the visible hero artwork the loading priority and silence its decorative duplicate.
    def hero(match: re.Match[str]) -> str:
        tag = match.group(0)
        tag = set_attr(tag, "loading", "eager")
        tag = set_attr(tag, "fetchpriority", "high")
        return tag

    text = re.sub(
        r'<img\b(?=[^>]*class=["\'][^"\']*\bimage-5\b)[^>]*>',
        hero,
        text,
        count=1,
        flags=re.I | re.S,
    )

    def duplicate(match: re.Match[str]) -> str:
        tag = match.group(0)
        if "image-5" in (get_attr(tag, "class") or ""):
            return tag
        return ""

    text = re.sub(
        r'<img\b(?=[^>]*src=["\'][^"\']*699bcbdf89c12be1312d017f_pt02\.webp["\'])[^>]*>',
        duplicate,
        text,
        flags=re.I | re.S,
    )

    def lazy_card(match: re.Match[str]) -> str:
        tag = set_attr(match.group(0), "loading", "lazy")
        return set_attr(tag, "alt", "")

    text = re.sub(
        r'<img\b(?=[^>]*class=["\'][^"\']*\bhome_feature-2_image\b)[^>]*>',
        lazy_card,
        text,
        flags=re.I | re.S,
    )
    return text


def normalize_page(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    text = original
    is_404 = path == ROOT / "404.html"
    is_home = path == ROOT / "index.html"

    text = re.sub(
        r'\s*<link\b(?=[^>]*\bhref=["\']/assets/site-fixes\.css["\'])[^>]*>',
        "",
        text,
        flags=re.I | re.S,
    )
    text = re.sub(
        r'\s*<script\b(?=[^>]*\bsrc=["\']/assets/(?:site-fixes|media)\.js["\'])'
        r'[^>]*>\s*</script>',
        "",
        text,
        flags=re.I | re.S,
    )

    # Repair two attributes produced by the earliest version of this normaliser.
    text = re.sub(r'/\s+((?:fetchpriority|aria-hidden)=)', r' \1', text)
    text = text.replace(
        'id="w-node-_0bb41a67-e58e-fda7-2fad-cdb613d202cf-c7c67ccd" class="',
        'class="work-card-action ',
    )
    text = re.sub(r'(<html\b[^>]*\blang=)["\']en["\']', r'\1"en-AU"', text, count=1, flags=re.I)
    text = text.replace('<meta name="relume-color-schemes" content="false"/>', "")
    text = remove_exported_schema(text)
    text, had_media = normalize_media(text)

    if is_404:
        canonical = None
        text = text.replace('href="#" class="button is-secondary is-icon', 'href="/" class="button is-secondary is-icon', 1)
        text = re.sub(
            r'<meta\b(?=[^>]*\bname\s*=\s*["\']robots["\'])[^>]*>\s*',
            "",
            text,
            flags=re.I | re.S,
        )
        text = insert_before_head(text, meta_tag("robots", "noindex, follow"))
        if not re.search(r'<meta\b(?=[^>]*\bname=["\']description["\'])', text, re.I):
            text = insert_before_head(
                text,
                meta_tag("description", "The page you requested could not be found. Return to Trade Arts."),
            )
    else:
        canonical = page_url(path)

    text = replace_canonical(text, canonical)
    text = normalize_social_metadata(text, canonical)

    if is_home:
        schema = '<script type="application/ld+json">\n{}\n</script>'.format(
            json.dumps(SCHEMA, ensure_ascii=False, indent=2)
        )
        text = insert_before_head(text, schema)
        text = normalize_homepage(text)

    if "skip-link" not in text:
        text = re.sub(
            r"(<body\b[^>]*>)",
            r'\1<a class="skip-link" href="#main">Skip to content</a>',
            text,
            count=1,
            flags=re.I,
        )
    if re.search(r"<main\b", text, re.I) and not re.search(r'<main\b[^>]*\bid=["\']main["\']', text, re.I):
        text = re.sub(r"<main\b", '<main id="main"', text, count=1, flags=re.I)
    elif not re.search(r"<main\b", text, re.I) and not re.search(r'\bid=["\']main["\']', text, re.I):
        text = re.sub(
            r'<div\b(?=[^>]*class=["\'][^"\']*\bmain-wrapper\b)[^>]*>',
            lambda match: set_attr(set_attr(match.group(0), "id", "main"), "role", "main"),
            text,
            count=1,
            flags=re.I | re.S,
        )

    if 'href="/privacy/"' not in text and "footer3_link" in text:
        text = re.sub(
            r'(<a\b[^>]*class=["\'][^"\']*\bfooter3_link\b[^"\']*["\'][^>]*>Contact</a>)',
            r'\1<a href="/privacy/" class="footer3_link">Privacy</a>',
            text,
            count=1,
            flags=re.I | re.S,
        )

    text = insert_before_head(text, '<link rel="stylesheet" href="/assets/site-fixes.css">')
    if had_media:
        text = insert_before_body_end(text, '<script src="/assets/media.js" defer></script>')
    text = insert_before_body_end(text, '<script src="/assets/site-fixes.js" defer></script>')

    text = normalize_iframe_titles(text)
    text = normalize_work_image_alts(text, path)
    text = normalize_links(text)
    text = normalize_external_targets(text)

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def update_sitemap() -> bool:
    path = ROOT / "sitemap.xml"
    original = path.read_text(encoding="utf-8")
    if SITE + "/privacy/" in original:
        return False
    entry = (
        "  <url>\n"
        f"    <loc>{SITE}/privacy/</loc>\n"
        "    <lastmod>2026-08-21</lastmod>\n"
        "  </url>\n"
    )
    updated = original.replace("</urlset>", entry + "</urlset>")
    path.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    changed = []
    for path in sorted(ROOT.rglob("*.html")):
        if ".git" in path.parts:
            continue
        if normalize_page(path):
            changed.append(path.relative_to(ROOT).as_posix())
    sitemap_changed = update_sitemap()
    print(f"Normalised {len(changed)} HTML files.")
    if sitemap_changed:
        print("Added /privacy/ to sitemap.xml.")


if __name__ == "__main__":
    main()
