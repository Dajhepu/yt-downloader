from fuzzywuzzy import fuzz
from loguru import logger
from .config import settings

class ArbitrageEngine:
    def __init__(self):
        self.threshold = settings.MIN_PROFIT_PERCENT

    def normalize_event_name(self, name):
        name = name.lower().replace("vs", "").replace("-", "").replace("  ", " ").strip()
        return name

    def find_matches(self, bp_data, cc_data):
        matches = []
        for bp_event in bp_data:
            bp_name = self.normalize_event_name(bp_event.get('title', ''))
            for cc_event in cc_data:
                cc_name = self.normalize_event_name(cc_event.get('title', ''))
                similarity = fuzz.token_sort_ratio(bp_name, cc_name)
                if similarity > 85:
                    matches.append((bp_event, cc_event))
        return matches

    def calculate_arbitrage(self, odds_list):
        if not odds_list: return None
        try:
            inv_sum = sum(1.0 / odd['o'] for odd in odds_list)
            if inv_sum < 1.0:
                profit_pct = (1.0 / inv_sum - 1.0) * 100
                if profit_pct >= self.threshold:
                    stakes = {odd['p']: (100 / (odd['o'] * inv_sum)) for odd in odds_list}
                    return {'profit': profit_pct, 'stakes': stakes, 'total_inv': inv_sum}
        except ZeroDivisionError: pass
        return None

    def analyze_markets(self, bp_events, cc_events):
        opportunities = []
        matches = self.find_matches(bp_events, cc_events)

        for bp_e, cc_e in matches:
            # Analyze Main Moneyline (1X2 or Win/Loss)
            bp_odds = bp_e.get('odds', {})
            cc_odds = cc_e.get('odds', {})

            # Example for 2-way market (Tennis/Basketball)
            if '1' in bp_odds and '2' in cc_odds and '2' in bp_odds and '1' in cc_odds:
                # Option A: BP win 1, CC win 2
                arb_a = self.calculate_arbitrage([
                    {'p': 'Betpanda', 'o': bp_odds['1']},
                    {'p': 'CoinCasino', 'o': cc_odds['2']}
                ])
                if arb_a:
                    opportunities.append({
                        'event': bp_e['title'],
                        'market': 'Moneyline (BP:1, CC:2)',
                        'profit': arb_a['profit'],
                        'stakes': arb_a['stakes'],
                        'odds': {'Betpanda': bp_odds['1'], 'CoinCasino': cc_odds['2']}
                    })

                # Option B: CC win 1, BP win 2
                arb_b = self.calculate_arbitrage([
                    {'p': 'CoinCasino', 'o': cc_odds['1']},
                    {'p': 'Betpanda', 'o': bp_odds['2']}
                ])
                if arb_b:
                    opportunities.append({
                        'event': bp_e['title'],
                        'market': 'Moneyline (CC:1, BP:2)',
                        'profit': arb_b['profit'],
                        'stakes': arb_b['stakes'],
                        'odds': {'CoinCasino': cc_odds['1'], 'Betpanda': bp_odds['2']}
                    })

        return opportunities
