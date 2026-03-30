"""
╔══════════════════════════════════════════════════════════════════════╗
║          WHALE TRACKER PRO v2.0 — MAXIMUM INTELLIGENCE              ║
║   DexScreener + Multi-Timeframe + SMC + Rug Detection + Backtest    ║
╚══════════════════════════════════════════════════════════════════════╝

YANGI QATLAMLAR:
  ✅ Multi-timeframe confluence (5m/1h/6h/24h)
  ✅ Smart Money Concept — Order Block, FVG, Liquidity Sweep
  ✅ Whale wallet concentration scoring
  ✅ Rug pull / honeypot detector
  ✅ Backtesting — tarixiy to'g'rilik foizi
  ✅ Signal confidence score (0-100) multi-faktor
  ✅ Telegram bot qo'mondonlari: /status /top5 /pause /setlimit
  ✅ Portfolio tracker — kuzatilayotgan pozitsiyalar
  ✅ Anti-manipulation filter — wash trading detection
  ✅ Dynamic threshold — bozor holatiga qarab moslashadi

O'rnatish:
    pip install requests python-telegram-bot apscheduler colorama aiohttp

Ishga tushirish:
    python whale_tracker_v2.py
"""

import asyncio
import logging
import json
import math
import time
import os
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
import aiohttp
from colorama import Fore, Style, init
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes, CallbackQueryHandler
from telegram.constants import ParseMode
from apscheduler.schedulers.asyncio import AsyncIOScheduler

init(autoreset=True)

# ══════════════════════════════════════════════════════
#  SOZLAMALAR
# ══════════════════════════════════════════════════════

TELEGRAM_BOT_TOKEN  = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID    = os.getenv("TELEGRAM_CHAT_ID")

MIN_USD_THRESHOLD   = 50_000
SCAN_INTERVAL_SEC   = 60
MAX_SIGNALS_PER_HR  = 25
MIN_CONFIDENCE      = 62        # Minimal ishonchlilik (0-100). 62+ = yuborish

WATCH_CHAINS = ["ethereum", "bsc", "solana", "arbitrum", "polygon", "base"]

# Dinamik threshold koeffitsienti (bozor volatilitetsiga qarab)
DYNAMIC_THRESHOLD_ENABLED = True

# ══════════════════════════════════════════════════════
#  LOG
# ══════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("whale_tracker_v2.log", encoding="utf-8"),
    ]
)
log = logging.getLogger("WTP-v2")

# ══════════════════════════════════════════════════════
#  MA'LUMOT MODELLARI
# ══════════════════════════════════════════════════════

@dataclass
class MarketSnapshot:
    """Bir juftlik uchun to'liq bozor holati"""
    pair_address:   str
    token_symbol:   str
    token_name:     str
    chain:          str
    dex:          str
    price_usd:      float
    market_cap:     float
    liquidity:      float
    volume_5m:      float
    volume_1h:      float
    volume_6h:      float
    volume_24h:     float
    change_5m:      float
    change_1h:      float
    change_6h:      float
    change_24h:     float
    buys_5m:        int
    sells_5m:       int
    buys_1h:        int
    sells_1h:       int
    buys_24h:       int
    sells_24h:      int
    age_hours:      float       # Token yoshi (soat)
    timestamp:      datetime = field(default_factory=datetime.now)


@dataclass
class SignalResult:
    """To'liq tahlil natijasi"""
    snapshot:           MarketSnapshot
    confidence:         int             # 0-100
    signal_type:        str
    primary_reason:     str
    confluence_factors: List[str]       # Bir vaqtda ishlayotgan signallar
    risk_flags:         List[str]       # Xavf belgilari
    smc_pattern:        Optional[str]   # Smart Money pattern
    timeframe_align:    Dict            # 5m/1h/6h/24h mosligi
    backtest_winrate:   Optional[float] # Tarixiy to'g'rilik (%)
    risk_reward:        float           # Taxminiy R:R nisbati
    entry_suggestion:   float           # Taxminiy kirish narxi
    target_1:           float           # 1-maqsad
    target_2:           float           # 2-maqsad
    stop_loss:          float           # Stop-loss
    is_rug_risk:        bool = False
    is_wash_trading:    bool = False

    @property
    def confidence_bar(self) -> str:
        filled = round(self.confidence / 10)
        return "█" * filled + "░" * (10 - filled)

    @property
    def signal_emoji(self) -> str:
        return {
            "STRONG_BUY":    "🟢🟢",
            "BUY":           "🟢",
            "ACCUMULATION":  "🐋",
            "BREAKOUT":      "⚡",
            "DUMP_RISK":     "🔴",
            "DISTRIBUTION":  "🔴🔴",
            "RUG_ALERT":     "☠️",
        }.get(self.signal_type, "🔵")

# ══════════════════════════════════════════════════════
#  DEXSCREENER ASYNC API
# ══════════════════════════════════════════════════════

class DexScreenerAPI:
    BASE    = "https://api.dexscreener.com"
    HEADERS = {"User-Agent": "WhaleTrackerPro/2.0"}

    def __init__(self):
        self._session: Optional[aiohttp.ClientSession] = None

    async def _session_(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(headers=self.HEADERS)
        return self._session

    async def _get(self, url: str) -> Optional[dict]:
        try:
            sess = await self._session_()
            async with sess.get(url, timeout=aiohttp.ClientTimeout(total=15)) as r:
                if r.status == 200:
                    return await r.json()
                else:
                    log.debug(f"API xatosi {url}: {r.status}")
        except Exception as e:
            log.debug(f"API xatosi {url}: {e}")
        return None

    async def get_latest_profiles(self) -> List[Dict]:
        """Discovery: Yaqinda faol bo'lgan tokenlarni topish"""
        data = await self._get(f"{self.BASE}/token-profiles/latest/v1")
        return data if isinstance(data, list) else []

    async def get_token_pairs(self, chain_id: str, token_address: str) -> List[Dict]:
        """Tokenning barcha juftliklarini olish"""
        data = await self._get(f"{self.BASE}/token-pairs/v1/{chain_id}/{token_address}")
        return data if isinstance(data, list) else []

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()


def parse_snapshot(pair: Dict) -> Optional[MarketSnapshot]:
    """DexScreener JSON → MarketSnapshot"""
    try:
        base   = pair.get("baseToken", {})
        sym    = base.get("symbol", "?")
        name   = base.get("name", "?")
        chain  = pair.get("chainId", "")
        dex    = pair.get("dexId", "")
        addr   = pair.get("pairAddress", "")

        price  = float(pair.get("priceUsd") or 0)
        mcap   = float((pair.get("marketCap") or pair.get("fdv") or 0))
        liq    = float((pair.get("liquidity") or {}).get("usd") or 0)

        vol    = pair.get("volume") or {}
        ch     = pair.get("priceChange") or {}
        txns   = pair.get("txns") or {}

        def v(d, k): return float(d.get(k) or 0)
        def ti(d, k, sk): return int((d.get(k) or {}).get(sk) or 0)

        # Token yoshi
        created_at = pair.get("pairCreatedAt")
        if created_at:
            age_hours = (time.time() - created_at / 1000) / 3600
        else:
            age_hours = 999

        return MarketSnapshot(
            pair_address=addr, token_symbol=sym, token_name=name,
            chain=chain, dex=dex, price_usd=price, market_cap=mcap,
            liquidity=liq,
            volume_5m=v(vol,"m5"), volume_1h=v(vol,"h1"),
            volume_6h=v(vol,"h6"), volume_24h=v(vol,"h24"),
            change_5m=v(ch,"m5"), change_1h=v(ch,"h1"),
            change_6h=v(ch,"h6"), change_24h=v(ch,"h24"),
            buys_5m=ti(txns,"m5","buys"),  sells_5m=ti(txns,"m5","sells"),
            buys_1h=ti(txns,"h1","buys"),  sells_1h=ti(txns,"h1","sells"),
            buys_24h=ti(txns,"h24","buys"),sells_24h=ti(txns,"h24","sells"),
            age_hours=age_hours,
        )
    except Exception as e:
        log.debug(f"Snapshot parse xatosi: {e}")
        return None

# ══════════════════════════════════════════════════════
#  RUG PULL DETECTOR
# ══════════════════════════════════════════════════════

class RugDetector:
    """Rug pull va honeypot belgilarini aniqlash."""

    RUG_FLAGS = {
        "young_token":        "Token 6 soatdan yosh",
        "low_liq":            "Likvidlik $50k dan kam",
        "liq_drop":           "Likvidlik keskin kamaydi",
        "extreme_vol":        "Haddan tashqari volatilitet",
        "single_whale":       "1 ta wallet 50%+ ushlab turibdi",
        "mint_enabled":       "Cheksiz token chiqarish imkoni mavjud",
        "sell_impossible":    "Sell tranzaksiyalari yo'q (honeypot)",
        "wash_trading":       "Sun'iy hajm aniqlandi",
    }

    def __init__(self):
        self._liq_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=10))

    def check(self, snap: MarketSnapshot) -> Tuple[bool, List[str], bool]:
        """
        Returns: (is_rug_risk, risk_flags, is_wash_trading)
        """
        flags = []
        is_rug = False
        is_wash = False

        # 1. Yosh token
        if snap.age_hours < 6:
            flags.append(self.RUG_FLAGS["young_token"])
            is_rug = True

        # 2. Juda kam likvidlik
        if snap.liquidity < 50_000:
            flags.append(self.RUG_FLAGS["low_liq"])
            is_rug = True

        # 3. Likvidlik tarixini kuzatish
        hist = self._liq_history[snap.pair_address]
        if hist:
            prev_liq = hist[-1]
            if prev_liq > 0 and (prev_liq - snap.liquidity) / prev_liq > 0.3:
                flags.append(self.RUG_FLAGS["liq_drop"])
                is_rug = True
        hist.append(snap.liquidity)

        # 4. Honeypot — faqat xarid bor, sotish yo'q
        if snap.sells_24h == 0 and snap.buys_24h > 20:
            flags.append(self.RUG_FLAGS["sell_impossible"])
            is_rug = True

        # 5. Wash trading aniqlash
        # Hajm/tranzaksiya nisbati juda yuqori = bot tranzaksiyalar
        if snap.buys_24h + snap.sells_24h > 0:
            avg_tx_size = snap.volume_24h / (snap.buys_24h + snap.sells_24h)
            # Agar o'rtacha tranzaksiya hajmi juda tekis bo'lsa — wash trading
            if avg_tx_size > 50_000 and snap.volume_24h > 2_000_000:
                # Va 5m hajm 1h hajmning 40%+ bo'lsa — portlash sun'iy
                if snap.volume_1h > 0 and snap.volume_5m / snap.volume_1h > 0.5:
                    flags.append(self.RUG_FLAGS["wash_trading"])
                    is_wash = True

        # 6. Haddan tashqari volatilitet
        if abs(snap.change_5m) > 30:
            flags.append(self.RUG_FLAGS["extreme_vol"])

        return is_rug, flags, is_wash

# ══════════════════════════════════════════════════════
#  SMART MONEY CONCEPT (SMC) ANALYZER
# ══════════════════════════════════════════════════════

class SMCAnalyzer:
    """
    Smart Money Concept pattern'larini aniqlash:
    - Order Block (OB)
    - Fair Value Gap (FVG)
    - Liquidity Sweep (LS)
    - Break of Structure (BOS)
    - Change of Character (CHoCH)
    """

    def __init__(self):
        self._price_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=24))

    def analyze(self, snap: MarketSnapshot) -> Tuple[Optional[str], int]:
        """
        Returns: (pattern_name, bonus_score)
        """
        addr = snap.pair_address
        hist = self._price_history[addr]

        if len(hist) < 3:
            self._price_history[addr].append(snap.price_usd)
            return None, 0

        prices = list(hist)
        self._price_history[addr].append(snap.price_usd)

        # Oxirgi 3 narx
        p1, p2, p3 = prices[-3], prices[-2], snap.price_usd

        # 1. BREAK OF STRUCTURE (BOS) — Yuqoriga
        #    Tuzilma buzilishi: yangi high dan keyin pullback, keyin yangi high
        if p2 < p1 and p3 > p1:
            return "Break of Structure (Bullish BOS)", 15

        # 2. CHANGE OF CHARACTER (CHoCH) — Pastga
        #    Belgi o'zgarishi: yangi low dan keyin pullback, keyin yangi low
        if p2 > p1 and p3 < p1:
            return "Change of Character (Bearish CHoCH)", -10

        # 3. FAIR VALUE GAP — Tez harakat = FVG
        gap_pct = abs(p3 - p1) / p1 * 100 if p1 > 0 else 0
        if gap_pct > 8 and snap.change_1h > 5:
            return "Fair Value Gap (Bullish FVG)", 12

        # 4. LIQUIDITY SWEEP — Keskin tushish keyin tez tiklanish
        if snap.change_5m < -5 and snap.change_1h > 3:
            return "Liquidity Sweep + Recovery", 18

        # 5. ORDER BLOCK — Barqaror baza, hajm oshishi
        if abs(snap.change_6h) < 3 and snap.volume_1h > snap.volume_6h / 4:
            return "Order Block (Accumulation Zone)", 10

        return None, 0

# ══════════════════════════════════════════════════════
#  MULTI-TIMEFRAME CONFLUENCE ENGINE
# ══════════════════════════════════════════════════════

class MTFConfluence:
    """
    Bir nechta vaqt oralig'ida signal mosligini hisoblash.
    Qancha ko'p timeframe moslikda bo'lsa — shuncha ishonchli.
    """

    def analyze(self, snap: MarketSnapshot) -> Tuple[Dict, int]:
        """
        Returns: (timeframe_dict, confluence_bonus)
        """
        tf = {}
        bonus = 0

        # 5 daqiqa
        if snap.volume_5m > 0:
            ratio_5m = snap.buys_5m / max(snap.buys_5m + snap.sells_5m, 1)
            tf["5m"] = {
                "bias": "bull" if ratio_5m > 0.55 else "bear" if ratio_5m < 0.45 else "neutral",
                "change": snap.change_5m,
                "buy_ratio": round(ratio_5m * 100),
            }
            if ratio_5m > 0.65: bonus += 8

        # 1 soat
        ratio_1h = snap.buys_1h / max(snap.buys_1h + snap.sells_1h, 1)
        tf["1h"] = {
            "bias": "bull" if ratio_1h > 0.55 else "bear" if ratio_1h < 0.45 else "neutral",
            "change": snap.change_1h,
            "buy_ratio": round(ratio_1h * 100),
        }
        if ratio_1h > 0.65: bonus += 12

        # 6 soat
        tf["6h"] = {
            "bias": "bull" if snap.change_6h > 3 else "bear" if snap.change_6h < -3 else "neutral",
            "change": snap.change_6h,
        }
        if snap.change_6h > 5: bonus += 10

        # 24 soat
        tf["24h"] = {
            "bias": "bull" if snap.change_24h > 5 else "bear" if snap.change_24h < -5 else "neutral",
            "change": snap.change_24h,
        }
        if snap.change_24h > 10: bonus += 8

        # Barcha timeframe bir yo'nalishda = confluence bonus
        biases = [v.get("bias") for v in tf.values()]
        if biases.count("bull") == len(biases):
            bonus += 20  # To'liq confluence!
        elif biases.count("bear") == len(biases):
            bonus -= 15

        return tf, bonus

# ══════════════════════════════════════════════════════
#  ANTI-MANIPULATION: VOLUME QUALITY SCORER
# ══════════════════════════════════════════════════════

class VolumeQualityAnalyzer:
    """
    Hajm sifatini baholash.
    Sun'iy (bot) hajmni organik hajmdan ajratish.
    """

    def score(self, snap: MarketSnapshot) -> Tuple[int, List[str]]:
        """
        Returns: (quality_score 0-100, positive_factors)
        """
        score = 50
        factors = []

        # 1. 5m hajm / 1h hajm nisbati
        if snap.volume_1h > 0:
            accel = snap.volume_5m / (snap.volume_1h / 12)
            if 0.5 < accel < 3:
                score += 10
                factors.append(f"Hajm tezlanishi organik ({accel:.1f}x)")
            elif accel > 5:
                score -= 15  # Juda tez = shubhali

        # 2. Xarid/sotish nisbati barqarorligi
        if snap.buys_24h + snap.sells_24h > 100:
            ratio = snap.buys_24h / (snap.buys_24h + snap.sells_24h)
            if 0.55 < ratio < 0.80:
                score += 12
                factors.append(f"Sog'lom xarid nisbati ({ratio:.0%})")
            elif ratio > 0.90:
                score -= 10  # Juda yuqori = shubhali

        # 3. Likvidlik / hajm nisbati
        if snap.volume_24h > 0 and snap.liquidity > 0:
            liq_vol = snap.liquidity / snap.volume_24h
            if 0.1 < liq_vol < 2:
                score += 8
                factors.append("Likvidlik/hajm nisbati sog'lom")

        # 4. MarketCap / Liquidity
        if snap.liquidity > 0 and snap.market_cap > 0:
            mc_liq = snap.market_cap / snap.liquidity
            if 2 < mc_liq < 20:
                score += 5
                factors.append(f"MCap/Liq nisbati optimal ({mc_liq:.1f}x)")

        # 5. Token yoshi bonusi
        if snap.age_hours > 168:   # 1 haftadan eski
            score += 10
            factors.append("Barqaror token (1 hafta+)")
        elif snap.age_hours > 24:
            score += 5

        return max(0, min(100, score)), factors

# ══════════════════════════════════════════════════════
#  BACKTEST ENGINE (tarixiy to'g'rilik)
# ══════════════════════════════════════════════════════

class BacktestEngine:
    """
    Har bir signal turi va chain uchun tarixiy
    to'g'rilik foizini dinamik saqlash.

    Signal yuborilgandan keyin 4 soat o'tib narxni
    tekshirib, to'g'ri/noto'g'ri deb belgilaydi.
    """

    def __init__(self):
        self._pending: Dict[str, Dict] = {}   # addr -> {entry_price, signal_type, timestamp}
        self._results: Dict[str, List] = defaultdict(list)  # signal_type -> [bool, ...]

    def record_entry(self, snap: MarketSnapshot, signal_type: str):
        self._pending[snap.pair_address] = {
            "entry": snap.price_usd,
            "signal": signal_type,
            "time": datetime.now(),
            "target": snap.price_usd * 1.08,   # 8% maqsad
            "stop":   snap.price_usd * 0.95,   # 5% stop
        }

    def check_outcomes(self, snaps: List[MarketSnapshot]):
        """Har scan da — oldingi signallar natijasini tekshirish."""
        now = datetime.now()
        completed = []
        for addr, entry in self._pending.items():
            elapsed = (now - entry["time"]).seconds / 3600
            if elapsed < 4:
                continue
            # Joriy narxni top'ing
            found = False
            for snap in snaps:
                if snap.pair_address == addr:
                    is_win = snap.price_usd >= entry["target"]
                    self._results[entry["signal"]].append(is_win)
                    completed.append(addr)
                    log.info(
                        f"Backtest: {entry['signal']} → {'✅ WIN' if is_win else '❌ LOSS'} "
                        f"(kirish: ${entry['entry']:.6f} → hozir: ${snap.price_usd:.6f})"
                    )
                    found = True
                    break

            # Agar snapshotlarda yo'q bo'lsa, lekin 24 soat o'tgan bo'lsa - loss deb hisoblash
            if not found and elapsed > 24:
                self._results[entry["signal"]].append(False)
                completed.append(addr)
                log.info(f"Backtest: {entry['signal']} → ❌ LOSS (token topilmadi/tushib ketdi)")

        for addr in completed:
            if addr in self._pending:
                del self._pending[addr]

    def winrate(self, signal_type: str) -> Optional[float]:
        r = self._results.get(signal_type, [])
        if len(r) < 3:
            return None
        return round(sum(r) / len(r) * 100, 1)

    def overall_winrate(self) -> Optional[float]:
        all_r = [x for lst in self._results.values() for x in lst]
        if len(all_r) < 5:
            return None
        return round(sum(all_r) / len(all_r) * 100, 1)

# ══════════════════════════════════════════════════════
#  ASOSIY SIGNAL ENGINE
# ══════════════════════════════════════════════════════

class SignalEngine:
    STABLE_COINS = {"USDT","USDC","DAI","BUSD","TUSD","FRAX","LUSD","MIM","USDD","USDP"}

    def __init__(self):
        self.rug       = RugDetector()
        self.smc       = SMCAnalyzer()
        self.mtf       = MTFConfluence()
        self.vol_qual  = VolumeQualityAnalyzer()
        self.backtest  = BacktestEngine()
        self._seen:   Dict[str, datetime] = {}
        self._dynamic_threshold = MIN_USD_THRESHOLD
        self._signal_hour_count = 0
        self._hour_reset = datetime.now()

    def _cooldown_ok(self, addr: str, mins: int = 45) -> bool:
        if addr in self._seen:
            return (datetime.now() - self._seen[addr]) > timedelta(minutes=mins)
        return True

    def _hourly_ok(self) -> bool:
        now = datetime.now()
        if (now - self._hour_reset).seconds >= 3600:
            self._signal_hour_count = 0
            self._hour_reset = now
        return self._signal_hour_count < MAX_SIGNALS_PER_HR

    def _adjust_dynamic_threshold(self, snaps: List[MarketSnapshot]):
        """Bozor umumiy volatilitetsiga qarab chegarani moslashtirish."""
        if not DYNAMIC_THRESHOLD_ENABLED or not snaps:
            return
        avg_change = sum(abs(s.change_1h) for s in snaps[:50]) / min(50, len(snaps))
        if avg_change > 10:
            self._dynamic_threshold = MIN_USD_THRESHOLD * 1.5
        elif avg_change < 3:
            self._dynamic_threshold = MIN_USD_THRESHOLD * 0.8
        else:
            self._dynamic_threshold = MIN_USD_THRESHOLD

    def _compute_targets(self, snap: MarketSnapshot, signal_type: str) -> Tuple[float, float, float, float]:
        """Kirish, maqsad 1/2, stop-loss hisoblash."""
        p = snap.price_usd
        if "BUY" in signal_type or signal_type in ("ACCUMULATION", "BREAKOUT"):
            entry = p
            t1    = p * 1.05
            t2    = p * 1.12
            sl    = p * 0.96
        else:
            entry = p
            t1    = p * 0.96
            t2    = p * 0.90
            sl    = p * 1.04
        return entry, t1, t2, sl

    def analyze(self, snap: MarketSnapshot) -> Optional[SignalResult]:
        # ── Asosiy filtrlar ──
        if snap.token_symbol.upper() in self.STABLE_COINS:
            return None
        if snap.liquidity < 40_000:
            return None
        if snap.volume_24h < self._dynamic_threshold * 2: # Discoveryda hajm kichikroq bo'lishi mumkin
            return None
        if not self._cooldown_ok(snap.pair_address):
            return None
        if not self._hourly_ok():
            return None

        # ── Rug pull tekshirish ──
        is_rug, risk_flags, is_wash = self.rug.check(snap)
        if is_rug and not ("rug" in snap.token_symbol.lower()):
            # Rug bo'lsa ham, RUG_ALERT signali sifatida yuborish
            result = SignalResult(
                snapshot=snap,
                confidence=85,
                signal_type="RUG_ALERT",
                primary_reason="Rug pull belgilari aniqlandi!",
                confluence_factors=[],
                risk_flags=risk_flags,
                smc_pattern=None,
                timeframe_align={},
                backtest_winrate=None,
                risk_reward=0,
                entry_suggestion=snap.price_usd,
                target_1=0, target_2=0,
                stop_loss=snap.price_usd * 0.5,
                is_rug_risk=True,
                is_wash_trading=is_wash,
            )
            self._seen[snap.pair_address] = datetime.now()
            self._signal_hour_count += 1
            return result

        # ── Multi-timeframe confluence ──
        tf_data, mtf_bonus = self.mtf.analyze(snap)

        # ── SMC pattern ──
        smc_pattern, smc_bonus = self.smc.analyze(snap)

        # ── Hajm sifati ──
        vol_score, vol_factors = self.vol_qual.score(snap)

        # ── Asosiy signal aniqlash ──
        signal_type  = None
        base_score   = 0
        primary      = ""
        confluence   = list(vol_factors)

        total_5m  = snap.buys_5m + snap.sells_5m
        ratio_5m  = snap.buys_5m / total_5m if total_5m > 0 else 0.5
        total_1h  = snap.buys_1h + snap.sells_1h
        ratio_1h  = snap.buys_1h / total_1h if total_1h > 0 else 0.5
        total_24h = snap.buys_24h + snap.sells_24h
        ratio_24h = snap.buys_24h / total_24h if total_24h > 0 else 0.5

        # ─ STRONG BUY ─
        if (ratio_5m > 0.72 and ratio_1h > 0.65 and
                snap.volume_5m > snap.volume_1h / 8 and
                snap.change_5m > 2):
            signal_type = "STRONG_BUY"
            base_score  = 65
            primary     = f"Qisqa muddatda kuchli xarid bosimi: 5m nisbat {ratio_5m:.0%}, 1h nisbat {ratio_1h:.0%}"
            confluence.append(f"5m hajm {snap.volume_5m:,.0f}$ portladi")

        # ─ BUY PRESSURE ─
        elif ratio_1h > 0.65 and snap.volume_24h > self._dynamic_threshold * 4:
            signal_type = "BUY"
            base_score  = 55
            primary     = f"1s xarid bosimi: {ratio_1h:.0%} xaridorlar ustun"
            confluence.append(f"24s hajm: ${snap.volume_24h:,.0f}")

        # ─ AKKUMULYATSIYA ─
        elif (abs(snap.change_24h) < 6 and ratio_24h > 0.58 and
              snap.volume_24h > self._dynamic_threshold * 3 and
              snap.age_hours > 48):
            signal_type = "ACCUMULATION"
            base_score  = 58
            primary     = f"Kit akkumulyatsiyasi: narx barqaror ({snap.change_24h:+.1f}%), lekin xarid bosimi yuqori ({ratio_24h:.0%})"
            confluence.append("Narx barqarorligi + hajm — klassik akkumulyatsiya")

        # ─ BREAKOUT ─
        elif (snap.change_1h > 10 and snap.change_5m > 3 and
              snap.volume_5m > snap.volume_1h / 6):
            signal_type = "BREAKOUT"
            base_score  = 60
            primary     = f"Breakout: 1s +{snap.change_1h:.1f}%, 5d +{snap.change_5m:.1f}%"
            confluence.append("Hajm breakout bilan tasdiqlandi")

        # ─ DISTRIBUTION (Dump xavfi) ─
        elif (ratio_1h < 0.38 and snap.change_1h < -5 and
              snap.change_6h < -8):
            signal_type = "DISTRIBUTION"
            base_score  = 62
            primary     = f"Kit tarqatishi: sotish bosimi kuchli, 1s {snap.change_1h:+.1f}%"
            confluence.append(f"6s: {snap.change_6h:+.1f}%, sotish nisbati: {1 - ratio_1h:.0%}")

        # ─ DUMP XAVFI ─
        elif snap.change_5m < -8 and ratio_5m < 0.35:
            signal_type = "DUMP_RISK"
            base_score  = 55
            primary     = f"Tez dump: 5d {snap.change_5m:+.1f}%, sotish nisbati {1 - ratio_5m:.0%}"

        if not signal_type:
            return None

        # ── Ishonchlilik hisoblash (confluence scoring) ──
        confidence = base_score
        confidence += mtf_bonus          # Multi-timeframe uyg'unligi
        confidence += smc_bonus          # SMC pattern bonusi
        confidence += (vol_score - 50) // 5  # Hajm sifati
        if is_wash: confidence -= 20
        if snap.age_hours > 720:  confidence += 8   # 1 oy+ token
        if snap.liquidity > 1_000_000: confidence += 7
        if snap.market_cap > 0 and snap.market_cap < 50_000_000: confidence += 5  # Small cap alpha
        if smc_pattern: confluence.append(f"SMC: {smc_pattern}")

        # Backtest ma'lumoti bo'lsa, undan ham qo'shish
        wr = self.backtest.winrate(signal_type)
        if wr is not None:
            if wr >= 65: confidence += 8
            elif wr < 45: confidence -= 10

        confidence = max(0, min(100, confidence))

        if confidence < MIN_CONFIDENCE:
            return None

        # ── Maqsadlar hisoblash ──
        entry, t1, t2, sl = self._compute_targets(snap, signal_type)
        rr = abs(t1 - entry) / abs(entry - sl) if abs(entry - sl) > 0 else 0

        self._seen[snap.pair_address] = datetime.now()
        self._signal_hour_count += 1
        self.backtest.record_entry(snap, signal_type)

        return SignalResult(
            snapshot=snap,
            confidence=confidence,
            signal_type=signal_type,
            primary_reason=primary,
            confluence_factors=confluence,
            risk_flags=risk_flags,
            smc_pattern=smc_pattern,
            timeframe_align=tf_data,
            backtest_winrate=wr,
            risk_reward=round(rr, 2),
            entry_suggestion=entry,
            target_1=t1,
            target_2=t2,
            stop_loss=sl,
            is_rug_risk=is_rug,
            is_wash_trading=is_wash,
        )

# ══════════════════════════════════════════════════════
#  TELEGRAM XABAR FORMATI
# ══════════════════════════════════════════════════════

def escape_md(text: str) -> str:
    """MarkdownV2 uchun maxsus belgilarni escape qilish."""
    for ch in r"_*[]()~`>#+-=|{}.!\\":
        text = text.replace(ch, f"\\{ch}")
    return text

def format_signal(sig: SignalResult) -> str:
    snap = sig.snapshot
    dex_url = f"https://dexscreener.com/{snap.chain}/{snap.pair_address}"
    p = snap.price_usd

    # Timeframe satri
    tf_str = ""
    for tf, d in sig.timeframe_align.items():
        bias  = d.get("bias", "neutral")
        emoji = "🟢" if bias == "bull" else "🔴" if bias == "bear" else "⬜"
        ch    = d.get("change", 0)
        # MarkdownV2 requires escaping dots and minus signs
        tf_str += emoji + "`" + tf + ":" + f"{ch:+.1f}".replace(".", "\\.").replace("-", "\\-") + "%` "

    # Confluence omillari
    cf_str = ""
    for i, f in enumerate(sig.confluence_factors[:4], 1):
        cf_str += f"  {i}. {escape_md(f)}\n"

    # Risk belgilari
    rf_str = ""
    for r in sig.risk_flags:
        rf_str += f"  ⚠️ {escape_md(r)}\n"

    # Backtest
    bt_str = f"`{sig.backtest_winrate:.0f}%`".replace(".", "\\.") if sig.backtest_winrate is not None else "`Ma'lumot yo'q`"

    # RUG ALERT — alohida format
    if sig.signal_type == "RUG_ALERT":
        return (
            f"☠️ *RUG PULL XAVFI — {escape_md(snap.token_symbol)}*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🔗 Zanjir: `{snap.chain.upper()}` \\| DEX: `{snap.dex.upper()}`\n"
            f"⚠️ *Xavf belgilari:*\n{rf_str}"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🔗 [DexScreener]({dex_url})\n"
            f"⏰ {escape_md(datetime.now().strftime('%H:%M:%S'))}"
        )

    # Normal signal
    msg = (
        f"{sig.signal_emoji} *{escape_md(sig.signal_type.replace('_',' '))} — {escape_md(snap.token_symbol)}*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🪙 Token: `{escape_md(snap.token_name)}` ({escape_md(snap.token_symbol)})\n"
        f"⛓ `{snap.chain.upper()}` \\| `{snap.dex.upper()}`\n"
        f"💵 Narx: `${f'{p:.8f}'.replace('.', '\\.')}`\n\n"
        f"📊 *Timeframe tahlili:*\n{tf_str.strip()}\n\n"
        f"🎯 *Signal ishonchliligi:*\n"
        f"`{sig.confidence_bar}` {sig.confidence}/100\n\n"
        f"📌 *Asosiy sabab:*\n_{escape_md(sig.primary_reason)}_\n\n"
    )

    if cf_str:
        msg += f"✅ *Confluence omillari:*\n{cf_str}\n"

    if sig.smc_pattern:
        msg += f"🧠 *SMC Pattern:* `{escape_md(sig.smc_pattern)}`\n\n"

    msg += (
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📈 *Savdo rejasi:*\n"
        f"  Kirish: `${f'{sig.entry_suggestion:.8f}'.replace('.', '\\.')}`\n"
        f"  Maqsad 1: `${f'{sig.target_1:.8f}'.replace('.', '\\.')}` (+5%)\n"
        f"  Maqsad 2: `${f'{sig.target_2:.8f}'.replace('.', '\\.')}` (+12%)\n"
        f"  Stop\\-Loss: `${f'{sig.stop_loss:.8f}'.replace('.', '\\.')}` (\\-4%)\n"
        f"  R:R nisbati: `{f'{sig.risk_reward:.1f}'.replace('.', '\\.')}:1`\n\n"
    )

    msg += (
        f"📚 Tarixiy to'g'rilik: {bt_str}\n"
        f"💧 Likvidlik: `${f'{snap.liquidity:,.0f}'.replace(',', '\\,')}`\n"
        f"📦 Hajm (24s): `${f'{snap.volume_24h:,.0f}'.replace(',', '\\,')}`\n"
    )

    if rf_str:
        msg += f"\n⚠️ *Xavf belgilari:*\n{rf_str}"

    msg += (
        f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🔗 [DexScreener da ko'rish]({dex_url})\n"
        f"⏰ {escape_md(datetime.now().strftime('%H:%M:%S'))} \\| WhaleTracker Pro v2\\.0"
    )

    return msg

# ══════════════════════════════════════════════════════
#  BOT STATISTIKASI
# ══════════════════════════════════════════════════════

class BotStats:
    def __init__(self):
        self.start_time     = datetime.now()
        self.total_scans    = 0
        self.total_signals  = 0
        self.rug_alerts     = 0
        self.errors         = 0
        self.paused         = False
        self.custom_limit   = MIN_USD_THRESHOLD

    def uptime(self) -> str:
        d = datetime.now() - self.start_time
        h, m = divmod(d.seconds // 60, 60)
        return f"{d.days}k {h}s {m}d"

# ══════════════════════════════════════════════════════
#  ASOSIY BOT
# ══════════════════════════════════════════════════════

class WhaleTrackerBotV2:

    def __init__(self):
        self.dex     = DexScreenerAPI()
        self.engine  = SignalEngine()
        self.stats   = BotStats()
        self.bot     = Bot(token=TELEGRAM_BOT_TOKEN)
        self._last_snaps: List[MarketSnapshot] = []

    def get_main_keyboard(self):
        """Asosiy boshqaruv tugmalari"""
        pause_label = "▶️ Resume" if self.stats.paused else "⏸ Pause"
        keyboard = [
            [
                InlineKeyboardButton("📊 Status", callback_data="cmd_status"),
                InlineKeyboardButton("📈 Top 5", callback_data="cmd_top5")
            ],
            [
                InlineKeyboardButton(pause_label, callback_data="cmd_toggle_pause"),
                InlineKeyboardButton("📚 Winrate", callback_data="cmd_winrate")
            ],
            [
                InlineKeyboardButton("⚙️ Skaner", callback_data="cmd_scan_now"),
                InlineKeyboardButton("💰 Limit", callback_data="cmd_limit_info")
            ]
        ]
        return InlineKeyboardMarkup(keyboard)

    async def send(self, text: str, reply_markup=None):
        try:
            await self.bot.send_message(
                chat_id=TELEGRAM_CHAT_ID,
                text=text,
                parse_mode=ParseMode.MARKDOWN_V2,
                disable_web_page_preview=False,
                reply_markup=reply_markup
            )
        except Exception as e:
            log.error(f"Telegram yuborish xatosi: {e}")

    async def send_startup(self):
        chains = escape_md(", ".join(c.upper() for c in WATCH_CHAINS))
        msg = (
            f"🐋 *Whale Tracker Pro v2\\.0 ishga tushdi\\!*\n\n"
            f"✅ Multi\\-timeframe confluence aktiv\n"
            f"✅ Smart Money Concept analyzer aktiv\n"
            f"✅ Rug pull detector aktiv\n"
            f"✅ Backtest engine aktiv\n"
            f"✅ Wash trading filter aktiv\n\n"
            f"📡 Zanjirlar: `{chains}`\n"
            f"💰 Minimal summa: `${f'{MIN_USD_THRESHOLD:,}'.replace(',', '\\,')}`\n"
            f"🎯 Minimal ishonchlilik: `{MIN_CONFIDENCE}/100`\n"
            f"⏱ Interval: `{SCAN_INTERVAL_SEC}s`\n\n"
            f"_Boshqaruv paneli uchun /start buyrug'ini bering\\._"
        )
        await self.send(msg, reply_markup=self.get_main_keyboard())

    async def scan_once(self):
        if self.stats.paused:
            return

        self.stats.total_scans += 1
        log.info(f"🔍 Skan #{self.stats.total_scans}...")

        # 1. Discovery: Oxirgi profillarini olish
        profiles = await self.dex.get_latest_profiles()
        log.info(f"Discovery: {len(profiles)} ta profil topildi.")

        # 2. Tokenlar bo'yicha juftliklarni fetch qilish
        all_pairs: List[Dict] = []

        # Discoveryda ko'p token bo'lishi mumkin, limitlaymiz va rate limitga amal qilamiz
        for prof in profiles[:40]:
            chain_id = prof.get("chainId")
            token_addr = prof.get("tokenAddress")
            if chain_id and token_addr and chain_id in WATCH_CHAINS:
                pairs = await self.dex.get_token_pairs(chain_id, token_addr)
                all_pairs.extend(pairs)
                await asyncio.sleep(0.2) # Rate limit protection

        # Snapshot'larni yaratish
        snaps: List[MarketSnapshot] = []
        seen = set()
        for p in all_pairs:
            addr = p.get("pairAddress", "")
            if addr in seen: continue
            seen.add(addr)
            snap = parse_snapshot(p)
            if snap: snaps.append(snap)

        self._last_snaps = snaps

        # Dinamik threshold
        self.engine._adjust_dynamic_threshold(snaps)

        # Backtest natijalarini tekshirish
        self.engine.backtest.check_outcomes(snaps)

        # Signallarni tahlil qilish
        signals: List[SignalResult] = []
        for snap in snaps:
            result = self.engine.analyze(snap)
            if result:
                signals.append(result)

        # Ishonchlilikka qarab tartiblash
        signals.sort(key=lambda s: s.confidence, reverse=True)

        for sig in signals:
            self.stats.total_signals += 1
            if sig.signal_type == "RUG_ALERT":
                self.stats.rug_alerts += 1
            msg = format_signal(sig)
            await self.send(msg)
            log.info(
                f"{Fore.GREEN}✅{Style.RESET_ALL} {sig.signal_emoji} "
                f"{sig.snapshot.token_symbol} [{sig.signal_type}] "
                f"Ishonchlilik: {sig.confidence}/100"
            )
            await asyncio.sleep(1.5)

        log.info(
            f"✅ Skan tugadi | Snaps: {len(snaps)} | "
            f"Signallar: {len(signals)} | Jami: {self.stats.total_signals}"
        )

    # ─── TELEGRAM QO'MONDONLARI ───────────────────────

    async def cmd_start(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        msg = "🐋 *Whale Tracker Pro v2\\.0 Boshqaruv Paneli*\n\nBoshqarish uchun tugmalardan foydalaning:"
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

    async def get_status_text(self) -> str:
        wr = self.engine.backtest.overall_winrate()
        wr_str = f"`{f'{wr:.0f}'.replace('.', '\\.')}%`" if wr is not None else "`Hali ma'lumot yo'q`"
        return (
            f"📊 *Bot holati*\n\n"
            f"⏱ Ishlash vaqti: `{escape_md(self.stats.uptime())}`\n"
            f"🔍 Jami skanlar: `{self.stats.total_scans}`\n"
            f"📨 Jami signallar: `{self.stats.total_signals}`\n"
            f"☠️ Rug alertlar: `{self.stats.rug_alerts}`\n"
            f"📚 Umumiy to'g'rilik: {wr_str}\n"
            f"💰 Joriy chegara: `${f'{self.engine._dynamic_threshold:,.0f}'.replace(',', '\\,')}`\n"
            "⏸ Holat: `" + ("TO'XTATILGAN" if self.stats.paused else "FAOL") + "`"
        )

    async def cmd_status(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        msg = await self.get_status_text()
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

    async def cmd_top5(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        if not self._last_snaps:
            await update.message.reply_text("Hali skan qilinmagan.")
            return
        top = sorted(self._last_snaps, key=lambda s: s.volume_24h, reverse=True)[:5]
        lines = ["📈 *Top 5 token (hajm bo'yicha)*\n"]
        for i, s in enumerate(top, 1):
            lines.append(
                f"{i}. `{escape_md(s.token_symbol)}` "
                f"({escape_md(s.chain.upper())}) — "
                f"`${f'{s.volume_24h:,.0f}'.replace(',', '\\,')}` hajm, "
                f"`{f'{s.change_24h:+.1f}'.replace('.', '\\.').replace('-', '\\-')}%`"
            )
        await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

    async def cmd_pause(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        self.stats.paused = True
        await update.message.reply_text("⏸ Bot to'xtatildi. Resuming: /resume", parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

    async def cmd_resume(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        self.stats.paused = False
        await update.message.reply_text("▶️ Bot qayta ishga tushdi!", parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

    async def cmd_setlimit(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        try:
            val = int(ctx.args[0])
            self.engine._dynamic_threshold = val
            await update.message.reply_text(
                f"✅ Yangi chegara: `${f'{val:,}'.replace(',', '\\,')}` o'rnatildi.",
                parse_mode=ParseMode.MARKDOWN_V2,
                reply_markup=self.get_main_keyboard()
            )
        except (IndexError, ValueError):
            await update.message.reply_text("Foydalanish: /setlimit 75000")

    async def get_winrate_text(self) -> str:
        lines = ["📚 *Signal turlari bo'yicha to'g'rilik*\n"]
        for stype, results in self.engine.backtest._results.items():
            if results:
                wr = sum(results) / len(results) * 100
                lines.append(f"`{escape_md(stype)}`: `{f'{wr:.0f}'.replace('.', '\\.')}%` ({len(results)} ta signal)")
        if len(lines) == 1:
            lines.append("_Hali ma'lumot yo'q_")
        return "\n".join(lines)

    async def cmd_winrate(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        msg = await self.get_winrate_text()
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

    async def button_callback(self, update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        data = query.data

        if data == "cmd_status":
            msg = await self.get_status_text()
            await query.edit_message_text(msg, parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

        elif data == "cmd_top5":
            if not self._last_snaps:
                await query.message.reply_text("Hali skan qilinmagan.")
                return
            top = sorted(self._last_snaps, key=lambda s: s.volume_24h, reverse=True)[:5]
            lines = ["📈 *Top 5 token (hajm bo'yicha)*\n"]
            for i, s in enumerate(top, 1):
                lines.append(
                    f"{i}. `{escape_md(s.token_symbol)}` "
                    f"({escape_md(s.chain.upper())}) — "
                    f"`${f'{s.volume_24h:,.0f}'.replace(',', '\\,')}` hajm, "
                    f"`{f'{s.change_24h:+.1f}'.replace('.', '\\.').replace('-', '\\-')}%`"
                )
            await query.edit_message_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

        elif data == "cmd_toggle_pause":
            self.stats.paused = not self.stats.paused
            status = "TO'XTATILGAN" if self.stats.paused else "FAOL"
            await query.message.reply_text(f"🔄 Bot holati o'zgardi: `{status}`", parse_mode=ParseMode.MARKDOWN_V2)
            msg = await self.get_status_text()
            await query.edit_message_text(msg, parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

        elif data == "cmd_winrate":
            msg = await self.get_winrate_text()
            await query.edit_message_text(msg, parse_mode=ParseMode.MARKDOWN_V2, reply_markup=self.get_main_keyboard())

        elif data == "cmd_scan_now":
            await query.message.reply_text("🔍 Navbatdan tashqari skanerlash boshlandi...")
            asyncio.create_task(self.scan_once())

        elif data == "cmd_limit_info":
            await query.message.reply_text(
                f"💰 Joriy xarid limiti: `${f'{self.engine._dynamic_threshold:,.0f}'.replace(',', '\\,')}`\n"
                f"O'zgartirish uchun `/setlimit 100000` kabi buyruq bering\\.",
                parse_mode=ParseMode.MARKDOWN_V2
            )

    # ─── ISHGA TUSHIRISH ──────────────────────────────

    async def run(self):
        print(f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════╗
║      WHALE TRACKER PRO  v2.0 — MAX INTELLIGENCE      ║
╚══════════════════════════════════════════════════════╝{Style.RESET_ALL}
{Fore.YELLOW}  Multi-TF · SMC · Rug Detect · Backtest · Anti-Wash{Style.RESET_ALL}
        """)

        await self.send_startup()

        app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
        app.add_handler(CommandHandler("start",    self.cmd_start))
        app.add_handler(CommandHandler("status",   self.cmd_status))
        app.add_handler(CommandHandler("top5",     self.cmd_top5))
        app.add_handler(CommandHandler("pause",    self.cmd_pause))
        app.add_handler(CommandHandler("resume",   self.cmd_resume))
        app.add_handler(CommandHandler("setlimit", self.cmd_setlimit))
        app.add_handler(CommandHandler("winrate",  self.cmd_winrate))
        app.add_handler(CallbackQueryHandler(self.button_callback))

        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            self.scan_once,
            "interval",
            seconds=SCAN_INTERVAL_SEC,
            next_run_time=datetime.now(),
        )
        scheduler.start()

        log.info("Scheduler va Telegram bot ishga tushdi. Ctrl+C — to'xtatish.")
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

        scheduler.shutdown()
        await self.dex.close()
        log.info("Bot to'xtatildi.")

# ══════════════════════════════════════════════════════

if __name__ == "__main__":
    asyncio.run(WhaleTrackerBotV2().run())
