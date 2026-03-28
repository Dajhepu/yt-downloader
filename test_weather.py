
import unittest
from weather_utils import parse_weather_market, calculate_weather_probability

class TestWeatherLogic(unittest.TestCase):
    def test_parsing(self):
        q1 = "Will it rain in New York tomorrow?"
        p1 = parse_weather_market(q1)
        self.assertTrue(p1["is_weather"])
        self.assertEqual(p1["type"], "rain")
        self.assertEqual(p1["city"].lower(), "new york")

        q2 = "Will the temperature in London exceed 25°C?"
        p2 = parse_weather_market(q2)
        self.assertTrue(p2["is_weather"])
        self.assertEqual(p2["type"], "temperature")
        self.assertEqual(p2["threshold"], 25.0)

    def test_probability_rain(self):
        parsed = {"type": "rain", "threshold": None}
        forecast_high = {"precip_prob": [80, 70, 90]}
        forecast_low = {"precip_prob": [10, 5, 20]}

        self.assertEqual(calculate_weather_probability(parsed, forecast_high), 0.8)
        self.assertEqual(calculate_weather_probability(parsed, forecast_low), 0.2)

    def test_probability_temp(self):
        parsed = {"type": "temperature", "threshold": 20.0}
        forecast_high = {"temp": [22, 24, 23]} # Max 24, diff 4
        forecast_low = {"temp": [15, 16, 17]}  # Max 17, diff -3

        self.assertEqual(calculate_weather_probability(parsed, forecast_high), 0.9)
        self.assertEqual(calculate_weather_probability(parsed, forecast_low), 0.3)

if __name__ == "__main__":
    unittest.main()
