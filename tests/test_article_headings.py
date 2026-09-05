import unittest

from scripts.normalize_site import normalize_article_headings


class ArticleHeadingTests(unittest.TestCase):
    def test_duplicate_title_is_removed_and_sections_are_preserved(self):
        source = '<h1>Design &amp; build</h1><h5><strong>Design &amp; build</strong></h5><p>Intro</p><h5 id="process">Our process</h5><p>Details</p>'
        expected = '<h1>Design &amp; build</h1><p>Intro</p><h2 id="process">Our process</h2><p>Details</p>'
        result = normalize_article_headings(source)
        self.assertEqual(result, expected)
        self.assertEqual(normalize_article_headings(result), result)

    def test_distinct_first_section_is_not_removed(self):
        source = '<h1>Building for film</h1><h5>Getting started</h5><p>Keep this introduction.</p>'
        self.assertEqual(normalize_article_headings(source), '<h1>Building for film</h1><h2>Getting started</h2><p>Keep this introduction.</p>')
