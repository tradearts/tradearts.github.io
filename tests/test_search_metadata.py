import json
import unittest

from scripts.search_metadata import (
    SITE, article_date, build_graph, normalize_article_credit, schema_script,
)
from scripts.normalize_site import SCHEMA, normalize_service_answers


def source(heading="Design &amp; build", robots=""):
    return ('<html><head><title>Design &amp; build | Trade Arts</title>'
            '<meta name="description" content="A real workshop service.">'
            f'{robots}</head><body><main id="main"><div>April 8, 2026</div>'
            f'<h1>{heading}</h1><p>Visible content.</p></main></body></html>')


class SearchMetadataTests(unittest.TestCase):
    def nodes(self, graph, kind):
        return [n for n in graph["@graph"] if n["@type"] == kind]

    def test_service_uses_visible_copy_and_shared_provider(self):
        url = SITE + "/services/example/"
        graph = build_graph(source(), url, SCHEMA)
        service, = self.nodes(graph, "Service")
        self.assertEqual(service["name"], "Design & build")
        self.assertEqual(service["description"], "A real workshop service.")
        self.assertEqual(service["provider"]["@id"], SITE + "/#organization")
        self.assertNotIn("offers", service)
        self.assertNotIn("aggregateRating", service)
        self.assertEqual(len(SCHEMA["@graph"]), 2)  # No mutation across pages.

    def test_article_date_is_original_and_credit_is_visible_idempotent(self):
        original = source()
        result = normalize_article_credit(original)
        self.assertIn('<time datetime="2026-04-08">April 8, 2026</time>', result)
        self.assertIn('By <a href="/info/">Trade Arts</a>', result)
        self.assertEqual(normalize_article_credit(result), result)
        graph = build_graph(result, SITE + "/blog/example/", SCHEMA)
        article, = self.nodes(graph, "BlogPosting")
        self.assertEqual(article["datePublished"], "2026-04-08")
        self.assertNotIn("dateModified", article)

    def test_missing_date_does_not_use_related_article_or_build_date(self):
        page = source().replace("April 8, 2026", "")
        page = page.replace("</main>", "<p>Recent research: April 7, 2026</p></main>")
        self.assertIsNone(article_date(page))
        article, = self.nodes(build_graph(page, SITE + "/blog/example/", SCHEMA), "BlogPosting")
        self.assertNotIn("datePublished", article)

    def test_redirect_or_noindex_page_has_no_search_graph(self):
        page = source(robots='<meta content="noindex, follow" name="robots">')
        self.assertIsNone(build_graph(page, SITE + "/hidden/", SCHEMA))

    def test_project_breadcrumb_uses_actual_archive_not_missing_folder(self):
        graph = build_graph(source("An unbuilt concept"), SITE + "/commercial-project/example/", SCHEMA)
        breadcrumb, = self.nodes(graph, "BreadcrumbList")
        self.assertEqual(breadcrumb["itemListElement"][1]["item"], SITE + "/commercial/")
        self.assertEqual(breadcrumb["itemListElement"][-1]["name"], "An unbuilt concept")
        self.assertFalse(self.nodes(graph, "Product"))
        self.assertFalse(self.nodes(graph, "Service"))

    def test_schema_payload_cannot_close_script(self):
        payload = {"headline": "An </script><script>alert(1)</script> example"}
        result = schema_script(payload)
        self.assertEqual(result.count("</script>"), 1)
        self.assertEqual(json.loads(result.split("\n", 1)[1].rsplit("\n", 1)[0]), payload)

    def test_homepage_has_one_page_without_fake_breadcrumb(self):
        graph = build_graph(source("Ideas<br>made real"), SITE + "/", SCHEMA)
        self.assertEqual(len(self.nodes(graph, "WebPage")), 1)
        self.assertFalse(self.nodes(graph, "BreadcrumbList"))

    def test_service_answers_replace_in_place(self):
        original = '<main><section class="ta-bottom-cta padding-global"><h2>Contact</h2></section></main>'
        result = normalize_service_answers(original)
        self.assertEqual(normalize_service_answers(result), result)
        self.assertEqual(result.count('id="service-questions"'), 1)


if __name__ == "__main__":
    unittest.main()
