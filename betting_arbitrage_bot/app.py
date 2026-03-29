import streamlit as st
import pandas as pd
import time
import json
import os
from .config import settings

def run_dashboard():
    st.set_page_config(page_title="Betting Arbitrage Dashboard", layout="wide")

    st.title("🎰 Betting Arbitrage Real-Time Monitor")

    # Sidebar Filters
    st.sidebar.header("Filterlar")
    min_profit = st.sidebar.slider("Minimal foyda (%)", 0.0, 10.0, settings.MIN_PROFIT_PERCENT)

    # Main Dashboard Area
    col1, col2, col3 = st.columns(3)
    col1.metric("Aktiv Skanerlar", "2/2 (Betpanda, CoinCasino)")

    # Load Data
    opportunities = []
    if os.path.exists(settings.DATA_FILE):
        try:
            with open(settings.DATA_FILE, "r") as f:
                opportunities = json.load(f)
        except: pass

    col2.metric("Topilgan Arblar", str(len(opportunities)))
    col3.metric("Oxirgi yangilanish", time.strftime("%H:%M:%S"))

    st.subheader("🔥 Hozirgi imkoniyatlar")

    if opportunities:
        df_data = []
        for o in opportunities:
            if o['profit'] >= min_profit:
                df_data.append({
                    "Event": o['event'],
                    "Market": o['market'],
                    "Profit %": f"{o['profit']:.2f}%",
                    "Stakes": str(o['stakes'])
                })
        df = pd.DataFrame(df_data)
        st.dataframe(df, use_container_width=True)
    else:
        st.info("Hozircha arbitraj imkoniyatlari topilmadi.")

    # Auto-refresh
    time.sleep(10)
    st.rerun()

if __name__ == "__main__":
    run_dashboard()
