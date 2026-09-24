"""Static, page-specific search metadata derived from the published HTML.

No crawler-only copy, invented reviews, automatic 'fresh' dates or AI-specific
ranking claims. Organization data is shared with the existing normaliser.
"""

from __future__ import annotations

import copy
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import urlsplit


SITE = "https://www.tradearts.work"
PARENTS = {
    "services": ("Services", "/services/"),
    "blog": ("Research", "/research/"),
    "work": ("Film / TV", "/works/"),
    "commercial-project": ("Commercial", "/commercial/"),
    "exhibition": ("Exhibitions", "/exhibitions/"),
    "public-art": ("Public Art", "/public-art/"),
    "shop": ("Shop", "/shop/"),
}
ARCHIVES = {"/services/", "/research/", "/works/", "/commercial/",
            "/exhibitions/", "/public-art/", "/shop/"}


class SearchPage(HTMLParser):
    """Read metadata/headings without adding a runtime dependency to CI."""

    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.metas = {}
        self.headings = []
        self.titles = []
        self.current = None
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            key = attrs.get("name", attrs.get("property", "")).lower()
            self.metas[key] = attrs.get("content", "")
        if tag in {"h1", "title"}:
            self.current = tag
        elif tag == "br" and self.current == "h1":
            self.headings.append(" ")

    def handle_endtag(self, tag):
        if tag == self.current:
            self.current = None

    def handle_data(self, data):
        if self.current == "h1":
            self.headings.append(data)
        elif self.current == "title":
            self.titles.append(data)

    @property
    def heading(self):
        return " ".join("".join(self.headings).split())

    @property
    def title(self):
        return " ".join("".join(self.titles).split())


def article_date(source: str) -> tuple[str, str] | None:
    # The original, visibly published article date precedes its h1. Never use
    # a related article's date or manufacture one from the deploy/build time.
    main = re.split(r'<(?:main|div)\b[^>]*\bid=["\']main["\'][^>]*>', source, maxsplit=1)
    if len(main) < 2:
        return None
    intro = main[1].split("<h1", 1)[0]
    match = re.search(r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b', intro)
    if not match:
        return None
    label = match.group()
    try:
        return datetime.strptime(label, "%B %d, %Y").date().isoformat(), label
    except ValueError:
        return None


def normalize_article_credit(source: str) -> str:
    """Make the existing publisher and publication date visible/semantic."""
    date = article_date(source)
    if date and not re.search(r'<time\b', source):
        iso, label = date
        source = source.replace(
            ">" + label + "<",
            f'><time datetime="{iso}">{label}</time><', 1,
        )
    if 'class="ta-article-credit"' not in source:
        source = re.sub(
            r"(</h1>)",
            r'\1<p class="ta-article-credit">By <a href="/info/">Trade Arts</a> · From the workshop</p>',
            source, count=1,
        )
    return source


def build_graph(source: str, canonical: str, base_graph: dict) -> dict | None:
    page = SearchPage(source)
    if "noindex" in page.metas.get("robots", "").lower():
        return None
    route = urlsplit(canonical).path
    parts = route.strip("/").split("/")
    graph = copy.deepcopy(base_graph)
    org = {"@id": SITE + "/#organization"}
    webpage = {
        "@type": ("AboutPage" if route == "/info/" else
                  "ContactPage" if route == "/contact/" else
                  "CollectionPage" if route in ARCHIVES else "WebPage"),
        "@id": canonical + "#webpage",
        "url": canonical,
        "name": page.title or page.heading,
        "description": page.metas.get("description", ""),
        "isPartOf": {"@id": SITE + "/#website"},
        "publisher": org,
        "inLanguage": "en-AU",
    }
    image = page.metas.get("og:image")
    if image and image.startswith(SITE + "/"):
        webpage["primaryImageOfPage"] = {"@type": "ImageObject", "url": image}
    if route in {"/", "/info/", "/contact/"}:
        webpage["about"] = org
    graph["@graph"].append(webpage)

    if route != "/":
        trail = [("Home", SITE + "/")]
        if len(parts) > 1 and parts[0] in PARENTS:
            label, parent = PARENTS[parts[0]]
            trail.append((label, SITE + parent))
        trail.append((page.heading, canonical))
        breadcrumb_id = canonical + "#breadcrumb"
        webpage["breadcrumb"] = {"@id": breadcrumb_id}
        graph["@graph"].append({
            "@type": "BreadcrumbList", "@id": breadcrumb_id,
            "itemListElement": [
                {"@type": "ListItem", "position": i, "name": label, "item": url}
                for i, (label, url) in enumerate(trail, 1)
            ],
        })

    if len(parts) == 2 and parts[0] == "services":
        service_id = canonical + "#service"
        webpage["mainEntity"] = {"@id": service_id}
        graph["@graph"].append({
            "@type": "Service", "@id": service_id, "url": canonical,
            "name": page.heading, "serviceType": page.heading,
            "description": webpage["description"], "provider": org,
        })
    elif len(parts) == 2 and parts[0] == "blog":
        article_id = canonical + "#article"
        webpage["mainEntity"] = {"@id": article_id}
        article = {
            "@type": "BlogPosting", "@id": article_id, "url": canonical,
            "headline": page.heading, "description": webpage["description"],
            "mainEntityOfPage": {"@id": webpage["@id"]},
            "author": org, "publisher": org, "inLanguage": "en-AU",
        }
        date = article_date(source)
        if date:
            article["datePublished"] = date[0]
        if image:
            article["image"] = image
        graph["@graph"].append(article)
    return graph


def schema_script(graph: dict) -> str:
    # Keep any literal closing-script sequence in future content inert.
    payload = json.dumps(graph, ensure_ascii=False, indent=2).replace("<", "\\u003c")
    return '<script type="application/ld+json">\n' + payload + '\n</script>'
