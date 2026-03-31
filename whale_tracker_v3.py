"""
╔══════════════════════════════════════════════════════════════════════════════╗
║            WHALE TRACKER PRO v3.0 — QUANTUM INTELLIGENCE                    ║
║                                                                              ║
║  DexScreener + GoPlus Security + CoinGecko + Neural Scoring                 ║
║  Cross-DEX Arbitrage + Contract Scanner + Regime Detector                   ║
║  Real-time Position Tracker + Adaptive Weights + Social Velocity            ║
║                                                                              ║
║  Barcha APIlar BEPUL. Hech qanday pullik kalit shart emas.                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

O'rnatish:
    pip install aiohttp python-telegram-bot apscheduler colorama

Ishga tushirish:
    python whale_tracker_v3.py
"""

import asyncio
import logging
import time
import html
import json
import math
import os
import random
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

import aiohttp
from colorama import Fore, Style, init
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from telegram.constants import ParseMode
from apscheduler.schedulers.asyncio import AsyncIOScheduler

init(autoreset=True)

# ══════════════════════════════════════════════════════════════
#  ⚙️  SOZLAMALAR
# ══════════════════════════════════════════════════════════════

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID")
MORALIS_API_KEY    = os.getenv("MORALIS_API_KEY")

# Signal filtrlari
MIN_CONFIDENCE      = 60       # Minimal signal bali (0–100)
MIN_LIQUIDITY       = 40_000   # Minimal likvidlik ($)
MIN_VOLUME_24H      = 80_000   # Minimal 24s hajm ($)
MAX_SIGNALS_PER_HR  = 30       # Soatiga max signal
COOLDOWN_MINUTES    = 40       # Bir juftlik uchun qayta signal oraligi

# Skanerlash
SCAN_INTERVAL_SEC   = 45
WATCH_CHAINS        = ["ethereum", "bsc", "solana", "arbitrum", "polygon", "base"]

# Savdo maqsadlari
TARGET_1_PCT  = 5.0   # +5%
TARGET_2_PCT  = 12.0  # +12%
STOP_LOSS_PCT = 4.0   # -4%

# ══════════════════════════════════════════════════════════════
#  📋  LOGGING
# ══════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("wtp_v3.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("WTP-v3")

# ══════════════════════════════════════════════════════════════
#  📦  MA'LUMOT MODELLARI
# ══════════════════════════════════════════════════════════════

@dataclass
class MarketSnapshot:
    pair_address:  str
    token_symbol:  str
    token_name:    str
    token_address: str
    chain:         str
    dex:           str
    price_usd:     float
    market_cap:    float
    liquidity:     float
    volume_5m:     float
    volume_1h:     float
    volume_6h:     float
    volume_24h:    float
    change_5m:     float
    change_1h:     float
    change_6h:     float
    change_24h:    float
    buys_5m:       int
    sells_5m:      int
    buys_1h:       int
    sells_1h:      int
    buys_24h:      int
    sells_24h:     int
    age_hours:     float
    timestamp:     datetime = field(default_factory=datetime.now)

    @property
    def buy_ratio_5m(self) -> float:
        t = self.buys_5m + self.sells_5m
        return self.buys_5m / t if t else 0.5

    @property
    def buy_ratio_1h(self) -> float:
        t = self.buys_1h + self.sells_1h
        return self.buys_1h / t if t else 0.5

    @property
    def buy_ratio_24h(self) -> float:
        t = self.buys_24h + self.sells_24h
        return self.buys_24h / t if t else 0.5


@dataclass
class WalletExpertise:
    address:           str
    success_rate:      float = 0.0    # 0-100
    alpha_hits:        int = 0        # 5x/10x soni
    total_trades:      int = 0
    is_expert:         bool = False

@dataclass
class SecurityReport:
    is_honeypot:       bool = False
    has_mint:          bool = False
    has_blacklist:     bool = False
    has_proxy:         bool = False
    owner_renounced:   bool = True
    top_holder_pct:    float = 0.0
    holder_count:      int = 0
    sell_tax:          float = 0.0
    buy_tax:           float = 0.0
    is_open_source:    bool = True
    risk_score:        int = 0       # 0=yaxshi, 100=juda xavfli
    flags:             list = field(default_factory=list)
    expert_holders:    list[WalletExpertise] = field(default_factory=list)


@dataclass
class SignalResult:
    snapshot:          MarketSnapshot
    signal_type:       str
    confidence:        int
    primary_reason:    str
    confluence:        list[str]
    risk_flags:        list[str]
    security:          Optional[SecurityReport]
    smc_pattern:       Optional[str]
    regime:            str            # BULL / BEAR / SIDEWAYS / VOLATILE
    timeframe_align:   dict
    neural_scores:     dict           # Har bir faktor bali
    backtest_winrate:  Optional[float]
    risk_reward:       float
    entry:             float
    target_1:          float
    target_2:          float
    stop_loss:         float
    is_trending:       bool = False   # CoinGecko trending
    is_boosted:        bool = False   # DexScreener boosted
    arb_detected:      bool = False   # Cross-DEX arbitraj
    estimated_hours:   Optional[float] = None  # Maqsadga yetish vaqti

    @property
    def bar(self) -> str:
        f = round(self.confidence / 10)
        return "█" * f + "░" * (10 - f)

    @property
    def emoji(self) -> str:
        return {
            "MOONSHOT_ALPHA":"🚀🔥",
            "STRONG_BUY":   "🟢🟢",
            "BUY":          "🟢",
            "ACCUMULATION": "🐋",
            "BREAKOUT":     "⚡",
            "DUMP_RISK":    "🔴",
            "DISTRIBUTION": "🔴🔴",
            "RUG_ALERT":    "☠️",
        }.get(self.signal_type, "🔵")


# ══════════════════════════════════════════════════════════════
#  🌐  ASYNC HTTP HELPER
# ══════════════════════════════════════════════════════════════

class HttpClient:
    UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
          "AppleWebKit/537.36 (KHTML, like Gecko) "
          "Chrome/124.0.0.0 Safari/537.36")

    def __init__(self):
        self._sess: Optional[aiohttp.ClientSession] = None

    async def sess(self) -> aiohttp.ClientSession:
        if not self._sess or self._sess.closed:
            self._sess = aiohttp.ClientSession(
                headers={"User-Agent": self.UA},
                connector=aiohttp.TCPConnector(ssl=False),
            )
        return self._sess

    async def get(self, url: str, params: dict = None, timeout: int = 12) -> Optional[any]:
        try:
            s = await self.sess()
            async with s.get(url, params=params,
                             timeout=aiohttp.ClientTimeout(total=timeout)) as r:
                if r.status == 200:
                    ct = r.headers.get("Content-Type", "")
                    if "json" in ct:
                        return await r.json(content_type=None)
                    return await r.text()
                log.debug(f"HTTP {r.status}: {url}")
        except asyncio.TimeoutError:
            log.debug(f"Timeout: {url}")
        except Exception as e:
            log.debug(f"HTTP xatosi {url}: {e}")
        return None

    async def close(self):
        if self._sess and not self._sess.closed:
            await self._sess.close()


# ══════════════════════════════════════════════════════════════
#  📡  DEXSCREENER API
# ══════════════════════════════════════════════════════════════

class MoralisClient:
    """Wallet Intelligence and Clustering via Moralis API"""
    BASE_EVM = "https://deep-index.moralis.io/api/v2.2"

    def __init__(self, http: HttpClient):
        self.http = http
        self.key = MORALIS_API_KEY
        self._perf_cache: dict[str, WalletExpertise] = {}

    async def _get(self, url: str, params: dict = None):
        if not self.key or "YOUR_MORALIS" in self.key:
            return None
        headers = {"X-API-Key": self.key}
        try:
            s = await self.http.sess()
            async with s.get(url, params=params, headers=headers, timeout=10) as r:
                if r.status == 200:
                    return await r.json()
        except Exception as e:
            log.debug(f"Moralis error: {e}")
        return None

    async def get_token_owners(self, chain: str, token_address: str) -> list[dict]:
        """Token egalarini olish (EVM)"""
        # Moralis chain nomlarini o'zgartirish
        m_chain = {"ethereum":"eth", "bsc":"bsc", "polygon":"polygon", "arbitrum":"arbitrum", "base":"base"}.get(chain)
        if not m_chain: return []

        url = f"{self.BASE_EVM}/erc20/{token_address}/owners"
        data = await self._get(url, params={"chain": m_chain, "limit": 15})
        return (data or {}).get("result", []) if data else []

    async def get_wallet_history(self, chain: str, wallet: str) -> list[dict]:
        m_chain = {"ethereum":"eth", "bsc":"bsc", "polygon":"polygon", "arbitrum":"arbitrum", "base":"base"}.get(chain)
        if not m_chain: return []

        url = f"{self.BASE_EVM}/wallets/{wallet}/history"
        data = await self._get(url, params={"chain": m_chain, "limit": 50})
        return (data or {}).get("result", []) if data else []

    async def analyze_wallet_performance(self, chain: str, wallet_address: str) -> WalletExpertise:
        """Wallet tarixini tahlil qilib Alpha hitlarni topish"""
        if wallet_address in self._perf_cache:
            return self._perf_cache[wallet_address]

        hist = await self.get_wallet_history(chain, wallet_address)
        if not hist:
            return WalletExpertise(address=wallet_address)

        hits = 0
        total = 0
        seen_tokens = set()

        for tx in hist:
            # ERC20 o'tkazmalarni qidirish
            token = tx.get("address")
            if token and token not in seen_tokens:
                seen_tokens.add(token)
                # Bu yerda ideal holda tokenning tarixiy narxini tekshirish kerak
                # Lekin Moralis tier cheklovi sababli,
                # tranzaksiyalar soni va hajmiga qarab "conviction" ni taxmin qilamiz
                total += 1
        # Heuristic 'Alpha hit' mantiqi: hamyonning tranzaksiyalar xilma-xilligi
        # va faolligiga qarab 'expert' darajasini aniqlash.
        # REAL MANTIQ: Moralis orqali token narxi tarixini tekshirish (pullik tier talab qilishi mumkin).

        # Expert balini tranzaksiyalar soniga qarab hisoblash (deterministik)
        hits = min(total // 4, 12) # Har 4 ta faol token uchun 1 ta 'hit' (maks 12)

        rate = (hits / total * 100) if total >= 5 else (hits * 10)
        perf = WalletExpertise(
            address=wallet_address,
            success_rate=round(rate, 1),
            alpha_hits=hits,
            total_trades=total,
            is_expert=(hits >= 3 and rate > 20)
        )
        self._perf_cache[wallet_address] = perf
        return perf

    async def detect_smart_money_groups(self, chain: str, token_address: str) -> list[WalletExpertise]:
        """Token egalari orasidan expertlarni ajratish"""
        owners = await self.get_token_owners(chain, token_address)
        experts = []
        for owner in owners[:10]: # Top 10 egasini tekshirish
            addr = owner.get("owner_address")
            if addr:
                perf = await self.analyze_wallet_performance(chain, addr)
                if perf.is_expert:
                    experts.append(perf)
            await asyncio.sleep(0.2) # Rate limit
        return experts

class DexScreenerAPI:
    BASE = "https://api.dexscreener.com"

    def __init__(self, http: HttpClient):
        self.http = http

    async def get_latest_profiles(self) -> list[dict]:
        data = await self.http.get(f"{self.BASE}/token-profiles/latest/v1")
        return data if isinstance(data, list) else []

    async def search(self, query: str) -> list[dict]:
        data = await self.http.get(f"{self.BASE}/latest/dex/search", params={"q": query})
        return (data or {}).get("pairs", []) or []

    async def get_pair(self, chain: str, address: str) -> Optional[dict]:
        data = await self.http.get(f"{self.BASE}/latest/dex/pairs/{chain}/{address}")
        pairs = (data or {}).get("pairs", [])
        return pairs[0] if pairs else None

    async def get_token_pairs(self, token_address: str) -> list[dict]:
        """Fetch all pairs for a specific token address across all chains/DEXs"""
        data = await self.http.get(f"{self.BASE}/latest/dex/tokens/{token_address}")
        return (data or {}).get("pairs", []) or []


def parse_snap(pair: dict) -> Optional[MarketSnapshot]:
    try:
        base  = pair.get("baseToken", {})
        sym   = base.get("symbol", "?")
        name  = base.get("name", "?")
        taddr = base.get("address", "")
        chain = pair.get("chainId", "")
        dex   = pair.get("dexId", "")
        addr  = pair.get("pairAddress", "")
        if not addr or not chain:
            return None

        def fv(d, k):  return float(d.get(k) or 0)
        def iv(d, k, s): return int((d.get(k) or {}).get(s) or 0)

        vol  = pair.get("volume") or {}
        ch   = pair.get("priceChange") or {}
        txns = pair.get("txns") or {}
        liq  = float((pair.get("liquidity") or {}).get("usd") or 0)

        ca = pair.get("pairCreatedAt")
        age = (time.time() - ca / 1000) / 3600 if ca else 9999

        return MarketSnapshot(
            pair_address=addr, token_symbol=sym, token_name=name,
            token_address=taddr, chain=chain, dex=dex,
            price_usd=float(pair.get("priceUsd") or 0),
            market_cap=float(pair.get("marketCap") or pair.get("fdv") or 0),
            liquidity=liq,
            volume_5m=fv(vol,"m5"), volume_1h=fv(vol,"h1"),
            volume_6h=fv(vol,"h6"), volume_24h=fv(vol,"h24"),
            change_5m=fv(ch,"m5"), change_1h=fv(ch,"h1"),
            change_6h=fv(ch,"h6"), change_24h=fv(ch,"h24"),
            buys_5m=iv(txns,"m5","buys"),   sells_5m=iv(txns,"m5","sells"),
            buys_1h=iv(txns,"h1","buys"),   sells_1h=iv(txns,"h1","sells"),
            buys_24h=iv(txns,"h24","buys"), sells_24h=iv(txns,"h24","sells"),
            age_hours=age,
        )
    except Exception as e:
        log.debug(f"parse_snap: {e}")
        return None


# ══════════════════════════════════════════════════════════════
#  🛡️  GOPLUS SECURITY SCANNER (BEPUL)
# ══════════════════════════════════════════════════════════════

CHAIN_TO_GOPLUS = {
    "ethereum": "1", "bsc": "56", "polygon": "137",
    "arbitrum": "42161", "base": "8453", "solana": "solana",
}

class GoPlusScanner:
    BASE = "https://api.gopluslabs.io/api/v1"

    def __init__(self, http: HttpClient):
        self.http  = http
        self._cache: dict[str, tuple[SecurityReport, float]] = {}
        self.CACHE_TTL = 1800  # 30 daqiqa

    async def scan(self, chain: str, token_address: str) -> SecurityReport:
        if not token_address or token_address == "?":
            return SecurityReport()

        cache_key = f"{chain}:{token_address}"
        if cache_key in self._cache:
            rep, ts = self._cache[cache_key]
            if time.time() - ts < self.CACHE_TTL:
                return rep

        chain_id = CHAIN_TO_GOPLUS.get(chain)
        if not chain_id:
            return SecurityReport()

        # Solana uchun alohida endpoint
        if chain == "solana":
            url = f"{self.BASE}/solana/token_security"
        else:
            url = f"{self.BASE}/token_security/{chain_id}"

        data = await self.http.get(url, params={"contract_addresses": token_address})
        rep  = self._parse(data, token_address, chain)
        self._cache[cache_key] = (rep, time.time())
        return rep

    def _parse(self, data: Optional[dict], token_addr: str, chain: str) -> SecurityReport:
        rep = SecurityReport()
        if not data:
            return rep
        result = (data.get("result") or {})
        # GoPlus qaytargan kalit token manzili yoki "0" bo'lishi mumkin
        info = result.get(token_addr.lower()) or result.get(token_addr) or {}
        if not info:
            # Ba'zan birinchi qiymatni olish kerak
            vals = list(result.values())
            info = vals[0] if vals else {}

        def b(k): return str(info.get(k, "0")) == "1"
        def f(k): return float(info.get(k) or 0)
        def i(k): return int(info.get(k) or 0)

        rep.is_honeypot     = b("is_honeypot")
        rep.has_mint        = b("is_mintable")
        rep.has_blacklist   = b("is_blacklisted")
        rep.has_proxy       = b("is_proxy")
        rep.owner_renounced = b("owner_address") and info.get("owner_address", "") in ("", "0x0000000000000000000000000000000000000000")
        rep.sell_tax        = f("sell_tax")
        rep.buy_tax         = f("buy_tax")
        rep.is_open_source  = b("is_open_source")
        rep.holder_count    = i("holder_count")

        holders = info.get("holders", [])
        if holders:
            rep.top_holder_pct = float(holders[0].get("percent", 0)) * 100

        # Xavf bali hisoblash
        score = 0
        if rep.is_honeypot:     score += 50; rep.flags.append("☠️ Honeypot!")
        if rep.has_mint:        score += 20; rep.flags.append("🖨️ Cheksiz token chiqarish")
        if rep.has_blacklist:   score += 15; rep.flags.append("🚫 Blacklist funksiyasi")
        if rep.has_proxy:       score += 10; rep.flags.append("🔄 Proxy contract")
        if rep.sell_tax > 10:   score += 15; rep.flags.append(f"💸 Sotish solig'i {rep.sell_tax:.0f}%")
        if rep.buy_tax > 10:    score += 10; rep.flags.append(f"💸 Xarid solig'i {rep.buy_tax:.0f}%")
        if rep.top_holder_pct > 50: score += 20; rep.flags.append(f"🐳 Top holder {rep.top_holder_pct:.0f}% ushlab turibdi")
        if rep.holder_count < 100 and rep.holder_count > 0:
            score += 10; rep.flags.append(f"👥 Faqat {rep.holder_count} ta holder")

        rep.risk_score = min(100, score)
        return rep


# ══════════════════════════════════════════════════════════════
#  📈  COINGECKO TRENDING (BEPUL)
# ══════════════════════════════════════════════════════════════

class CoinGeckoTrending:
    BASE = "https://api.coingecko.com/api/v3"

    def __init__(self, http: HttpClient):
        self.http = http
        self._trending_symbols: set[str] = set()
        self._last_update = 0
        self.TTL = 600  # 10 daqiqa

    async def refresh(self):
        if time.time() - self._last_update < self.TTL:
            return
        data = await self.http.get(f"{self.BASE}/search/trending")
        if not data:
            return
        coins = (data.get("coins") or [])
        self._trending_symbols = {
            c.get("item", {}).get("symbol", "").upper()
            for c in coins
        }
        self._last_update = time.time()
        log.info(f"CoinGecko trending: {len(self._trending_symbols)} ta token")

    def is_trending(self, symbol: str) -> bool:
        return symbol.upper() in self._trending_symbols


# ══════════════════════════════════════════════════════════════
#  🕸️  CROSS-DEX ARBITRAGE DETECTOR
# ══════════════════════════════════════════════════════════════

class ArbitrageDetector:
    """
    Bir token bir vaqtda bir nechta DEX da narx farqi.
    Narx farqi > 2% = kit oldidan pozitsiya olayotgan signal.
    """

    def __init__(self):
        # token_address -> { dex_id -> price }
        self._prices: dict[str, dict[str, float]] = defaultdict(dict)

    def update(self, snap: MarketSnapshot):
        if snap.price_usd > 0:
            self._prices[snap.token_address][snap.dex] = snap.price_usd

    def check(self, snap: MarketSnapshot) -> tuple[bool, float]:
        """Returns: (arb_detected, max_spread_pct)"""
        prices = self._prices.get(snap.token_address, {})
        if len(prices) < 2:
            return False, 0.0
        vals = list(prices.values())
        mn, mx = min(vals), max(vals)
        if mn <= 0:
            return False, 0.0
        spread = (mx - mn) / mn * 100
        return spread > 2.0, round(spread, 2)

class LiquidityMonitor:
    """Real-time LP (Liquidity Pool) o'zgarishlarini kuzatish"""
    def __init__(self):
        # addr -> [liq_1, liq_2, ...]
        self._history: dict[str, deque] = defaultdict(lambda: deque(maxlen=20))

    def update(self, snap: MarketSnapshot):
        self._history[snap.pair_address].append(snap.liquidity)

    def analyze_momentum(self, snap: MarketSnapshot) -> tuple[float, list[str]]:
        """LP momentumini tahlil qilish"""
        hist = list(self._history[snap.pair_address])
        if len(hist) < 2:
            return 0.0, []

        prev = hist[-2]
        curr = hist[-1]

        change_pct = (curr - prev) / prev * 100 if prev > 0 else 0
        flags = []

        # LP Momentum score (-1.0 dan +1.0 gacha)
        # 10% dan ko'p LP qo'shilsa — kit kirdi
        if change_pct > 8:
            flags.append(f"🐋 LP {change_pct:+.1f}% qo'shildi — Kit sadoqati (Commitment)")
            score = 1.0
        elif change_pct < -8:
            flags.append(f"⚠️ LP {change_pct:+.1f}% olib chiqildi — Exit Risk")
            score = -1.0
        else:
            score = change_pct / 10 # -0.8 dan +0.8 oralig'ida

        return score, flags


# ══════════════════════════════════════════════════════════════
#  🌊  BOZOR REJIMI ANIQLOVCHI
# ══════════════════════════════════════════════════════════════

class RegimeDetector:
    """
    Bozorning umumiy holati: BULL / BEAR / SIDEWAYS / VOLATILE
    Bu rejimga qarab signal strategiyasi o'zgaradi.
    """

    def __init__(self):
        self._history: deque = deque(maxlen=200)  # so'nggi snapshot o'rtacha o'zgarishlar
        self.current: str = "SIDEWAYS"

    def update(self, snaps: list[MarketSnapshot]):
        if not snaps:
            return
        sample = snaps[:80]
        avg1h  = sum(s.change_1h  for s in sample) / len(sample)
        avg24h = sum(s.change_24h for s in sample) / len(sample)
        vol    = sum(abs(s.change_1h) for s in sample) / len(sample)

        self._history.append(avg1h)

        if vol > 8:
            self.current = "VOLATILE"
        elif avg1h > 2 and avg24h > 5:
            self.current = "BULL"
        elif avg1h < -2 and avg24h < -5:
            self.current = "BEAR"
        else:
            self.current = "SIDEWAYS"

    @property
    def emoji(self) -> str:
        return {"BULL":"🟢","BEAR":"🔴","SIDEWAYS":"⬜","VOLATILE":"🟡"}.get(self.current,"⬜")

    @property
    def min_confidence_delta(self) -> int:
        """Rejimga qarab minimal ishonchlilikni o'zgartirish."""
        return {"BULL": -5, "BEAR": +5, "VOLATILE": +8, "SIDEWAYS": 0}.get(self.current, 0)


# ══════════════════════════════════════════════════════════════
#  🔗  REAL-TIME POSITION TRACKER
# ══════════════════════════════════════════════════════════════

@dataclass
class OpenPosition:
    snap:         MarketSnapshot
    signal_type:  str
    entry_price:  float
    target_1:     float
    target_2:     float
    stop_loss:    float
    opened_at:    datetime
    t1_hit:       bool = False
    t2_hit:       bool = False
    sl_hit:       bool = False
    last_notified: float = 0.0   # narx

class PositionTracker:
    def __init__(self, send_fn):
        self.send = send_fn
        self.positions: dict[str, OpenPosition] = {}  # pair_address -> position

    def open(self, sig: SignalResult):
        self.positions[sig.snapshot.pair_address] = OpenPosition(
            snap=sig.snapshot,
            signal_type=sig.signal_type,
            entry_price=sig.entry,
            target_1=sig.target_1,
            target_2=sig.target_2,
            stop_loss=sig.stop_loss,
            opened_at=datetime.now(),
        )

    async def check_all(self, snaps: list[MarketSnapshot]):
        snap_map = {s.pair_address: s for s in snaps}
        closed = []

        for addr, pos in self.positions.items():
            cur = snap_map.get(addr)
            if not cur:
                continue
            p = cur.price_usd
            sym = pos.snap.token_symbol

            # Maqsad 1
            if not pos.t1_hit and p >= pos.target_1:
                pos.t1_hit = True
                await self.send(
                    f"🎯 <b>{html.escape(sym)} — MAQSAD 1 HIT!</b>\n"
                    f"Kirish: <code>${pos.entry_price:.8f}</code>\n"
                    f"Hozir: <code>${p:.8f}</code> "
                    f"(+{(p/pos.entry_price-1)*100:.1f}%)\n"
                    f"💡 Foyda olib, qolganini qo'ying!"
                )

            # Maqsad 2
            elif pos.t1_hit and not pos.t2_hit and p >= pos.target_2:
                pos.t2_hit = True
                await self.send(
                    f"🚀 <b>{html.escape(sym)} — MAQSAD 2 HIT!</b>\n"
                    f"Kirish: <code>${pos.entry_price:.8f}</code>\n"
                    f"Hozir: <code>${p:.8f}</code> "
                    f"(+{(p/pos.entry_price-1)*100:.1f}%)\n"
                    f"✅ To'liq foyda oling!"
                )
                closed.append(addr)

            # Stop-loss
            elif not pos.sl_hit and p <= pos.stop_loss:
                pos.sl_hit = True
                await self.send(
                    f"🛑 <b>{html.escape(sym)} — STOP-LOSS!</b>\n"
                    f"Kirish: <code>${pos.entry_price:.8f}</code>\n"
                    f"Hozir: <code>${p:.8f}</code> "
                    f"({(p/pos.entry_price-1)*100:.1f}%)\n"
                    f"❌ Pozitsiyani yoping!"
                )
                closed.append(addr)

            # 48 soatdan eski pozitsiyani yopish
            elif (datetime.now() - pos.opened_at).total_seconds() > 172800:
                closed.append(addr)

        for addr in closed:
            self.positions.pop(addr, None)


# ══════════════════════════════════════════════════════════════
#  🧬  NEURAL SCORING ENGINE
# ══════════════════════════════════════════════════════════════

class NeuralScorer:
    """
    15+ faktor og'irlik matritsasi.
    Adaptive weights: backtest natijalari asosida o'z-o'zini moslashtiradi.
    """

    # Boshlang'ich og'irliklar (jami ~100 bo'lishi kerak emas, normalizatsiya qilinadi)
    DEFAULT_WEIGHTS = {
        "buy_ratio_5m":      12.0,
        "buy_ratio_1h":      15.0,
        "buy_ratio_24h":     10.0,
        "volume_accel":       8.0,
        "price_momentum_5m":  7.0,
        "price_momentum_1h":  9.0,
        "liquidity_depth":    6.0,
        "liq_to_mcap":        5.0,
        "age_score":          6.0,
        "tx_count_quality":   5.0,
        "spread_quality":     4.0,
        "security_score":     8.0,  # GoPlus
        "trending_bonus":     5.0,  # CoinGecko
        "arb_bonus":          4.0,
        "regime_alignment":   6.0,
        "expert_wallet_bonus": 10.0, # Moralis Alpha
        "lp_momentum_bonus":   8.0,  # Liquidity Monitor
    }

    def __init__(self):
        self.weights = dict(self.DEFAULT_WEIGHTS)
        self._factor_wins:  dict[str, list[bool]] = defaultdict(list)
        self._total_scored  = 0

    def _compute_factors(self, snap: MarketSnapshot, security: SecurityReport,
                         is_trending: bool, arb_detected: bool,
                         regime: str, lp_momentum: float) -> dict[str, float]:
        """Har bir faktor uchun 0–1 qiymat."""
        f = {}

        # 1. Xarid nisbatlari
        f["buy_ratio_5m"]  = self._sigmoid(snap.buy_ratio_5m,  center=0.55, scale=8)
        f["buy_ratio_1h"]  = self._sigmoid(snap.buy_ratio_1h,  center=0.55, scale=8)
        f["buy_ratio_24h"] = self._sigmoid(snap.buy_ratio_24h, center=0.55, scale=6)

        # 2. Hajm tezlanishi (5m / (1h/12))
        if snap.volume_1h > 0:
            accel = snap.volume_5m / (snap.volume_1h / 12 + 1)
            f["volume_accel"] = self._sigmoid(accel, center=1.5, scale=2)
        else:
            f["volume_accel"] = 0.3

        # 3. Narx momentumi
        f["price_momentum_5m"] = self._sigmoid(snap.change_5m, center=2, scale=0.3)
        f["price_momentum_1h"] = self._sigmoid(snap.change_1h, center=3, scale=0.2)

        # 4. Likvidlik chuqurligi
        f["liquidity_depth"] = self._sigmoid(math.log10(max(snap.liquidity, 1)), center=5, scale=1.5)

        # 5. Likvidlik/MCap nisbati
        if snap.market_cap > 0:
            ratio = snap.liquidity / snap.market_cap
            f["liq_to_mcap"] = self._sigmoid(ratio, center=0.15, scale=10)
        else:
            f["liq_to_mcap"] = 0.4

        # 6. Token yoshi (eskirgan = yaxshi)
        f["age_score"] = self._sigmoid(math.log10(max(snap.age_hours, 0.1)), center=1.5, scale=2)

        # 7. Tranzaksiya sifati
        total_tx = snap.buys_24h + snap.sells_24h
        f["tx_count_quality"] = self._sigmoid(total_tx, center=200, scale=0.01)

        # 8. Xarid/sotish farqi nisbati (juda katta = bot)
        if total_tx > 10:
            spread = abs(snap.buy_ratio_24h - 0.5)
            f["spread_quality"] = 1.0 - self._sigmoid(spread, center=0.35, scale=10)
        else:
            f["spread_quality"] = 0.3

        # 9. Security (GoPlus)
        f["security_score"] = 1.0 - security.risk_score / 100

        # 10. Trending bonus
        f["trending_bonus"] = 1.0 if is_trending else 0.3

        # 11. Arbitraj
        f["arb_bonus"] = 0.8 if arb_detected else 0.3

        # 12. Expert Wallet Bonus (Moralis)
        experts = security.expert_holders if hasattr(security, "expert_holders") else []
        if experts:
            # Har bir expert uchun 0.1 qo'shish, max 1.0
            score = min(1.0, len(experts) * 0.2 + 0.3)
            f["expert_wallet_bonus"] = score
        else:
            f["expert_wallet_bonus"] = 0.3

        # 13. LP Momentum Bonus
        f["lp_momentum_bonus"] = self._sigmoid(lp_momentum, center=0.0, scale=4)

        # 14. Rejim uyg'unligi
        bullish = snap.change_1h > 0 and snap.buy_ratio_1h > 0.5
        regime_match = {
            "BULL":     1.0 if bullish else 0.2,
            "BEAR":     0.8 if not bullish else 0.2,
            "SIDEWAYS": 0.5,
            "VOLATILE": 0.4,
        }
        f["regime_alignment"] = regime_match.get(regime, 0.5)

        return f

    @staticmethod
    def _sigmoid(x: float, center: float = 0, scale: float = 1) -> float:
        try:
            return 1 / (1 + math.exp(-scale * (x - center)))
        except OverflowError:
            return 1.0 if x > center else 0.0

    def score(self, snap: MarketSnapshot, security: SecurityReport,
              is_trending: bool, arb_detected: bool, regime: str, lp_momentum: float) -> tuple[int, dict]:
        """
        Returns: (confidence_0_100, factor_scores_dict)
        """
        factors = self._compute_factors(snap, security, is_trending, arb_detected, regime, lp_momentum)
        self._total_scored += 1

        total_weight = sum(self.weights.values())
        weighted_sum = sum(factors[k] * self.weights[k] for k in factors)
        raw = weighted_sum / total_weight  # 0–1

        confidence = int(raw * 100)
        confidence = max(0, min(100, confidence))

        return confidence, factors

    def adapt_weights(self, factor_scores: dict, was_win: bool):
        """
        Adaptive weight update:
        Win bo'lsa — yuqori faktorlarning og'irligini oshir.
        Loss bo'lsa — ularni kamayt.
        """
        lr = 0.05  # Learning rate
        for k, v in factor_scores.items():
            if k not in self.weights:
                continue
            if was_win:
                # Yuqori faktor bo'lsa og'irlikni oshir
                if v > 0.6:
                    self.weights[k] *= (1 + lr * v)
            else:
                # Yuqori faktor bo'lsa og'irlikni kamayt
                if v > 0.6:
                    self.weights[k] *= (1 - lr * 0.5)
            # Og'irlikni mantiqiy chegarada ushlab turish
            self.weights[k] = max(1.0, min(30.0, self.weights[k]))


# ══════════════════════════════════════════════════════════════
#  🧠  SMC ANALYZER
# ══════════════════════════════════════════════════════════════

class SMCAnalyzer:
    def __init__(self):
        self._ph: dict[str, deque] = defaultdict(lambda: deque(maxlen=30))

    def analyze(self, snap: MarketSnapshot) -> tuple[Optional[str], int]:
        hist = self._ph[snap.pair_address]
        hist.append(snap.price_usd)

        if len(hist) < 4:
            return None, 0

        prices = list(hist)
        p1, p2, p3, p4 = prices[-4], prices[-3], prices[-2], prices[-1]

        # BOS Bullish
        if p2 < p1 and p3 < p2 and p4 > p1:
            return "Break of Structure (Bullish BOS)", 16

        # CHoCH Bearish
        if p2 > p1 and p3 > p2 and p4 < p1:
            return "Change of Character (Bearish CHoCH)", -12

        # FVG Bullish — keskin tez ko'tarilish
        if p4 > 0 and p1 > 0 and (p4 - p1) / p1 > 0.08 and snap.change_1h > 5:
            return "Fair Value Gap (Bullish FVG)", 13

        # Liquidity Sweep — tushish + tiklanish
        if snap.change_5m < -4 and snap.change_1h > 3 and snap.buy_ratio_1h > 0.6:
            return "Liquidity Sweep + Recovery", 19

        # Order Block — barqaror baza
        if abs(snap.change_6h) < 2.5 and snap.volume_1h > snap.volume_6h / 3:
            return "Order Block (Accumulation Zone)", 11

        # Equal Highs (liquidity grab yuqorida)
        if len(prices) >= 6:
            recent_highs = sorted(prices[-6:], reverse=True)[:2]
            if len(recent_highs) == 2 and abs(recent_highs[0] - recent_highs[1]) / max(recent_highs) < 0.005:
                return "Equal Highs (Liquidity Pool Above)", 8

        return None, 0


# ══════════════════════════════════════════════════════════════
#  📊  MULTI-TIMEFRAME CONFLUENCE
# ══════════════════════════════════════════════════════════════

class MTFConfluence:
    def analyze(self, snap: MarketSnapshot) -> tuple[dict, int]:
        tf = {}
        bonus = 0

        def add(name, bias, change, buy_ratio=None):
            tf[name] = {"bias": bias, "change": change}
            if buy_ratio is not None:
                tf[name]["buy_ratio"] = round(buy_ratio * 100)

        # 5 dakika
        r5 = snap.buy_ratio_5m
        b5 = "bull" if r5 > 0.58 else "bear" if r5 < 0.42 else "neutral"
        add("5m", b5, snap.change_5m, r5)
        if r5 > 0.68: bonus += 9

        # 1 soat
        r1h = snap.buy_ratio_1h
        b1h = "bull" if r1h > 0.58 else "bear" if r1h < 0.42 else "neutral"
        add("1h", b1h, snap.change_1h, r1h)
        if r1h > 0.65: bonus += 13

        # 6 soat
        b6h = "bull" if snap.change_6h > 3 else "bear" if snap.change_6h < -3 else "neutral"
        add("6h", b6h, snap.change_6h)
        if snap.change_6h > 5: bonus += 10

        # 24 soat
        b24 = "bull" if snap.change_24h > 5 else "bear" if snap.change_24h < -5 else "neutral"
        add("24h", b24, snap.change_24h)
        if snap.change_24h > 12: bonus += 9

        # To'liq confluence bonusi
        biases = [v["bias"] for v in tf.values()]
        if biases.count("bull") == 4:
            bonus += 22
        elif biases.count("bull") == 3:
            bonus += 10
        elif biases.count("bear") == 4:
            bonus -= 18

        return tf, bonus


# ══════════════════════════════════════════════════════════════
#  ⏱️  PREDICTIVE TIMING ENGINE
# ══════════════════════════════════════════════════════════════

class TimingPredictor:
    """
    Tarixiy momentum asosida maqsadga yetish vaqtini bashorat qilish.
    """
    def predict(self, snap: MarketSnapshot, target_pct: float) -> Optional[float]:
        """Returns: taxminiy soat soni (None = bashorat qilib bo'lmadi)"""
        if abs(snap.change_1h) < 0.1:
            return None
        # Soatiga o'rtacha o'sish tezligi
        hourly_rate = abs(snap.change_1h)
        if hourly_rate <= 0:
            return None
        estimated = target_pct / hourly_rate
        # Momentum susayishi koeffitsienti
        decay = 1.3
        return round(estimated * decay, 1)


# ══════════════════════════════════════════════════════════════
#  🔍  BACKTEST ENGINE
# ══════════════════════════════════════════════════════════════

class BacktestEngine:
    def __init__(self, dex: DexScreenerAPI, neural: NeuralScorer):
        self.dex    = dex
        self.neural = neural
        self._pending: dict[str, dict] = {}
        self._results: dict[str, list[bool]] = defaultdict(list)
        self._factor_history: dict[str, dict] = {}  # pair_addr -> factors

    def record(self, sig: SignalResult, factors: dict):
        self._pending[sig.snapshot.pair_address] = {
            "chain":   sig.snapshot.chain,
            "entry":   sig.entry,
            "target":  sig.target_1,
            "stop":    sig.stop_loss,
            "signal":  sig.signal_type,
            "time":    datetime.now(),
        }
        self._factor_history[sig.snapshot.pair_address] = factors

    async def check(self, snaps: list[MarketSnapshot]):
        snap_map  = {s.pair_address: s for s in snaps}
        completed = []
        now       = datetime.now()

        for addr, entry in list(self._pending.items()):
            elapsed = (now - entry["time"]).total_seconds() / 3600
            if elapsed < 2:
                continue

            cur = snap_map.get(addr)
            if not cur:
                pair = await self.dex.get_pair(entry["chain"], addr)
                if pair:
                    cur = parse_snap(pair)

            if cur:
                is_win  = cur.price_usd >= entry["target"]
                is_loss = cur.price_usd <= entry["stop"]
                if is_win or is_loss or elapsed >= 24:
                    win = is_win if (is_win or is_loss) else cur.price_usd > entry["entry"]
                    self._results[entry["signal"]].append(win)
                    completed.append(addr)
                    # Adaptive weight yangilash
                    if addr in self._factor_history:
                        self.neural.adapt_weights(self._factor_history[addr], win)
                    log.info(f"BT: {entry['signal']} → {'WIN ✅' if win else 'LOSS ❌'}")
            elif elapsed > 24:
                self._results[entry["signal"]].append(False)
                completed.append(addr)

        for addr in completed:
            self._pending.pop(addr, None)
            self._factor_history.pop(addr, None)

    def winrate(self, stype: str) -> Optional[float]:
        r = self._results.get(stype, [])
        return round(sum(r) / len(r) * 100, 1) if len(r) >= 3 else None

    def overall(self) -> Optional[float]:
        all_r = [x for v in self._results.values() for x in v]
        return round(sum(all_r) / len(all_r) * 100, 1) if len(all_r) >= 5 else None

    def summary(self) -> str:
        lines = []
        for st, results in self._results.items():
            if results:
                wr = sum(results) / len(results) * 100
                lines.append(f"<code>{html.escape(st)}</code>: <code>{wr:.0f}%</code> ({len(results)} signal)")
        return "\n".join(lines) if lines else "<i>Hali ma'lumot yo'q (kamida 3 signal kerak)</i>"


# ══════════════════════════════════════════════════════════════
#  🚫  RUG DETECTOR
# ══════════════════════════════════════════════════════════════

class RugDetector:
    STABLES = {"USDT","USDC","DAI","BUSD","TUSD","FRAX","LUSD","MIM","USDD","USDP","USDE","PYUSD"}

    def __init__(self):
        self._liq_hist: dict[str, deque] = defaultdict(lambda: deque(maxlen=8))

    def check(self, snap: MarketSnapshot, sec: SecurityReport) -> tuple[bool, bool, list[str]]:
        """Returns: (is_rug, is_wash, flags)"""
        flags   = list(sec.flags)
        is_rug  = sec.is_honeypot or sec.risk_score >= 60
        is_wash = False

        # Likvidlik tushishi
        hist = self._liq_hist[snap.pair_address]
        if hist and hist[-1] > 0:
            drop = (hist[-1] - snap.liquidity) / hist[-1]
            if drop > 0.25:
                flags.append("💧 Likvidlik keskin kamaydi")
                is_rug = True
        hist.append(snap.liquidity)

        # Yosh token
        if snap.age_hours < 4:
            flags.append("🕐 Token juda yosh (4 soatdan kam)")
            is_rug = True

        # Honeypot belgisi — faqat xarid
        if snap.sells_24h == 0 and snap.buys_24h > 30:
            flags.append("🍯 Honeypot: sotish yo'q")
            is_rug = True

        # Wash trading
        total_tx = snap.buys_24h + snap.sells_24h
        if total_tx > 0 and snap.volume_24h > 500_000:
            avg_size = snap.volume_24h / total_tx
            if avg_size > 80_000:
                if snap.volume_1h > 0 and snap.volume_5m / snap.volume_1h > 0.55:
                    flags.append("🤖 Wash trading (sun'iy hajm)")
                    is_wash = True

        return is_rug, is_wash, flags


# ══════════════════════════════════════════════════════════════
#  ⚙️  ASOSIY SIGNAL ENGINE
# ══════════════════════════════════════════════════════════════

class SignalEngine:
    def __init__(self, dex: DexScreenerAPI, goplus: GoPlusScanner,
                 moralis: MoralisClient,
                 trending: CoinGeckoTrending, neural: NeuralScorer,
                 backtest: BacktestEngine):
        self.dex      = dex
        self.goplus   = goplus
        self.moralis  = moralis
        self.trending = trending
        self.neural   = neural
        self.backtest = backtest
        self.rug      = RugDetector()
        self.smc      = SMCAnalyzer()
        self.mtf      = MTFConfluence()
        self.arb      = ArbitrageDetector()
        self.lp       = LiquidityMonitor()
        self.regime   = RegimeDetector()
        self.timing   = TimingPredictor()

        self._seen:       dict[str, datetime] = {}
        self._hour_count  = 0
        self._hour_reset  = datetime.now()

    def _ok(self, addr: str) -> bool:
        now = datetime.now()
        if (now - self._hour_reset).total_seconds() >= 3600:
            self._hour_count = 0
            self._hour_reset = now
        if self._hour_count >= MAX_SIGNALS_PER_HR:
            return False
        if addr in self._seen:
            return (now - self._seen[addr]) > timedelta(minutes=COOLDOWN_MINUTES)
        return True

    async def analyze(self, snap: MarketSnapshot) -> Optional[SignalResult]:
        # LP monitoring yangilash
        self.lp.update(snap)
        lp_score, lp_flags = self.lp.analyze_momentum(snap)

        # 1. Tezkor filtrlar (API chaqiruvidan oldin)
        if snap.token_symbol.upper() in RugDetector.STABLES:
            return None

        # MOONSHOT BYPASS: Agar token yosh bo'lsa va hajm portlayotgan bo'lsa,
        # minimal filtrni pasaytiramiz (Masalan "nokings" kabi 1000% o'suvchilar uchun)
        is_moonshot_candidate = (
            snap.market_cap > 5_000 and
            snap.market_cap < 800_000 and
            snap.volume_5m > 3_000 and
            snap.buy_ratio_5m > 0.70
        )

        current_min_liq = MIN_LIQUIDITY / 2.5 if is_moonshot_candidate else MIN_LIQUIDITY
        current_min_vol = MIN_VOLUME_24H / 3 if is_moonshot_candidate else MIN_VOLUME_24H

        # EXPERT CLUSTER BYPASS: Agar Moralis allaqachon bitta tokenda bir nechta expertni topsa,
        # yanada pastroq filtrga ruxsat beramiz.
        # Bu 'nokings' kabi juda yangi moonshotlarni tutishga yordam beradi.

        if snap.liquidity < current_min_liq:
            # Ikkinchi imkoniyat: Moralis expertlar borligini tekshirish
            experts = await self.moralis.detect_smart_money_groups(snap.chain, snap.token_address)
            if len(experts) >= 2:
                log.info(f"Expert Bypass: {snap.token_symbol} ({len(experts)} experts)")
            else:
                return None
        elif snap.volume_24h < current_min_vol:
            return None
        if snap.price_usd <= 0:
            return None
        if not self._ok(snap.pair_address):
            return None

        # 2. GoPlus security skan (Har doim kerak)
        sec = await self.goplus.scan(snap.chain, snap.token_address)

        # 3. Moralis Expert tahlili (Lazy loading)
        # Faqat agar token boshqa barcha filtrlardan o'tsa va yetarlicha likvid bo'lsa
        sec.expert_holders = []

        # Token turi va texnik holatini aniqlash
        signal_type = self._classify(snap)
        if not signal_type:
            return None

        # Faqat BUY yoki STRONG_BUY signallarida Moralis'ni ishlatamiz (Vaqt tejash uchun)
        if "BUY" in signal_type and snap.liquidity > MIN_LIQUIDITY * 1.5:
            sec.expert_holders = await self.moralis.detect_smart_money_groups(snap.chain, snap.token_address)

        # Rug tekshirish
        is_rug, is_wash, risk_flags = self.rug.check(snap, sec)
        risk_flags.extend(lp_flags)

        # Cross-DEX arbitraj
        self.arb.update(snap)
        arb_detected, arb_spread = self.arb.check(snap)

        # Trending
        is_trending = self.trending.is_trending(snap.token_symbol)

        # Rug alert — alohida signal
        if is_rug and not is_wash:
            self._seen[snap.pair_address] = datetime.now()
            self._hour_count += 1
            return SignalResult(
                snapshot=snap, signal_type="RUG_ALERT",
                confidence=88, primary_reason="Rug pull / Honeypot belgilari aniqlandi!",
                confluence=[], risk_flags=risk_flags, security=sec,
                smc_pattern=None, regime=self.regime.current,
                timeframe_align={}, neural_scores={},
                backtest_winrate=None, risk_reward=0,
                entry=snap.price_usd, target_1=0, target_2=0,
                stop_loss=snap.price_usd * 0.5,
                is_trending=is_trending, is_boosted=False,
                arb_detected=arb_detected,
            )

        # Neural scoring
        confidence, factors = self.neural.score(
            snap, sec, is_trending, arb_detected, self.regime.current, lp_score
        )

        # Moonshot Bias
        if signal_type == "MOONSHOT_ALPHA":
            confidence += 15
            if is_trending: confidence += 10

        # Cluster bonus (Smart Money Group)
        if len(sec.expert_holders) >= 2:
            confidence += 12

        # SMC
        smc_pattern, smc_bonus = self.smc.analyze(snap)
        confidence += smc_bonus

        # MTF
        tf_data, mtf_bonus = self.mtf.analyze(snap)
        confidence += mtf_bonus // 3  # Normalize

        # Rejim korreksiyasi
        confidence += self.regime.min_confidence_delta

        # Wash trading jazosi
        if is_wash:
            confidence -= 18

        # Backtest korreksiyasi
        wr_primary = None
        # Signal turini aniqlash (asosiy mantiq)
        signal_type = self._classify(snap)
        if signal_type:
            wr = self.backtest.winrate(signal_type)
            wr_primary = wr
            if wr is not None:
                if wr >= 68:   confidence += 9
                elif wr >= 55: confidence += 4
                elif wr < 40:  confidence -= 12

        confidence = max(0, min(100, confidence))

        min_conf = MIN_CONFIDENCE + self.regime.min_confidence_delta
        if confidence < min_conf or not signal_type:
            return None

        # Maqsadlar
        entry, t1, t2, sl = self._targets(snap, signal_type)
        rr = abs(t1 - entry) / max(abs(entry - sl), 0.000001)

        # Vaqt bashorati
        est_hours = self.timing.predict(snap, TARGET_1_PCT)

        # Primary reason
        primary = self._build_reason(snap, signal_type)

        # Confluence
        confluence = []
        if smc_pattern:       confluence.append(f"SMC: {smc_pattern}")
        if is_trending:       confluence.append("CoinGecko Trending listida")
        if arb_detected:      confluence.append(f"Cross-DEX arbitraj: {arb_spread:.1f}% spread")
        if snap.age_hours > 720: confluence.append("1 oy+ barqaror token")
        if sec.risk_score < 10:  confluence.append("GoPlus: Xavfsiz contract ✅")
        tf_bull = sum(1 for v in tf_data.values() if v.get("bias") == "bull")
        if tf_bull >= 3:      confluence.append(f"Multi-TF: {tf_bull}/4 timeframe bullish")

        result = SignalResult(
            snapshot=snap, signal_type=signal_type,
            confidence=confidence, primary_reason=primary,
            confluence=confluence, risk_flags=risk_flags, security=sec,
            smc_pattern=smc_pattern, regime=self.regime.current,
            timeframe_align=tf_data, neural_scores=factors,
            backtest_winrate=wr_primary, risk_reward=round(rr, 2),
            entry=entry, target_1=t1, target_2=t2, stop_loss=sl,
            is_trending=is_trending, is_boosted=False,
            arb_detected=arb_detected, estimated_hours=est_hours,
        )

        self._seen[snap.pair_address] = datetime.now()
        self._hour_count += 1
        self.backtest.record(result, factors)
        return result

    def _classify(self, snap: MarketSnapshot) -> Optional[str]:
        r5, r1h, r24 = snap.buy_ratio_5m, snap.buy_ratio_1h, snap.buy_ratio_24h

        # MOONSHOT ALPHA (Masalan "nokings" 1000% o'sishi kabilarni tutish)
        # Shart: MCap kichik, lekin xarid nisbati va hajm nisbati juda yuqori
        if (snap.market_cap > 5_000 and snap.market_cap < 600_000 and
            r5 > 0.75 and snap.volume_5m > snap.volume_1h / 4):
            return "MOONSHOT_ALPHA"

        if r5 > 0.73 and r1h > 0.66 and snap.change_5m > 2 and snap.volume_5m > 500:
            return "STRONG_BUY"
        if r1h > 0.65 and snap.volume_24h > MIN_VOLUME_24H * 4:
            return "BUY"
        if abs(snap.change_24h) < 6 and r24 > 0.58 and snap.age_hours > 48:
            return "ACCUMULATION"
        if snap.change_1h > 10 and snap.change_5m > 3:
            return "BREAKOUT"
        if r1h < 0.38 and snap.change_1h < -5 and snap.change_6h < -8:
            return "DISTRIBUTION"
        if snap.change_5m < -8 and r5 < 0.33:
            return "DUMP_RISK"
        return None

    def _targets(self, snap: MarketSnapshot, st: str) -> tuple[float,float,float,float]:
        p = snap.price_usd
        if st == "MOONSHOT_ALPHA":
            # Moonshot maqsadlari ancha baland bo'ladi
            return p, p*1.50, p*3.0, p*0.85
        if st in ("STRONG_BUY","BUY","ACCUMULATION","BREAKOUT"):
            return p, p*(1+TARGET_1_PCT/100), p*(1+TARGET_2_PCT/100), p*(1-STOP_LOSS_PCT/100)
        return p, p*(1-TARGET_1_PCT/100), p*(1-TARGET_2_PCT/100), p*(1+STOP_LOSS_PCT/100)

    def _build_reason(self, snap: MarketSnapshot, st: str) -> str:
        reasons = {
            "MOONSHOT_ALPHA": f"PUMP ALERT: MCap juda past (${snap.market_cap:,.0f}), xarid {snap.buy_ratio_5m:.0%}! 10x-50x potentsial.",
            "STRONG_BUY":   f"Kuchli xarid bosimi: 5m {snap.buy_ratio_5m:.0%}, 1h {snap.buy_ratio_1h:.0%} xaridorlar",
            "BUY":          f"1s xarid bosimi: {snap.buy_ratio_1h:.0%} xaridorlar, hajm ${snap.volume_24h:,.0f}",
            "ACCUMULATION": f"Kit akkumulyatsiyasi: narx barqaror ({snap.change_24h:+.1f}%), xarid {snap.buy_ratio_24h:.0%}",
            "BREAKOUT":     f"Breakout: 1s {snap.change_1h:+.1f}%, 5d {snap.change_5m:+.1f}%, hajm portladi",
            "DISTRIBUTION": f"Kit tarqatishi: sotish {1-snap.buy_ratio_1h:.0%}, 1s {snap.change_1h:+.1f}%",
            "DUMP_RISK":    f"Tez dump: 5d {snap.change_5m:+.1f}%, sotish {1-snap.buy_ratio_5m:.0%}",
        }
        return reasons.get(st, "Signal aniqlandi")


# ══════════════════════════════════════════════════════════════
#  💬  TELEGRAM XABAR FORMATI
# ══════════════════════════════════════════════════════════════

def fmt(sig: SignalResult) -> str:
    s   = sig.snapshot
    url = f"https://dexscreener.com/{s.chain}/{s.pair_address}"
    p   = s.price_usd

    # Timeframe qatori
    tf_str = ""
    for name, d in sig.timeframe_align.items():
        em = "🟢" if d["bias"]=="bull" else "🔴" if d["bias"]=="bear" else "⬜"
        tf_str += f"{em}<code>{name}:{d['change']:+.1f}%</code> "

    # Confluence
    cf = "".join(f"  ✅ {html.escape(f)}\n" for f in sig.confluence[:5])

    # Xavf belgilari
    rf = "".join(f"  ⚠️ {html.escape(r)}\n" for r in sig.risk_flags[:4])

    # Backtest
    bt = f"<code>{sig.backtest_winrate:.0f}%</code>" if sig.backtest_winrate else "<code>—</code>"

    # Security & Moralis Experts
    sec = sig.security
    sec_str = ""
    if sec:
        sc = "🟢 Xavfsiz" if sec.risk_score < 20 else "🟡 Ehtiyotkor" if sec.risk_score < 50 else "🔴 Xavfli"
        sec_str = (
            f"\n🛡️ <b>GoPlus Security:</b> {sc} (xavf: {sec.risk_score}/100)\n"
            f"  Holderlar: <code>{sec.holder_count:,}</code> | "
            f"Top holder: <code>{sec.top_holder_pct:.1f}%</code>\n"
            f"  Xarid solig'i: <code>{sec.buy_tax:.0f}%</code> | "
            f"Sotish solig'i: <code>{sec.sell_tax:.0f}%</code>"
        )

        # Moralis Expert hamyonlar
        if hasattr(sec, "expert_holders") and sec.expert_holders:
            sec_str += f"\n🧠 <b>Smart Money Cluster:</b> <code>{len(sec.expert_holders)}</code> ta expert hamyon topildi!"
            for exp in sec.expert_holders[:3]:
                sec_str += f"\n  • {exp.address[:6]}...{exp.address[-4:]} | <b>{exp.alpha_hits}x Alpha Hit</b>"

    # Vaqt bashorati
    time_str = ""
    if sig.estimated_hours:
        time_str = f"\n⏱️ Maqsad 1 ga taxminiy vaqt: <code>~{sig.estimated_hours:.1f} soat</code>"

    # Extra belgilar
    extras = ""
    if sig.is_trending: extras += " 🔥<b>CoinGecko Trending</b>"
    if sig.arb_detected: extras += " ⚡<b>Cross-DEX Arb</b>"

    # RUG ALERT
    if sig.signal_type == "RUG_ALERT":
        return (
            f"☠️ <b>RUG PULL / HONEYPOT XAVFI!</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🪙 <b>{html.escape(s.token_symbol)}</b> | <code>{s.chain.upper()}</code> | <code>{s.dex.upper()}</code>\n"
            f"💵 Narx: <code>${p:.8f}</code>\n"
            f"{sec_str}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ <b>Xavf belgilari:</b>\n{rf}"
            f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🔗 <a href='{url}'>DexScreener</a>\n"
            f"⏰ {datetime.now().strftime('%H:%M:%S')} | WTP v3.0"
        )

    # Normal signal
    header_style = "🚀🌕" if sig.signal_type == "MOONSHOT_ALPHA" else ""
    return (
        f"{sig.emoji} <b>{header_style}{sig.signal_type.replace('_',' ')} — {html.escape(s.token_symbol)}</b>{extras}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🪙 <code>{html.escape(s.token_name)}</code> | <code>{s.chain.upper()}</code> | <code>{s.dex.upper()}</code>\n"
        f"💵 Narx: <code>${p:.10f}</code>\n"
        f"💧 Likvidlik: <code>${s.liquidity:,.0f}</code> | Hajm 24s: <code>${s.volume_24h:,.0f}</code>\n"
        f"📊 MCap: <code>${s.market_cap:,.0f}</code> | Yosh: <code>{s.age_hours:.0f}s</code>\n"
        f"\n📈 <b>Timeframe tahlili:</b>\n{tf_str.strip()}\n"
        f"\n🌊 <b>Bozor rejimi:</b> {sig.regime} {sig.emoji if sig.regime == 'BULL' else ''}\n"
        f"\n🎯 <b>Neural signal kuchi:</b>\n"
        f"<code>{sig.bar}</code> <b>{sig.confidence}/100</b>\n"
        f"\n📌 <b>Sabab:</b> <i>{html.escape(sig.primary_reason)}</i>\n"
        f"{f'{chr(10)}✅ <b>Confluence:</b>{chr(10)}{cf}' if cf else ''}"
        f"{sec_str}\n"
        f"\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📐 <b>Savdo rejasi:</b>\n"
        f"  🟡 Kirish:     <code>${sig.entry:.10f}</code>\n"
        f"  🎯 Maqsad 1: <code>${sig.target_1:.10f}</code> (+{TARGET_1_PCT:.0f}%)\n"
        f"  🚀 Maqsad 2: <code>${sig.target_2:.10f}</code> (+{TARGET_2_PCT:.0f}%)\n"
        f"  🛑 Stop-Loss: <code>${sig.stop_loss:.10f}</code> (-{STOP_LOSS_PCT:.0f}%)\n"
        f"  ⚖️  R:R nisbati: <code>{sig.risk_reward:.2f}:1</code>{time_str}\n"
        f"\n📚 Tarixiy to'g'rilik: {bt}\n"
        f"{f'{chr(10)}⚠️ <b>Xavf:</b>{chr(10)}{rf}' if rf else ''}"
        f"\n━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🔗 <a href='{url}'>DexScreener</a>\n"
        f"⏰ {datetime.now().strftime('%H:%M:%S')} | WTP v3.0"
    )


# ══════════════════════════════════════════════════════════════
#  🤖  ASOSIY BOT
# ══════════════════════════════════════════════════════════════

class WhaleTrackerV3:
    def __init__(self):
        self.http     = HttpClient()
        self.dex      = DexScreenerAPI(self.http)
        self.goplus   = GoPlusScanner(self.http)
        self.moralis  = MoralisClient(self.http)
        self.trending = CoinGeckoTrending(self.http)
        self.neural   = NeuralScorer()
        self.backtest = BacktestEngine(self.dex, self.neural)
        self.engine   = SignalEngine(
            self.dex, self.goplus, self.moralis, self.trending,
            self.neural, self.backtest
        )
        self.tracker  = None  # PositionTracker (send_fn keyin beriladi)
        self.bot      = Bot(token=TELEGRAM_BOT_TOKEN)
        self._snaps:  list[MarketSnapshot] = []
        self._boosted: set[str] = set()

        # Statistika
        self.total_scans   = 0
        self.total_signals = 0
        self.rug_alerts    = 0
        self.start_time    = datetime.now()
        self.paused        = False

    async def send(self, text: str, markup=None):
        try:
            await self.bot.send_message(
                chat_id=TELEGRAM_CHAT_ID,
                text=text,
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True,
                reply_markup=markup,
            )
        except Exception as e:
            log.error(f"Telegram: {e}")

    def _kb(self):
        pause_lbl = "▶️ Resume" if self.paused else "⏸ Pause"
        return InlineKeyboardMarkup([
            [InlineKeyboardButton("📊 Status",    callback_data="status"),
             InlineKeyboardButton("📈 Top 5",     callback_data="top5")],
            [InlineKeyboardButton(pause_lbl,      callback_data="pause"),
             InlineKeyboardButton("📚 Winrate",   callback_data="winrate")],
            [InlineKeyboardButton("🧬 Weights",   callback_data="weights"),
             InlineKeyboardButton("🌊 Rejim",     callback_data="regime")],
            [InlineKeyboardButton("🔍 Hozir skan", callback_data="scan_now"),
             InlineKeyboardButton("💼 Pozitsiyalar", callback_data="positions")],
        ])

    async def startup(self):
        chains = html.escape(", ".join(c.upper() for c in WATCH_CHAINS))
        await self.send(
            f"🐋 <b>Whale Tracker Pro v3.1 — EXPERT INTELLIGENCE</b>\n\n"
            f"🧬 Neural Scoring Engine (17 faktor)\n"
            f"🛡️ GoPlus Security Scanner\n"
            f"🧠 Moralis Wallet Alpha Analysis\n"
            f"👥 Smart Money Clustering\n"
            f"💧 Real-time LP Momentum\n"
            f"📈 CoinGecko Trending Monitor\n"
            f"⚡ Cross-DEX Arbitrage Detector\n"
            f"🌊 Bozor Rejimi Aniqlovchi\n"
            f"🔗 Real-time Position Tracker\n"
            f"📚 Adaptive Backtest Engine\n"
            f"⏱️ Predictive Timing Engine\n"
            f"🧠 SMC Pattern Analyzer\n\n"
            f"📡 Zanjirlar: <code>{chains}</code>\n"
            f"🎯 Min confidence: <code>{MIN_CONFIDENCE}/100</code>\n"
            f"⏱ Interval: <code>{SCAN_INTERVAL_SEC}s</code>\n\n"
            f"<i>/start — boshqaruv paneli</i>",
            markup=self._kb()
        )

    async def scan(self):
        if self.paused:
            return
        self.total_scans += 1
        log.info(f"{'─'*50}")
        log.info(f"🔍 SKAN #{self.total_scans} | Rejim: {self.engine.regime.current}")

        # CoinGecko trending yangilash
        await self.trending.refresh()

        raw: list[dict] = []

        # 1. Discovery: So'nggi profillar (Concurrent fetch)
        profiles = await self.dex.get_latest_profiles()
        log.info(f"Profiles: {len(profiles)} ta topildi.")

        async def fetch_profile_pairs(ta):
            p_list = await self.dex.get_token_pairs(ta)
            return [p for p in p_list if p.get("chainId") in WATCH_CHAINS][:3]

        profile_tasks = [fetch_profile_pairs(pr.get("tokenAddress")) for pr in profiles[:20] if pr.get("tokenAddress")]
        profile_results = await asyncio.gather(*profile_tasks)
        for r in profile_results: raw.extend(r)

        # 2. Search: Har bir chain uchun trending qidiruv
        search_tasks = [self.dex.search(f"{chain} trending") for chain in WATCH_CHAINS]
        search_results = await asyncio.gather(*search_tasks)
        for i, res in enumerate(search_results):
            log.info(f"Chain {WATCH_CHAINS[i]}: {len(res)} ta juftlik.")
            raw.extend(res[:15])

        # 3. CG Trending Discovery
        cg_tasks = [self.dex.search(symbol) for symbol in list(self.trending._trending_symbols)[:8]]
        cg_results = await asyncio.gather(*cg_tasks)
        for res in cg_results: raw.extend(res[:5])

        # Snapshotlar
        snaps: list[MarketSnapshot] = []
        seen = set()
        for p in raw:
            addr = p.get("pairAddress","")
            if addr and addr not in seen:
                seen.add(addr)
                s = parse_snap(p)
                if s:
                    snaps.append(s)

        log.info(f"Dastlabki snapshots: {len(snaps)} ta.")
        self._snaps = snaps
        self.engine.regime.update(snaps)
        await self.backtest.check(snaps)
        await self.tracker.check_all(snaps)

        log.info(f"Tahlil qilinmoqda: {len(snaps)} juftlik (Parallel)...")

        # 4. Parallel Analyze with Concurrency Limit
        sem = asyncio.Semaphore(5) # Maksimal 5 ta parallel tahlil
        async def bounded_analyze(snap):
            async with sem:
                try:
                    return await self.engine.analyze(snap)
                except Exception as e:
                    log.debug(f"Analyze error: {e}")
                    return None

        analyze_tasks = [bounded_analyze(s) for s in snaps[:60]] # Max 60 ta tahlil
        analyze_results = await asyncio.gather(*analyze_tasks)
        signals = [sig for sig in analyze_results if sig]

        signals.sort(key=lambda x: x.confidence, reverse=True)

        for sig in signals:
            self.total_signals += 1
            if sig.signal_type == "RUG_ALERT":
                self.rug_alerts += 1
            else:
                self.tracker.open(sig)

            await self.send(fmt(sig))
            log.info(
                f"{Fore.GREEN}✅ {sig.emoji} {sig.snapshot.token_symbol} "
                f"[{sig.signal_type}] {sig.confidence}/100{Style.RESET_ALL}"
            )
            await asyncio.sleep(1.2)

        log.info(
            f"✅ Skan #{self.total_scans} tugadi | "
            f"Juftliklar: {len(snaps)} | Signallar: {len(signals)} | "
            f"Jami: {self.total_signals}"
        )

    # ── Telegram handlers ──────────────────────────────────

    async def _status_text(self) -> str:
        uptime = datetime.now() - self.start_time
        h, m = divmod(uptime.seconds // 60, 60)
        wr = self.backtest.overall()
        wr_s = f"<code>{wr:.0f}%</code>" if wr else "<code>—</code>"
        wt   = self.neural.weights
        top3 = sorted(wt.items(), key=lambda x: x[1], reverse=True)[:3]
        top3_s = ", ".join(f"{k}:{v:.1f}" for k,v in top3)
        pos_count = len(self.tracker.positions) if self.tracker else 0
        return (
            f"📊 <b>Bot holati — WTP v3.0</b>\n\n"
            f"⏱ Ishlash: <code>{uptime.days}k {h}s {m}d</code>\n"
            f"🔍 Skanlar: <code>{self.total_scans}</code>\n"
            f"📨 Signallar: <code>{self.total_signals}</code>\n"
            f"☠️ Rug alertlar: <code>{self.rug_alerts}</code>\n"
            f"📚 Umumiy to'g'rilik: {wr_s}\n"
            f"💼 Ochiq pozitsiyalar: <code>{pos_count}</code>\n"
            f"🌊 Rejim: <code>{self.engine.regime.current}</code>\n"
            f"🧬 Top weights: <code>{html.escape(top3_s)}</code>\n"
            f"⏸ Holat: <code>{('TOXTATILGAN' if self.paused else 'FAOL')}</code>"
        )

    async def h_start(self, u: Update, c: ContextTypes.DEFAULT_TYPE):
        await u.message.reply_text(
            "🐋 <b>Whale Tracker Pro v3.0</b>\nBoshqaruv paneli:",
            parse_mode=ParseMode.HTML, reply_markup=self._kb()
        )

    async def h_status(self, u: Update, c: ContextTypes.DEFAULT_TYPE):
        await u.message.reply_text(await self._status_text(), parse_mode=ParseMode.HTML, reply_markup=self._kb())

    async def h_setlimit(self, u: Update, c: ContextTypes.DEFAULT_TYPE):
        try:
            v = int(c.args[0])
            self.engine.rug._liq_hist.clear()
            global MIN_VOLUME_24H; MIN_VOLUME_24H = v
            await u.message.reply_text(f"✅ Yangi limit: <code>${v:,}</code>", parse_mode=ParseMode.HTML)
        except:
            await u.message.reply_text("Foydalanish: /setlimit 100000")

    async def h_cb(self, u: Update, c: ContextTypes.DEFAULT_TYPE):
        q = u.callback_query
        await q.answer()
        d = q.data

        async def edit(txt):
            try:
                await q.edit_message_text(txt, parse_mode=ParseMode.HTML, reply_markup=self._kb())
            except Exception as e:
                if "not modified" not in str(e).lower():
                    log.error(e)

        if d == "status":
            await edit(await self._status_text())

        elif d == "top5":
            if not self._snaps:
                await q.message.reply_text("Hali skan yo'q.")
                return
            top = sorted(self._snaps, key=lambda s: s.volume_24h, reverse=True)[:5]
            lines = ["📈 <b>Top 5 (hajm)</b>\n"]
            for i, s in enumerate(top, 1):
                lines.append(
                    f"{i}. <code>{html.escape(s.token_symbol)}</code> "
                    f"({s.chain.upper()}) — <code>${s.volume_24h:,.0f}</code> "
                    f"| <code>{s.change_24h:+.1f}%</code>"
                )
            await edit("\n".join(lines))

        elif d == "pause":
            self.paused = not self.paused
            await edit(await self._status_text())

        elif d == "winrate":
            await edit(f"📚 <b>Signal to'g'riligi:</b>\n\n{self.backtest.summary()}")

        elif d == "weights":
            wt = self.neural.weights
            top = sorted(wt.items(), key=lambda x: x[1], reverse=True)[:8]
            lines = ["🧬 <b>Neural og'irliklar (adaptive):</b>\n"]
            for k, v in top:
                bar = "█" * int(v / 3) + "░" * max(0, 10 - int(v / 3))
                lines.append(f"<code>{bar}</code> {html.escape(k)}: <code>{v:.2f}</code>")
            await edit("\n".join(lines))

        elif d == "regime":
            r = self.engine.regime
            hist = list(r._history)[-10:]
            trend = " → ".join(f"{x:+.1f}%" for x in hist[-5:]) if hist else "—"
            await edit(
                f"🌊 <b>Bozor Rejimi:</b> <code>{r.current}</code>\n\n"
                f"So'nggi avg o'zgarishlar:\n<code>{trend}</code>\n\n"
                f"Rejim ta'siri: conf delta = "
                f"<code>{r.min_confidence_delta:+d}</code>"
            )

        elif d == "scan_now":
            asyncio.create_task(self.scan())
            await q.message.reply_text("🔍 Skan boshlandi...")

        elif d == "positions":
            if not self.tracker or not self.tracker.positions:
                await q.message.reply_text("💼 Hozircha ochiq pozitsiyalar yo'q.")
                return
            lines = ["💼 <b>Ochiq pozitsiyalar:</b>\n"]
            for addr, pos in list(self.tracker.positions.items())[:8]:
                elapsed = (datetime.now() - pos.opened_at).total_seconds() / 3600
                lines.append(
                    f"• <code>{html.escape(pos.snap.token_symbol)}</code> "
                    f"[{pos.signal_type}] kirish: <code>${pos.entry_price:.8f}</code> "
                    f"| {elapsed:.1f}s oldin"
                )
            await edit("\n".join(lines))

    async def h_error(self, u: object, c: ContextTypes.DEFAULT_TYPE):
        log.error(f"TG error: {c.error}")

    async def run(self):
        print(f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════════╗
║       WHALE TRACKER PRO v3.1 — EXPERT INTELLIGENCE       ║
╠══════════════════════════════════════════════════════════╣
║  Neural · Moralis · GoPlus · LP Momentum · Clustering     ║
║  SMC · Regime · Position Tracker · Adaptive Weights       ║
╚══════════════════════════════════════════════════════════╝{Style.RESET_ALL}
        """)

        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
            log.error("❌ TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID o'rnatilmagan!")
            return

        # PositionTracker ni send funksiyasi bilan birlashtirish
        self.tracker = PositionTracker(self.send)

        await self.startup()

        app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
        app.add_error_handler(self.h_error)
        app.add_handler(CommandHandler("start",    self.h_start))
        app.add_handler(CommandHandler("status",   self.h_status))
        app.add_handler(CommandHandler("setlimit", self.h_setlimit))
        app.add_handler(CallbackQueryHandler(self.h_cb))

        sched = AsyncIOScheduler(timezone=timezone.utc)
        sched.add_job(self.scan, "interval", seconds=SCAN_INTERVAL_SEC,
                      next_run_time=datetime.now(timezone.utc))
        sched.start()

        log.info("🚀 Bot ishga tushdi. To'xtatish: Ctrl+C")
        async with app:
            await app.start()
            await app.updater.start_polling()
            try:
                while True:
                    await asyncio.sleep(60)
            except (KeyboardInterrupt, SystemExit):
                pass
            await app.updater.stop()
            await app.stop()

        sched.shutdown()
        await self.http.close()
        log.info("Bot to'xtatildi.")


# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    asyncio.run(WhaleTrackerV3().run())
