#!/usr/bin/env python3
"""Apply repeatable post-export fixes to the Trade Arts static site."""

from __future__ import annotations

import html
import json
import re
from datetime import datetime
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

SPLIDE_COMMIT = "00901b9ce10eaecfd8279350da06e5a5a246c1ac"

ARTICLE_TOPICS = {'custom-fabrication-cost-australia': 'Planning & budgets',
 'how-to-brief-fabrication-studio': 'Planning & briefs',
 'what-makes-a-prop-camera-ready': 'Film & props',
 'scenic-finishing-3d-prints-camera-ready': 'Materials & finishing',
 'public-art-fabrication-council-government': 'Public art',
 'prototype-physical-products-3d-printing': 'Prototyping',
 'how-props-are-made-australian-film': 'Film & props',
 'from-cad-to-camera-film-props': 'Design & fabrication',
 'exhibition-fabrication-australia': 'Exhibitions',
 'cnc-vs-3d-printing-fabrication-method': 'Methods & materials',
 'building-prototypes-for-brands': 'Prototyping'}

SHOP_ASSET_REPLACEMENTS = {
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

LEGACY_REDIRECTS = {
    "work/superfun-console/": "/commercial-project/superfun-console/",
    "work/up-there-x-new-balance/": "/commercial-project/up-there-x-new-balance/",
    "work/reindeer-lights/": "/exhibition/reindeer-lights/",
    "work/helicopter-display-models/": "/exhibition/helicopter-display-models/",
    "work/pterodactyl/": "/exhibition/pterodactyl/",
    "work/bunya-cone-replica/": "/exhibition/bunya-cone-replica/",
    "work/australian-museum-spiders/": "/exhibition/australian-museum-spiders/",
    "work/real-madrid-world-of-football/": "/exhibition/real-madrid-world-of-football/",
    "work/reserve-bank-museum-nz/": "/exhibition/reserve-bank-museum-nz/",
    "work/madiba/": "/exhibition/madiba/",
    "work/promhouse/": "/exhibition/promhouse/",
    "work/revitalise-coffs-harbour/": "/public-art/revitalise-coffs-harbour/",
}

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


def remove_attr(tag: str, attribute: str) -> str:
    return re.sub(
        rf"\s+{re.escape(attribute)}\s*=\s*([\"']).*?\1",
        "",
        tag,
        count=1,
        flags=re.I | re.S,
    )


def defer_analytics_scripts(text: str) -> str:
    """Keep Google measurement code inert until analytics consent is granted."""

    def replace(match: re.Match[str]) -> str:
        opening = match.group("opening")
        body = match.group("body")
        source = get_attr(opening, "data-consent-src") or get_attr(opening, "src") or ""
        is_primary_analytics = "a03713ff8717-lb9e6lq19p-1.1.1.js" in source.lower()
        if get_attr(opening, "data-consent") == "analytics" and is_primary_analytics:
            return match.group(0)

        haystack = (source + "\n" + body).lower()
        is_google_measurement = any(
            marker in haystack
            for marker in (
                "googletagmanager.com",
                "google_tags_first_party",
                "a03713ff8717-lb9e6lq19p-1.1.1.js",
            )
        ) or bool(re.search(r"\bgtag\s*\(", body))
        if not is_google_measurement:
            return match.group(0)
        if not is_primary_analytics:
            return ""

        opening = set_attr(opening, "type", "text/plain")
        opening = set_attr(opening, "data-consent", "analytics")
        if source:
            opening = set_attr(opening, "data-consent-src", source)
            opening = remove_attr(opening, "src")
        return opening + body + "</script>"

    return re.sub(
        r"(?P<opening><script\b[^>]*>)(?P<body>.*?)</script>",
        replace,
        text,
        flags=re.I | re.S,
    )


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


def sort_archive_articles(articles: list[dict[str, str]]) -> list[dict[str, str]]:
    def article_date(article: dict[str, str]) -> datetime:
        for date_format in ("%B %d, %Y", "%d %B %Y"):
            try:
                return datetime.strptime(article["date"], date_format)
            except ValueError:
                continue
        raise ValueError(f"Unsupported article date: {article['date']}")

    return sorted(
        articles,
        key=lambda article: (article_date(article), article["title"]),
        reverse=True,
    )


def normalize_research_archive(text: str) -> str:
    marker = '<div fs-list-load="pagination" fs-list-element="list" role="list" class="research_feature_list w-dyn-items">'
    start = text.find(marker)
    if start < 0:
        return text

    articles = []
    for path in sorted((ROOT / "blog").glob("*/index.html")):
        source = path.read_text(encoding="utf-8")
        route = "/" + path.parent.relative_to(ROOT).as_posix() + "/"
        if route == "/blog/custom-fabrication-cost-australia/":
            continue
        title_match = re.search(r"<h1\b[^>]*>(.*?)</h1>", source, re.I | re.S)
        image_match = re.search(
            r'<meta\b(?=[^>]*property=["\']og:image["\'])[^>]*content=["\']([^"\']+)',
            source,
            re.I | re.S,
        )
        date_match = re.search(
            r"(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d{2}",
            source,
        )
        if not (title_match and image_match and date_match):
            continue
        title = html.unescape(re.sub(r"<[^>]+>", "", title_match.group(1))).strip()
        image = html.unescape(image_match.group(1))
        articles.append(
            {
                "date": date_match.group(0),
                "title": title,
                "route": route,
                "image": image,
                "slug": path.parent.name,
            }
        )

    cards = []
    for article in sort_archive_articles(articles):
        date = article["date"]
        title = article["title"]
        route = article["route"]
        image = article["image"].removeprefix(SITE)
        topic = html.escape(ARTICLE_TOPICS.get(article["slug"], "Workshop notes"))
        escaped_title = html.escape(title, quote=True)
        cards.append(
            '<div role="listitem" class="w-dyn-item"><div class="home_feature-2_item">'
            f'<a href="{route}" class="home_feature-2_item-link w-inline-block">'
            '<div class="home_feature-2_image-wrapper">'
            f'<img alt="{escaped_title}" loading="lazy" src="{html.escape(image, quote=True)}" '
            'class="home_feature-2_image"></div><div class="home_feature-2_item-content">'
            '<div class="home_feature-2_item-content-top"><div class="margin-bottom margin-xsmall _9px">'
            '<div class="home_feature-2_meta-wrapper">'
            f'<div class="text-size-regular text-color-light-black text-style-allcaps text-letter-spacing-none">{date}</div>'
            '</div></div><div class="margin-bottom margin-xxsmall">'
            f'<span class="ta-topic">{topic}</span><h2 class="text-size-medium blog text-color-80 text-letter-spacing-mobile-none">{escaped_title}</h2>'
            '</div></div></div></a></div></div>'
        )

    content_start = start + len(marker)
    depth = 1
    cursor = content_start
    token = re.compile(r"<div\b|</div>", re.I)
    for match in token.finditer(text, cursor):
        depth += 1 if match.group(0).lower().startswith("<div") else -1
        if depth == 0:
            list_end = match.start()
            break
    else:
        return text
    text = text[:content_start] + "".join(cards) + text[list_end:]
    text = re.sub(
        r'<div role="navigation" aria-label="List" class="w-pagination-wrapper pagination blog">.*?</div></div>',
        "",
        text,
        count=1,
        flags=re.I | re.S,
    )
    return text


def normalize_page(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    text = original
    is_404 = path == ROOT / "404.html"
    is_home = path == ROOT / "index.html"

    text = re.sub(
        r'\s*<script\b(?=[^>]*\bsrc=["\']/assets/consent\.js(?:\?[^"\']*)?["\'])[^>]*>\s*</script>',
        "",
        text,
        flags=re.I | re.S,
    )
    text = defer_analytics_scripts(text)
    if (
        "googletagmanager.com" in text
        or "google_tags_first_party" in text
        or "a03713ff8717-lb9e6lq19p-1.1.1.js" in text
        or path == ROOT / "privacy" / "index.html"
    ):
        charset = re.search(r'<meta\b[^>]*charset=["\'][^"\']+["\'][^>]*>', text, re.I)
        if charset:
            text = text[: charset.end()] + '<script src="/assets/consent.js"></script>' + text[charset.end() :]
        else:
            text = text.replace("<head>", '<head><script src="/assets/consent.js"></script>', 1)

    text = re.sub(
        r'\s*<link\b(?=[^>]*\bhref=["\']/assets/(?:site-fixes|logo-carousel|media-controls)\.css(?:\?[^"\']*)?["\'])[^>]*>',
        "",
        text,
        flags=re.I | re.S,
    )
    text = re.sub(
        r'\s*<script\b(?=[^>]*\bsrc=["\']/assets/(?:site-fixes|media|logo-carousel)\.js(?:\?[^"\']*)?["\'])'
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
    if path == ROOT / "research" / "index.html":
        text = normalize_research_archive(text)
    if path == ROOT / "services" / "3d-scanning" / "index.html":
        old_workflow = (
            '<ul role="list"><li><strong>3D Printing &amp; CNC</strong> – resin for fine detail, FDM for scale, CNC for strength and precision</li>'
            '<li><strong>Material range</strong> – PLA, PETG, engineering resins, flexible and translucent polymers</li>'
            '<li><strong>Digital support</strong> – CAD modelling, file prep, geometry cleanup, or full builds from sketches</li>'
            '<li><strong>Finishing &amp; scenic</strong> – sanding, priming, painting, patinas for realism</li>'
            '<li><strong>Hybrid integration</strong> – mechanical inserts, sculptural parts, or custom components</li></ul>'
        )
        new_workflow = (
            '<ul role="list"><li><strong>Project review</strong> – confirm the object, intended use, access, scale and required accuracy</li>'
            '<li><strong>Capture</strong> – scan in our workshop or on site using the setup best suited to the object and surface</li>'
            '<li><strong>Scan alignment</strong> – register passes, clean the point cloud and build a usable digital mesh</li>'
            '<li><strong>Quality check</strong> – verify scale, coverage and critical geometry against the agreed brief</li>'
            '<li><strong>File delivery</strong> – supply the agreed production files, with optional CAD cleanup or fabrication support</li></ul>'
        )
        text = text.replace(old_workflow, new_workflow)
    if path == ROOT / "contact" / "index.html" and 'name="project_type"' not in text:
        email_field = '<input class="ta-form_input w-input" maxlength="256" name="email" data-name="Email" placeholder="" type="email" id="email" autocomplete="email" required=""/>'
        qualifiers = (
            '<label for="company" class="ta-form_label">Company or organisation <span>(optional)</span></label>'
            '<input class="ta-form_input w-input" maxlength="256" name="company" data-name="Company" type="text" id="company" autocomplete="organization"/>'
            '<label for="project-type" class="ta-form_label">Project type</label>'
            '<select class="ta-form_input w-select" name="project_type" data-name="Project Type" id="project-type" required>'
            '<option value="">Select one</option><option>Film or television</option><option>Exhibition or museum</option>'
            '<option>Public art</option><option>Commercial or brand activation</option><option>Product or prototype</option><option>Other</option></select>'
            '<label for="location" class="ta-form_label">Project location <span>(optional)</span></label>'
            '<input class="ta-form_input w-input" maxlength="256" name="location" data-name="Project Location" type="text" id="location" autocomplete="address-level2"/>'
            '<label for="target-date" class="ta-form_label">Target completion date <span>(optional)</span></label>'
            '<input class="ta-form_input w-input" name="target_date" data-name="Target Completion Date" type="date" id="target-date"/>'
            '<label for="budget-range" class="ta-form_label">Indicative budget <span>(optional)</span></label>'
            '<select class="ta-form_input w-select" name="budget_range" data-name="Indicative Budget" id="budget-range">'
            '<option value="">Select a range</option><option>Under $10,000</option><option>$10,000–$25,000</option>'
            '<option>$25,000–$50,000</option><option>$50,000–$100,000</option><option>Over $100,000</option><option>Not sure yet</option></select>'
        )
        text = text.replace(email_field, email_field + qualifiers, 1)
        submit = '<input type="submit" data-wait="Sending…" class="ta-form_button w-button" value="Send message"/>'
        note = '<p class="form-privacy-note">We usually reply within two business days. Your details are used only to respond to this enquiry. See our <a href="/privacy/">privacy policy</a>.</p>'
        text = text.replace(submit, note + submit, 1)

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

    text = insert_before_head(text, '<link rel="stylesheet" href="/assets/site-fixes.css?v=6">')
    if is_home:
        text = insert_before_head(text, '<link rel="stylesheet" href="/assets/logo-carousel.css">')
    if had_media:
        text = insert_before_head(text, '<link rel="stylesheet" href="/assets/media-controls.css?v=1">')
        text = insert_before_body_end(text, '<script src="/assets/media.js" defer></script>')
    text = insert_before_body_end(text, '<script src="/assets/site-fixes.js" defer></script>')
    if is_home:
        text = insert_before_body_end(text, '<script src="/assets/logo-carousel.js" defer></script>')

    text = normalize_iframe_titles(text)
    text = normalize_work_image_alts(text, path)
    if ROOT / "shop" in path.parents:
        text = re.sub(
            r'\s*<meta\s+http-equiv=["\']Cache-Control["\'][^>]*>',
            "",
            text,
            flags=re.I,
        )
        for original_asset, optimised_asset in SHOP_ASSET_REPLACEMENTS.items():
            text = text.replace(original_asset, optimised_asset)
        if path == ROOT / "shop" / "index.html":
            text = re.sub(
                r'<img\b(?=[^>]*workshop-gloves-1-optimised\.webp)[^>]*>',
                lambda match: set_attr(match.group(0), "loading", "lazy"),
                text,
                count=1,
                flags=re.I,
            )
    if path.parent.parent == ROOT / "blog":
        text = text.replace("splide@main", f"splide@{SPLIDE_COMMIT}")
    text = normalize_links(text)
    text = normalize_external_targets(text)
    # Keep changed shared scripts/styles fresh without accumulating duplicate includes.
    cache_versions = {
        "/assets/consent.js": "2", "/assets/forms.js": "2", "/assets/media.js": "2",
        "/shop/assets/shop.css": "10", "/shop/assets/shop.js": "3",
        "/shop/assets/products.js": "2",
    }
    for asset, version in cache_versions.items():
        text = re.sub(re.escape(asset) + r'(?:\?[^"\']*)?(?=["\'])', asset + "?v=" + version, text)


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


def update_shop_styles() -> bool:
    path = ROOT / "shop" / "assets" / "shop.css"
    original = path.read_text(encoding="utf-8")
    updated = original
    for original_asset, optimised_asset in SHOP_ASSET_REPLACEMENTS.items():
        updated = updated.replace(original_asset, optimised_asset)
    if updated == original:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def write_legacy_redirects() -> int:
    written = 0
    for route, destination in LEGACY_REDIRECTS.items():
        path = ROOT / route / "index.html"
        absolute = SITE + destination
        title = route.rstrip("/").rsplit("/", 1)[-1].replace("-", " ").title()
        source = f'''<!doctype html>
<html lang="en-AU" data-legacy-redirect>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, follow">
  <meta http-equiv="refresh" content="0; url={destination}">
  <link rel="canonical" href="{absolute}">
  <title>{title} | Trade Arts</title>
  <link rel="stylesheet" href="/assets/site-fixes.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <main id="main" class="legacy-redirect">
    <h1>This project has moved</h1>
    <p>Continue to the current Trade Arts project page.</p>
    <p><a href="{destination}">View {title}</a></p>
  </main>
  <script>window.location.replace({json.dumps(destination)});</script>
</body>
</html>
'''
        if not path.exists() or path.read_text(encoding="utf-8") != source:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(source, encoding="utf-8")
            written += 1
    return written


def main() -> None:
    changed = []
    for path in sorted(ROOT.rglob("*.html")):
        if ".git" in path.parts or "data-legacy-redirect" in path.read_text(encoding="utf-8"):
            continue
        if normalize_page(path):
            changed.append(path.relative_to(ROOT).as_posix())
    sitemap_changed = update_sitemap()
    shop_styles_changed = update_shop_styles()
    redirects_written = write_legacy_redirects()
    print(f"Normalised {len(changed)} HTML files.")
    print(f"Wrote {redirects_written} legacy redirect pages.")
    if shop_styles_changed:
        print("Updated optimised shop image references.")
    if sitemap_changed:
        print("Added /privacy/ to sitemap.xml.")


if __name__ == "__main__":
    main()
