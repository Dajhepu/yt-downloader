from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from .config import settings
from loguru import logger

class TelegramBot:
    def __init__(self):
        self.app = Application.builder().token(settings.TELEGRAM_TOKEN).build()
        self._add_handlers()

    def _add_handlers(self):
        self.app.add_handler(CommandHandler("start", self.cmd_start))
        self.app.add_handler(CommandHandler("status", self.cmd_status))
        self.app.add_handler(CallbackQueryHandler(self.button_handler))

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            "🎰 **Betting Arbitrage Bot v2026**\n\n"
            "Monitoring Betpanda & CoinCasino for 100% profit ops.",
            parse_mode="Markdown",
            reply_markup=self.main_keyboard()
        )

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        text = (
            f"📊 **Bot Status**\n"
            f"Profit threshold: {settings.MIN_PROFIT_PERCENT}%\n"
            f"Polling: {settings.POLLING_INTERVAL_SECONDS}s\n"
            f"Active Sports: {', '.join(settings.ACTIVE_SPORTS)}"
        )
        await update.message.reply_text(text, parse_mode="Markdown")

    def main_keyboard(self):
        return InlineKeyboardMarkup([
            [InlineKeyboardButton("🔄 Skanerlash", callback_data="scan_now")],
            [InlineKeyboardButton("⚙️ Sozlamalar", callback_data="settings_menu")]
        ])

    async def button_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()

        if query.data == "scan_now":
            await query.edit_message_text("Skanerlash buyrug'i yuborildi...")
        elif query.data == "settings_menu":
            await query.edit_message_text("Sozlamalar paneli (tez kunda...)")

    async def send_alert(self, arb_data):
        text = (
            f"🔥 **ARBITRAZH TOPILDI!**\n\n"
            f"🏆 **{arb_data['event']}**\n"
            f"📈 Foyda: `{arb_data['profit']:.2f}%`\n"
            f"📝 Bozor: `{arb_data['market']}`\n\n"
            f"💰 **Stake:**\n"
        )
        for platform, stake in arb_data['stakes'].items():
            text += f"• {platform}: `${stake:.2f}` (Odd: {arb_data['odds'][platform]})\n"

        await self.app.bot.send_message(
            chat_id=settings.CHAT_ID,
            text=text,
            parse_mode="Markdown",
            disable_web_page_preview=True
        )

    def run(self):
        logger.info("Starting Telegram Bot...")
        self.app.run_polling()
