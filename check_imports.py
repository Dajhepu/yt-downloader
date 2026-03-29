try:
    from telegram import Update
    print("Success: from telegram import Update")
except ImportError as e:
    print(f"Error: {e}")

import telegram
print(f"Telegram package location: {telegram.__file__}")
