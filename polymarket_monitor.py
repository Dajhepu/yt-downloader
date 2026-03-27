import argparse
import requests
import json
import time
import sys
from rich.console import Console
from rich.table import Table

console = Console()

def parse_json_field(field):
    """Field string bo'lsa JSON parse qiladi, aks holda o'zini qaytaradi."""
    if isinstance(field, str):
        try:
            return json.loads(field)
        except json.JSONDecodeError:
            return None
    return field

def fetch_markets(limit=500):
    """Polymarket Gamma API dan savdolarni oladi."""
    url = f"https://gamma-api.polymarket.com/markets?active=true&closed=false&limit={limit}"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        console.print(f"[red]Tarmoq xatosi: {e}[/red]")
        return []
    except Exception as e:
        console.print(f"[red]Kutilmagan xatolik: {e}[/red]")
        return []

def filter_markets(markets, yes_min, yes_max, no_min, no_max):
    """Savdolarni berilgan oraliqlar bo'yicha filtrlaydi."""
    filtered = []
    for market in markets:
        try:
            outcomes = parse_json_field(market.get('outcomes'))
            prices = parse_json_field(market.get('outcomePrices'))

            if not outcomes or not prices:
                continue

            # Faqat Yes/No savdolar
            if len(outcomes) == 2 and outcomes[0] == "Yes" and outcomes[1] == "No":
                yes_price = float(prices[0])
                no_price = float(prices[1])

                # Filtr shartlari
                if yes_min <= yes_price <= yes_max and no_min <= no_price <= no_max:
                    filtered.append({
                        'question': market.get('question'),
                        'yes': yes_price,
                        'no': no_price,
                        'slug': market.get('slug')
                    })
        except (ValueError, TypeError, IndexError):
            continue
    return filtered

def generate_table(filtered_markets, yes_range, no_range):
    """Natijalarni chiroyli jadval ko'rinishida generatsiya qiladi."""
    title = f"Polymarket Savdolari (Yes: {yes_range[0]*100}-{yes_range[1]*100}%, No: {no_range[0]*100}-{no_range[1]*100}%)"
    table = Table(title=title, title_style="bold magenta", header_style="bold white")

    table.add_column("№", justify="right", style="dim")
    table.add_column("Savdo Nomi", style="cyan", no_wrap=False)
    table.add_column("Yes %", justify="center", style="green")
    table.add_column("No %", justify="center", style="red")
    table.add_column("URL", style="blue")

    for idx, m in enumerate(filtered_markets, 1):
        url = f"https://polymarket.com/event/{m['slug']}"
        table.add_row(
            str(idx),
            m['question'],
            f"{m['yes']*100:.1f}%",
            f"{m['no']*100:.1f}%",
            url
        )
    return table

def main():
    parser = argparse.ArgumentParser(description="Polymarket savdolarini monitoring qilish dasturi.")
    parser.add_argument("--yes-min", type=float, default=0.30, help="Yes uchun minimal ehtimollik (0.0-1.0)")
    parser.add_argument("--yes-max", type=float, default=0.40, help="Yes uchun maksimal ehtimollik (0.0-1.0)")
    parser.add_argument("--no-min", type=float, default=0.55, help="No uchun minimal ehtimollik (0.0-1.0)")
    parser.add_argument("--no-max", type=float, default=0.70, help="No uchun maksimal ehtimollik (0.0-1.0)")
    parser.add_argument("--interval", type=int, default=60, help="Yangilanish oralig'i (soniya)")
    parser.add_argument("--limit", type=int, default=500, help="API dan olinadigan savdolar soni")

    args = parser.parse_args()

    console.print("[bold yellow]Polymarket Monitor ishga tushdi...[/bold yellow]")
    console.print(f"[italic]Filtr: Yes ({args.yes_min*100}-{args.yes_max*100}%), No ({args.no_min*100}-{args.no_max*100}%)[/italic]\n")

    try:
        while True:
            markets = fetch_markets(limit=args.limit)
            filtered = filter_markets(markets, args.yes_min, args.yes_max, args.no_min, args.no_max)

            if not filtered:
                console.print(f"[yellow]Mos keladigan savdolar topilmadi. ({time.strftime('%H:%M:%S')})[/yellow]", end="\r")
            else:
                console.clear()
                console.print(generate_table(filtered, (args.yes_min, args.yes_max), (args.no_min, args.no_max)))
                console.print(f"\n[dim]Oxirgi yangilanish: {time.strftime('%H:%M:%S')}. To'xtatish uchun Ctrl+C bosing.[/dim]")

            time.sleep(args.interval)
    except KeyboardInterrupt:
        console.print("\n[bold red]Dastur to'xtatildi.[/bold red]")
        sys.exit(0)

if __name__ == "__main__":
    main()
