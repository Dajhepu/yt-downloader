"""
╔══════════════════════════════════════════════════════════════════════════════╗
║            WHALE TRACKER PRO v4.6 — ZERO-COST INTELLIGENCE                 ║
║                                                                              ║
║  DexScreener + GeckoTerminal + GoPlus Security + Neural Scoring              ║
║  Multi-Source Discovery + Contract Scanner + Regime Detector                  ║
║  Real-time Position Tracker + 50% Milestone Reporting                        ║
║                                                                              ║
║  100% TEKIN: Moralis talab qilinmaydi (limitlar olib tashlandi)              ║
║  Faqat 0-6 soatlik YANGI tokenlar kuzatiladi                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

O'rnatish:
    pip install aiohttp python-telegram-bot apscheduler colorama python-dotenv

Ishga tushirish:
    python whale_tracker_v4.py
"""

import asyncio
import logging
import time
import html
import json
import math
import os
import sys
import random
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional, Any

import aiohttp
from colorama import Fore, Style, init

# python-dotenv ixtiyoriy
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
    from telegram.constants import ParseMode
except ImportError:
    print("❌ python-telegram-bot o'rnatilmagan: pip install python-telegram-bot")
    sys.exit(1)

try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
except ImportError:
    print("❌ apscheduler o'rnatilmagan: pip install apscheduler")
    sys.exit(1)

init(autoreset=True)

# ══════════════════════════════════════════════════════════════
#  ⚙️  SOZLAMALAR
# ══════════════════════════════════════════════════════════════

TELEGRAM_BOT_TOKEN = "8489499074:AAEbc1ZNVEBprLhPhnoiY0orE4oRmno9UYM"
TELEGRAM_CHAT_ID   = "798283148"

# ── Token yoshi chegaralari (YANGI TOKENLAR ONLY) ─────────
NEW_TOKEN_MIN_HOURS  = 0.25    # Minimal yosh: 15 daqiqa
NEW_TOKEN_MAX_HOURS  = 6.0     # Maksimal yosh: 6 soat

# ── Signal filtrlari ──────────────────────────────────────
MIN_CONFIDENCE      = 65
MIN_LIQUIDITY       = 20_000
MIN_VOLUME_24H      = 15_000
MIN_VOLUME_1H       = 3_000
MAX_SIGNALS_PER_HR  = 25
COOLDOWN_MINUTES    = 30

# ── Moonshot parametrlari ──────────────────────────────────
MOONSHOT_MIN_MCAP        = 5_000
MOONSHOT_MAX_MCAP        = 800_000
MOONSHOT_MIN_BUY_RATIO   = 0.75
MOONSHOT_MIN_VOL_5M      = 2_000

# ── Skanerlash ─────────────────────────────────────────────
SCAN_INTERVAL_SEC   = 45
WATCH_CHAINS        = ["ethereum", "bsc", "solana", "arbitrum", "polygon", "base"]

# ── Savdo maqsadlari ───────────────────────────────────────
TARGET_1_PCT  = 8.0
TARGET_2_PCT  = 20.0
STOP_LOSS_PCT = 5.0
MIN_RR_RATIO  = 1.5

# ── Xavfsizlik filtrlari ───────────────────────────────────
MAX_SECURITY_RISK   = 40
MAX_TOP_HOLDER_PCT  = 50.0
MIN_HOLDER_COUNT    = 10
MAX_SELL_TAX        = 10.0
MAX_BUY_TAX         = 10.0

# ══════════════════════════════════════════════════════════════
#  📋  LOGGING
# ══════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("wtp_v4.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("WTP-v4")

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
    discovery_sources: set = field(default_factory=set)
    timestamp:     datetime = field(default_factory=datetime.now)

    @property
    def buy_ratio_5m(self) -> float:
        t = self.buys_5m + self.sells_5m
        return self.buys_5m / t if t > 0 else 0.5

    @property
    def buy_ratio_1h(self) -> float:
        t = self.buys_1h + self.sells_1h
        return self.buys_1h / t if t > 0 else 0.5

    @property
    def vol_to_liq_ratio(self) -> float:
        return self.volume_24h / self.liquidity if self.liquidity > 0 else 0.0

    @property
    def total_txns_24h(self) -> int:
        return self.buys_24h + self.sells_24h

    @property
    def source_count(self) -> int:
        return len(self.discovery_sources)


@dataclass
class SecurityReport:
    is_honeypot:     bool  = False
    risk_score:      int   = 0
    sell_tax:        float = 0.0
    buy_tax:         float = 0.0
    holder_count:    int   = 0
    top_holder_pct:  float = 0.0
    flags:           list  = field(default_factory=list)
    scanned:         bool  = False


@dataclass
class SignalResult:
    snapshot:         MarketSnapshot
    signal_type:      str
    confidence:       int
    primary_reason:   str
    confluence:       list
    risk_flags:       list
    security:         Optional[SecurityReport]
    smc_pattern:      Optional[str]
    regime:           str
    timeframe_align:  dict
    neural_scores:    dict
    backtest_winrate: Optional[float]
    risk_reward:      float
    entry:            float
    target_1:         float
    target_2:         float
    stop_loss:        float
    is_trending:      bool  = False
    security_passed:  bool  = False

    @property
    def bar(self) -> str:
        f = round(self.confidence / 10)
        return "█" * f + "░" * (10 - f)

    @property
    def emoji(self) -> str:
        return {
            "MOONSHOT_ALPHA": "🚀🔥",
            "STRONG_BUY":    "🟢🟢",
            "BUY":           "🟢",
            "ACCUMULATION":  "🐋",
            "BREAKOUT":      "⚡",
            "DUMP_RISK":     "🔴",
            "DISTRIBUTION":  "🔴🔴",
            "RUG_ALERT":     "☠️",
        }.get(self.signal_type, "🔵")


# ══════════════════════════════════════════════════════════════
#  🌐  ASYNC HTTP HELPER
# ══════════════════════════════════════════════════════════════

class HttpClient:
    UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

    def __init__(self):
        self._sess: Optional[aiohttp.ClientSession] = None
        self.bot_token = TELEGRAM_BOT_TOKEN
        self.chat_id = TELEGRAM_CHAT_ID

    def _get_session(self) -> aiohttp.ClientSession:
        if not self._sess or self._sess.closed:
            self._sess = aiohttp.ClientSession(
                headers={"User-Agent": self.UA, "Accept": "application/json"},
                connector=aiohttp.TCPConnector(limit=20),
            )
        return self._sess

    async def get(self, url: str, params: dict = None, timeout: int = 15) -> Optional[Any]:
        try:
            async with self._get_session().get(url, params=params, timeout=aiohttp.ClientTimeout(total=timeout)) as r:
                if r.status == 200:
                    return await r.json()
        except Exception as e:
            log.debug(f"HTTP GET Error {url}: {e}")
        return None

    async def send_to_tg(self, text: str):
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        try:
            async with self._get_session().post(url, json={"chat_id": self.chat_id, "text": text, "parse_mode": "HTML"}) as r:
                pass
        except: pass

    async def close(self):
        if self._sess and not self._sess.closed:
            await self._sess.close()


# ══════════════════════════════════════════════════════════════
#  📡  DEXSCREENER API
# ══════════════════════════════════════════════════════════════

class DexScreenerAPI:
    BASE = "https://api.dexscreener.com"

    def __init__(self, http: HttpClient):
        self.http = http

    async def get_latest_profiles(self) -> list:
        data = await self.http.get(f"{self.BASE}/token-profiles/latest/v1")
        return data if isinstance(data, list) else []

    async def get_boosted_tokens(self) -> list:
        data = await self.http.get(f"{self.BASE}/token-boosts/latest/v1")
        return data if isinstance(data, list) else []

    async def search(self, query: str) -> list:
        data = await self.http.get(f"{self.BASE}/latest/dex/search", params={"q": query})
        return (data or {}).get("pairs", []) or []

    async def get_pair(self, chain: str, address: str) -> Optional[dict]:
        data = await self.http.get(f"{self.BASE}/latest/dex/pairs/{chain}/{address}")
        pairs = (data or {}).get("pairs", [])
        return pairs[0] if pairs else None

    async def get_token_pairs(self, token_address: str) -> list:
        data = await self.http.get(f"{self.BASE}/latest/dex/tokens/{token_address}")
        return (data or {}).get("pairs", []) or []


def parse_snap(pair: dict) -> Optional[MarketSnapshot]:
    try:
        base  = pair.get("baseToken", {})
        sym   = base.get("symbol", "?")
        taddr = base.get("address", "")
        chain = pair.get("chainId", "")
        dex   = pair.get("dexId", "")
        addr  = pair.get("pairAddress", "")

        if not addr or not sym or sym == "?": return None

        def fv(d, k): return float(d.get(k) or 0)
        def iv(d, k, s): return int((d.get(k) or {}).get(s) or 0)

        vol = pair.get("volume") or {}
        ch = pair.get("priceChange") or {}
        txns = pair.get("txns") or {}
        liq = float((pair.get("liquidity") or {}).get("usd") or 0)
        price = float(pair.get("priceUsd") or 0)

        if price <= 0 or liq <= 0: return None

        ca = pair.get("pairCreatedAt")
        age = (time.time() - ca / 1000) / 3600 if ca else 9999

        return MarketSnapshot(
            pair_address=addr, token_symbol=sym, token_name=base.get("name", "?"),
            token_address=taddr, chain=chain, dex=dex, price_usd=price,
            market_cap=float(pair.get("marketCap") or pair.get("fdv") or 0),
            liquidity=liq,
            volume_5m=fv(vol,"m5"), volume_1h=fv(vol,"h1"),
            volume_6h=fv(vol,"h6"), volume_24h=fv(vol,"h24"),
            change_5m=fv(ch,"m5"), change_1h=fv(ch,"h1"),
            change_6h=fv(ch,"h6"), change_24h=fv(ch,"h24"),
            buys_5m=iv(txns,"m5","buys"), sells_5m=iv(txns,"m5","sells"),
            buys_1h=iv(txns,"h1","buys"), sells_1h=iv(txns,"h1","sells"),
            buys_24h=iv(txns,"h24","buys"), sells_24h=iv(txns,"h24","sells"),
            age_hours=age
        )
    except: return None


# ══════════════════════════════════════════════════════════════
#  🦎  GECKOTERMINAL API
# ══════════════════════════════════════════════════════════════

class GeckoTerminalAPI:
    BASE = "https://api.geckoterminal.com/api/v2"

    def __init__(self, http: HttpClient):
        self.http = http

    async def get_trending_pools(self, network: str) -> list:
        net_map = {"ethereum": "eth", "bsc": "bsc", "solana": "solana", "arbitrum": "arbitrum", "polygon": "polygon_pos", "base": "base"}
        gnat = net_map.get(network, network)
        data = await self.http.get(f"{self.BASE}/networks/{gnat}/trending_pools", params={"page": "1"})
        pools = (data or {}).get("data", [])

        token_addrs = []
        for p in pools:
            # Extract base_token address from relationships if possible
            # GeckoTerminal format: relationships.base_token.data.id = "network_0xAddress"
            bt = p.get("relationships", {}).get("base_token", {}).get("data", {}).get("id")
            if bt and "_" in bt:
                token_addrs.append({"address": bt.split("_")[1]})
            else:
                # Fallback to pool address if token extraction fails (less ideal)
                addr = p.get("attributes", {}).get("address")
                if addr: token_addrs.append({"address": addr})
        return token_addrs


# ══════════════════════════════════════════════════════════════
#  🛡️  GOPLUS SECURITY
# ══════════════════════════════════════════════════════════════

class GoPlusScanner:
    BASE = "https://api.gopluslabs.io/api/v1"
    NETWORKS = {"ethereum": "1", "bsc": "56", "arbitrum": "42161", "base": "8453", "solana": "solana"}

    def __init__(self, http: HttpClient):
        self.http = http

    async def scan(self, chain: str, token_address: str) -> SecurityReport:
        cid = self.NETWORKS.get(chain)
        if not cid: return SecurityReport()
        url = f"{self.BASE}/token_security/{cid}" if chain != "solana" else f"{self.BASE}/solana/token_security"
        data = await self.http.get(url, params={"contract_addresses": token_address})

        rep = SecurityReport(scanned=True)
        res = (data or {}).get("result") or {}
        info = res.get(token_address.lower()) or res.get(token_address) or (list(res.values())[0] if res else {})

        if info:
            rep.is_honeypot = str(info.get("is_honeypot", "0")) == "1"
            rep.buy_tax = float(info.get("buy_tax") or 0)
            rep.sell_tax = float(info.get("sell_tax") or 0)
            rep.risk_score = 60 if rep.is_honeypot else 0
            if rep.buy_tax > 10: rep.risk_score += 20
        return rep

    def passes_strict_filter(self, rep: SecurityReport, snap: MarketSnapshot) -> tuple[bool, str]:
        if rep.is_honeypot: return False, "Honeypot"
        if rep.risk_score > MAX_SECURITY_RISK: return False, f"Risk {rep.risk_score}"
        return True, "OK"


# ══════════════════════════════════════════════════════════════
#  🧠  SMC ANALYZER
# ══════════════════════════════════════════════════════════════

class SMCAnalyzer:
    def __init__(self):
        self._hist = defaultdict(lambda: deque(maxlen=20))

    def analyze(self, snap: MarketSnapshot) -> tuple[Optional[str], int]:
        h = self._hist[snap.pair_address]
        h.append(snap.price_usd)
        if len(h) < 4: return None, 0

        p = list(h)
        if p[-1] > p[-2] and p[-2] < p[-3] and p[-1] > p[-3]: return "Bullish BOS", 15
        if p[-1] > p[-3] * 1.08: return "Fair Value Gap", 12
        return None, 0

# ══════════════════════════════════════════════════════════════
#  🌊  REGIME DETECTOR
# ══════════════════════════════════════════════════════════════

class RegimeDetector:
    def __init__(self):
        self.current = "SIDEWAYS"

    def update(self, snaps: list[MarketSnapshot]):
        if not snaps: return
        avg_ch = sum(s.change_1h for s in snaps[:30]) / 30
        if avg_ch > 2: self.current = "BULLISH"
        elif avg_ch < -2: self.current = "BEARISH"
        else: self.current = "SIDEWAYS"

# ══════════════════════════════════════════════════════════════
#  📚  POSITION TRACKING
# ══════════════════════════════════════════════════════════════

@dataclass
class OpenPosition:
    snap:        MarketSnapshot
    signal_type: str
    entry_price: float
    target_1:    float
    target_2:    float
    stop_loss:   float
    opened_at:   datetime
    last_milestone: float = 0.0
    ath_pnl:     float = 0.0
    t1_hit:      bool = False
    t2_hit:      bool = False
    sl_hit:      bool = False

class PositionTracker:
    def __init__(self, send_fn):
        self.send = send_fn
        self.positions: dict[str, OpenPosition] = {}

    def open(self, sig: SignalResult):
        self.positions[sig.snapshot.pair_address] = OpenPosition(
            snap=sig.snapshot, signal_type=sig.signal_type,
            entry_price=sig.entry, target_1=sig.target_1,
            target_2=sig.target_2, stop_loss=sig.stop_loss,
            opened_at=datetime.now()
        )

    async def check_all(self, snaps: list[MarketSnapshot], dex_api: DexScreenerAPI):
        snap_map = {s.pair_address: s for s in snaps}
        to_close = []
        for addr, pos in self.positions.items():
            cur = snap_map.get(addr)
            if not cur:
                pair_data = await dex_api.get_pair(pos.snap.chain, addr)
                if pair_data: cur = parse_snap(pair_data)
            if not cur: continue

            pnl = (cur.price_usd / pos.entry_price - 1) * 100
            if pnl > pos.ath_pnl: pos.ath_pnl = pnl

            # Growth Milestones (Every 50%)
            milestone = math.floor(pnl / 50) * 50
            if milestone > pos.last_milestone and milestone >= 50:
                pos.last_milestone = milestone
                await self.send(f"📈 <b>{html.escape(pos.snap.token_symbol)} — KUCHLI O'SISH!</b>\n"
                                f"Foyda: <b>+{pnl:.1f}%</b> 🔥\n"
                                f"🏆 ATH: <code>+{pos.ath_pnl:.1f}%</code>\n"
                                f"🚀 Moonshot davom etmoqda!")

            if not pos.t1_hit and cur.price_usd >= pos.target_1:
                pos.t1_hit = True
                await self.send(f"🎯 <b>{html.escape(pos.snap.token_symbol)} — Target 1!</b> (+{pnl:.1f}%)")

            if cur.price_usd <= pos.stop_loss:
                await self.send(f"🛑 <b>{html.escape(pos.snap.token_symbol)} — Stop Loss.</b> ({pnl:.1f}%)")
                to_close.append(addr)
            elif pnl >= 1000: # 10x limit
                to_close.append(addr)

        for a in to_close: self.positions.pop(a, None)


# ══════════════════════════════════════════════════════════════
#  🧬  NEURAL SCORER
# ══════════════════════════════════════════════════════════════

class NeuralScorer:
    def __init__(self):
        self.weights = {"buy_ratio": 15, "volume": 12, "confluence": 20, "security": 15, "momentum": 10}

    def score(self, snap: MarketSnapshot, sec: SecurityReport, smc_bonus: int = 0) -> int:
        score = 50
        if snap.buy_ratio_1h > 0.65: score += 10
        if snap.source_count >= 3: score += 20
        elif snap.source_count == 2: score += 10
        if sec.risk_score == 0: score += 10
        if snap.change_5m > 2: score += 5
        score += smc_bonus
        return min(100, score)


# ══════════════════════════════════════════════════════════════
#  ⚙️  SIGNAL ENGINE
# ══════════════════════════════════════════════════════════════

class SignalEngine:
    def __init__(self, dex, goplus, gecko, neural, smc, regime):
        self.dex, self.goplus, self.gecko, self.neural, self.smc, self.regime = dex, goplus, gecko, neural, smc, regime
        self._seen = {}

    async def analyze(self, snap: MarketSnapshot) -> Optional[SignalResult]:
        if snap.token_symbol.upper() in {"USDT", "USDC", "DAI", "BUSD"}: return None
        if snap.age_hours < NEW_TOKEN_MIN_HOURS or snap.age_hours > NEW_TOKEN_MAX_HOURS: return None
        if snap.liquidity < MIN_LIQUIDITY: return None

        # STRICT: Source Confluence (Min 2 sources)
        if snap.source_count < 2: return None

        if snap.pair_address in self._seen:
            if datetime.now() - self._seen[snap.pair_address] < timedelta(minutes=COOLDOWN_MINUTES): return None

        sec = await self.goplus.scan(snap.chain, snap.token_address)
        passed, _ = self.goplus.passes_strict_filter(sec, snap)
        if not passed: return None

        smc_pat, smc_bonus = self.smc.analyze(snap)
        conf = self.neural.score(snap, sec, smc_bonus)
        if conf < MIN_CONFIDENCE: return None

        st = "MOONSHOT_ALPHA" if snap.market_cap < MOONSHOT_MAX_MCAP else "STRONG_BUY"
        entry = snap.price_usd

        self._seen[snap.pair_address] = datetime.now()
        return SignalResult(
            snapshot=snap, signal_type=st, confidence=conf,
            primary_reason=f"Kollektiv trend: {snap.source_count} ta manbada tasdiqlandi",
            confluence=[f"{s} orqali topildi" for s in snap.discovery_sources],
            risk_flags=[], security=sec, regime=self.regime.current, timeframe_align={}, neural_scores={},
            backtest_winrate=None, risk_reward=2.0, entry=entry,
            target_1=entry*1.5, target_2=entry*3.0, stop_loss=entry*0.8,
            security_passed=True, smc_pattern=smc_pat
        )


# ══════════════════════════════════════════════════════════════
#  🤖  MAIN BOT
# ══════════════════════════════════════════════════════════════

class WhaleTrackerV4:
    def __init__(self):
        self.http = HttpClient()
        self.dex = DexScreenerAPI(self.http)
        self.goplus = GoPlusScanner(self.http)
        self.gecko = GeckoTerminalAPI(self.http)
        self.neural = NeuralScorer()
        self.smc = SMCAnalyzer()
        self.regime = RegimeDetector()
        self.engine = SignalEngine(self.dex, self.goplus, self.gecko, self.neural, self.smc, self.regime)
        self.tracker = PositionTracker(self.http.send_to_tg)
        self.start_time = datetime.now()

    def _is_auth(self, u: Update) -> bool:
        uid = u.effective_user.id if u.effective_user else None
        return str(uid) == str(TELEGRAM_CHAT_ID)

    async def scan(self):
        log.info(f"🔍 SCAN STARTING...")
        source_data = defaultdict(set)
        sem = asyncio.Semaphore(4)

        async def safe_get(ta, src):
            async with sem:
                try:
                    pairs = await self.dex.get_token_pairs(ta)
                    valid = [p for p in pairs if p.get("chainId") in WATCH_CHAINS][:2]
                    for v in valid:
                        addr = v.get("pairAddress")
                        if addr: source_data[src].add(addr)
                    return valid
                except: return []

        raw_pairs = []
        p_task = self.dex.get_latest_profiles()
        b_task = self.dex.get_boosted_tokens()
        g_tasks = [self.gecko.get_trending_pools(ch) for ch in WATCH_CHAINS]

        results = await asyncio.gather(p_task, b_task, *g_tasks, return_exceptions=True)

        profiles = results[0] if isinstance(results[0], list) else []
        boosts = results[1] if isinstance(results[1], list) else []

        if profiles:
            res = await asyncio.gather(*[safe_get(p["tokenAddress"], "Profiles") for p in profiles[:15] if p.get("tokenAddress")])
            for r in res: raw_pairs.extend(r)
        if boosts:
            res = await asyncio.gather(*[safe_get(b["tokenAddress"], "Boosts") for b in boosts[:15] if b.get("tokenAddress")])
            for r in res: raw_pairs.extend(r)

        for res_g in results[2:]:
            if isinstance(res_g, list):
                res = await asyncio.gather(*[safe_get(p["address"], "GeckoTerminal") for p in res_g[:10] if p.get("address")])
                for r in res: raw_pairs.extend(r)

        snaps = []
        seen = set()
        for p in raw_pairs:
            addr = p.get("pairAddress")
            if addr and addr not in seen:
                seen.add(addr)
                s = parse_snap(p)
                if s:
                    for src, addrs in source_data.items():
                        if addr in addrs: s.discovery_sources.add(src)
                    snaps.append(s)

        log.info(f"Found {len(snaps)} unique pairs. Analyzing...")
        self.regime.update(snaps)
        for s in snaps:
            res = await self.engine.analyze(s)
            if res:
                await self.http.send_to_tg(self.fmt(res))
                self.tracker.open(res)

        await self.tracker.check_all(snaps, self.dex)

    def fmt(self, sig: SignalResult) -> str:
        s = sig.snapshot
        smc_str = f"🧠 <b>SMC:</b> <code>{sig.smc_pattern}</code>\n" if sig.smc_pattern else ""
        return (f"{sig.emoji} <b>{sig.signal_type} — {html.escape(s.token_symbol)}</b>\n"
                f"🌟 <b>KOLLEKTIV TREND ANIQLANDI!</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"💰 Narx: <code>${s.price_usd:.10f}</code>\n"
                f"💧 Liq: <code>${s.liquidity:,.0f}</code> | MCap: <code>${s.market_cap:,.0f}</code>\n"
                f"⏰ Yosh: <code>{s.age_hours:.1f}s</code>\n"
                f"🔍 Manbalar: <code>{', '.join(s.discovery_sources)}</code>\n"
                f"🌊 Rejim: <code>{sig.regime}</code>\n"
                f"{smc_str}"
                f"\n🎯 <b>Confidence: {sig.confidence}/100</b>\n"
                f"📐 SL: <code>${sig.stop_loss:.10f}</code> | TP: <code>${sig.target_2:.10f}</code>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"🔗 <a href='https://dexscreener.com/{s.chain}/{s.pair_address}'>DexScreener</a>")

    async def h_status(self, u: Update, c: ContextTypes.DEFAULT_TYPE):
        if not self._is_auth(u): return
        uptime = datetime.now() - self.start_time
        await u.message.reply_text(f"📊 <b>WTP v4.6 Status</b>\nUptime: {uptime}\nPositions: {len(self.tracker.positions)}\nMode: Zero-Cost Expertless", parse_mode="HTML")

    async def run(self):
        print("🚀 WTP v4.6 ZERO-COST ISHGA TUSHDI")
        app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
        app.add_handler(CommandHandler("status", self.h_status))
        app.add_handler(CommandHandler("start", self.h_status))

        sched = AsyncIOScheduler(timezone=timezone.utc)
        sched.add_job(self.scan, "interval", seconds=SCAN_INTERVAL_SEC, next_run_time=datetime.now(timezone.utc))
        sched.start()

        async with app:
            await app.start()
            await app.updater.start_polling()
            while True: await asyncio.sleep(60)

if __name__ == "__main__":
    asyncio.run(WhaleTrackerV4().run())
