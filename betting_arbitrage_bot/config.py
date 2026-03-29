import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Bot Config
    TELEGRAM_TOKEN: str = os.getenv("TELEGRAM_TOKEN", "PLACEHOLDER")
    CHAT_ID: int = int(os.getenv("CHAT_ID", 0))

    # Arbitrage Settings
    MIN_PROFIT_PERCENT: float = 1.5
    POLLING_INTERVAL_SECONDS: int = 120
    ACTIVE_SPORTS: list[str] = ["Football", "Basketball", "Tennis", "Esports"]

    # Platform URLs
    BETPANDA_URL: str = "https://betpandacasino.io/en/sportsbook"
    COINCASINO_URL: str = "https://www.coincasino.com/en/sports"

    # Data Storage
    DATA_FILE: str = "opportunities.json"

    # Scraper Settings
    HEADLESS: bool = True
    PROXY_ENABLED: bool = False
    PAID_PROXY_URL: str = os.getenv("PAID_PROXY_URL", "")

    class Config:
        case_sensitive = True

settings = Settings()
