# Trade Arts website

Static source for [www.tradearts.work](https://www.tradearts.work/), hosted with GitHub Pages.

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
