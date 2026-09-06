import html
import re
import unittest

from scripts.normalize_site import ROOT, normalize_article_recommendations, read_research_articles


class ArticleRecommendationTests(unittest.TestCase):
    def test_every_article_has_three_other_current_articles(self):
        catalogue = read_research_articles()
        articles_by_route = {article["route"]: article for article in catalogue}
        for path in (ROOT / "blog").glob("*/index.html"):
            current_route = "/" + path.parent.relative_to(ROOT).as_posix() + "/"
            with self.subTest(article=current_route):
                source = path.read_text(encoding="utf-8")
                result = normalize_article_recommendations(source, current_route)
                cards = re.findall(
                    r'<a href="([^"]+)" class="home_feature-2_item-link w-inline-block">(.*?)</a>',
                    result,
                    re.S,
                )
                routes = [route for route, _ in cards]
                self.assertEqual(len(routes), 3)
                self.assertEqual(len(set(routes)), 3)
                self.assertNotIn(current_route, routes)
                self.assertEqual(routes, [a["route"] for a in catalogue if a["route"] != current_route][:3])
                for route, card in cards:
                    article = articles_by_route[route]
                    self.assertIn(html.escape(article["title"], quote=True), card)
                    self.assertIn(article["date"], card)
                    self.assertIn('loading="lazy"', card)
                    self.assertIn('<h3 class="text-size-medium blog text-color-80 text-letter-spacing-mobile-none">', card)
                self.assertEqual(normalize_article_recommendations(result, current_route), result)

    def test_replacement_preserves_surrounding_article_and_list_wrapper(self):
        source = (
            '<h1>Article to preserve</h1><p>Opening paragraph.</p>'
            '<div class="home_feature-2_list-wrapper"><h2>Recent Research</h2>'
            '<div role="list" class="home_feature-2_list w-dyn-items"><div>Old card</div></div>'
            '<a href="/research/">View more research</a></div><footer>Footer</footer>'
        )
        result = normalize_article_recommendations(source, "/blog/from-cad-to-camera-film-props/")
        prefix, suffix = source.split('<div>Old card</div>')
        self.assertTrue(result.startswith(prefix))
        self.assertTrue(result.endswith(suffix))
        self.assertNotIn("Old card", result)


if __name__ == "__main__":
    unittest.main()
