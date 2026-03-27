import unittest
from polymarket_monitor import filter_markets

class TestPolymarketMonitor(unittest.TestCase):
    def test_filter_markets_with_lists(self):
        # Mock data as lists (as per Gamma API)
        mock_markets = [
            {
                'question': 'Market 1 (Match)',
                'outcomes': ["Yes", "No"],
                'outcomePrices': ["0.35", "0.65"],
                'slug': 'market-1'
            }
        ]
        filtered = filter_markets(mock_markets, 0.30, 0.40, 0.55, 0.70)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]['question'], 'Market 1 (Match)')

    def test_filter_markets_with_strings(self):
        # Mock data as strings (fallback)
        mock_markets = [
            {
                'question': 'Market 2 (Match String)',
                'outcomes': '["Yes", "No"]',
                'outcomePrices': '["0.35", "0.65"]',
                'slug': 'market-2'
            }
        ]
        filtered = filter_markets(mock_markets, 0.30, 0.40, 0.55, 0.70)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]['question'], 'Market 2 (Match String)')

if __name__ == '__main__':
    unittest.main()
