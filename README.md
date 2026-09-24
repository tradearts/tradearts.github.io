# Trade Arts website

Static source for [www.tradearts.work](https://www.tradearts.work/), hosted with GitHub Pages.

## Search and AI discovery

Important copy and JSON-LD are delivered in the static HTML, not injected by
JavaScript. The normaliser connects each indexable page to the same Trade Arts
organization and website, adds real navigation breadcrumbs, describes individual
services, and marks up Research articles using their visible title, description,
publisher and original publication date. Keep those fields factual and in sync.
Do not add fabricated reviews, credentials, build completions or new publication
dates for an old article. Concept projects must remain labelled as concepts.

`robots.txt` allows search crawlers, including OAI-SearchBot. AI-search access and
model-training controls are separate decisions; don't change one as a side
effect of the other. No special AI text file or schema guarantees citations.

The sitemap is regenerated from indexable pages. Update a page's recorded
`lastmod` only for a meaningful content/structured-data change; the normaliser
preserves it rather than advancing every date at build time. New entries have
no invented date. The validator checks coverage and page-graph consistency.

## Publishing an updated Webflow export

1. Replace the exported HTML and assets while preserving `CNAME`, `assets/forms.js`, the shop files, and the files in `scripts/`.
2. Run `python scripts/normalize_site.py` from the repository root. This applies the shared accessibility, media, canonical URL, social metadata and structured-data fixes that Webflow does not retain.
3. Run `python scripts/validate_site.py`.
4. Review the homepage, contact form, shop, one portfolio page and the 404 page at mobile and desktop sizes.
5. Commit and push to `main`. GitHub Pages publishes the branch automatically.

The GitHub Actions workflow repeats validation on every push and pull request. It checks canonical URLs, sitemap coverage, local links, image and iframe accessibility, social metadata, structured data and known export regressions.

## Shared custom files

- `assets/media.js` lazily creates Vimeo embeds and handles image-only portfolio slots without GSAP.
- `assets/site-fixes.js` keeps the mobile menu state accessible and adds a privacy note to enquiry forms.
- `assets/site-fixes.css` styles skip links, shared fixes and the privacy page.
- `privacy/index.html` explains contact-form, hosting and analytics data handling.
