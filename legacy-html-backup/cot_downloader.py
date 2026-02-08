import requests
import json
import os
from datetime import datetime
import re

# =========================================================================
# ⚠️ KRITISCHE KONFIGURATION FÜR CFTC LEGACY REPORT (TEXT-BASIERT) ⚠️
# =========================================================================
COT_REPORT_URL = "https://www.cftc.gov/dea/futures/financial_lf.htm" 
OUTPUT_FILE = "cot_import_data.json" # Diese Datei importierst du im Journal

# Die Spalten-Positionen im Positions-Block (Dealer/Intermediary und Asset Manager/Institutional)
# Dealer/Intermediary Long: Spalte 1 (Index 0)
# Dealer/Intermediary Short: Spalte 2 (Index 1)
# Asset Manager/Institutional Long: Spalte 4 (Index 3)
# Asset Manager/Institutional Short: Spalte 5 (Index 4)

# Währungs-Mapping (für die Suche im Text)
WAHRUNGEN_COT_MAPPING = {
    'AUD': 'AUSTRALIAN DOLLAR',
    'GBP': 'BRITISH POUND',
    'EUR': 'EURO FX',
    'JPY': 'JAPANESE YEN',
    'NZD': 'NZ DOLLAR',
    'CHF': 'SWISS FRANC',
    'CAD': 'CANADIAN DOLLAR',
    'USD': 'U.S. DOLLAR INDEX', # Dein JS-Mapping (cot_daten.js) kannte USD noch nicht
}

# 🌐 HEADERS: (Die von dir bereitgestellten Header, ggf. Cookie aktualisieren!)
# ⚠️ WICHTIG: Das 'Cookie' hier ist entscheidend. Wenn das Skript fehlschlägt (z.B. Fehler 403 oder 503),
# musst du die CFTC-Seite im Browser besuchen, die Cookies aus den Entwicklertools kopieren 
# und diese Zeile hier ersetzen.
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'de,de-DE;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,de-CH;q=0.5',
    'Cookie': '_gid=GA1.2.1651113120.1762110618; _ga=GA1.1.1130498590.1762110618; _ga_CSLL4ZEK4L=GS2.1.s1762110618$o1$g1$t1762110637$j41$l0$h0; _ga_2E5HHJE4M3=GS2.1.s1762110618$o1$g1$t1762110637$j41$l0$h0; cf_clearance=SR8yEgyNu_jFP4OVBDi9Fp_IPnapsNk.ajM2upkgIzU-1762113788-1.2.1.1-Rp8SskO3MuEvDVjm1l4cT3Kd7TLCEGLxqYCUnhEqSv8IUusns89EQZJkxpWptHynNPNslnvLp.oJQkVK7_93nfBxEqU_4Iq8mWqLPXcXmwfZ_pfOUOOWNo.4fn7zcXzqmHzCJ7dvKIzd4d7OtdzKFvW4Y1C9vb5ByiXO8hVEwwOdYkiKN8eCW9XqH3ADSlHJYNix8PH0n2VVAxK7AB6ZgjYjM5RVsudalT5q_rt6y7A; __cf_bm=koCV5y6HOGIosoeg2I4jT1M5i0EO8lRYzv7cPreAdU-1762113788.1089196-1.0.1.1-3xFs84m.zfiegryM9fk40qurWQphQaCbOnSzGnR38oXckNr2ZjnJTaLHMmdxWtVfsHN03qjqi4aP8oi9pTu6dGITpmvm8kqfMjgVXwSvRansJ2XK5KY6S46qxDlghelg',
    'Pragma': 'no-cache',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
}

def clean_and_convert(text):
    """Entfernt Leerzeichen, Kommas und konvertiert zu int."""
    if not text:
        return 0
    cleaned = ''.join(c for c in text if c.isdigit() or c == '-')
    return int(cleaned.strip() or 0)


def extract_data_from_text(cot_text, journal_code, search_term):
    """Sucht und parst die Positionsdaten für eine Währung im COT-Text."""
    
    # 1. Währungsgruppe finden
    pattern = re.escape(search_term) + r'.*?' + r'Positions\s*\n(.*?)\n\s*Changes from:'
    match = re.search(pattern, cot_text, re.DOTALL)
    
    if not match:
        print(f"   --> KONNTE DATENBLOCK FÜR '{search_term}' NICHT FINDEN.")
        return None

    positions_line = match.group(1).strip()
    numbers = re.findall(r'-?\s*[\d,]+\s*', positions_line)

    if len(numbers) < 15:
        print(f"   --> FEHLER: Positionszeile für {search_term} hat nur {len(numbers)} Spalten.")
    
    try:
        dealer_long = clean_and_convert(numbers[0])
        dealer_short = clean_and_convert(numbers[1])
        asset_long = clean_and_convert(numbers[3])
        asset_short = clean_and_convert(numbers[4])
    except IndexError:
         print(f"   --> FEHLER: Konnte nicht alle Commercial-Positionen in der Zeile finden.")
         return None


    # 4. Changes-Zeile finden und parsen (Wird für die JS-App nicht benötigt, aber für die Vollständigkeit)
    block_pattern = re.escape(search_term) + r'.*?' + r'Changes from:.*?\n\s*(-?\s*[\d,]+\s+.*)\n'
    block_match = re.search(block_pattern, cot_text, re.DOTALL)
    
    if not block_match:
         print(f"   --> KONNTE ÄNDERUNGSBLOCK FÜR '{search_term}' NICHT FINDEN.")
         return None
    
    changes_line = block_match.group(1).strip()
    changes_numbers = re.findall(r'-?\s*[\d,.]+\s*', changes_line)
    
    if len(changes_numbers) < 15:
        print(f"   --> FEHLER: Changes-Zeile für {search_term} hat nur {len(changes_numbers)} Spalten.")
        
    try:
        dealer_change_long = clean_and_convert(changes_numbers[0])
        dealer_change_short = clean_and_convert(changes_numbers[1])
        asset_change_long = clean_and_convert(changes_numbers[3])
        asset_change_short = clean_and_convert(changes_numbers[4])
    except IndexError:
        print(f"   --> FEHLER: Konnte nicht alle Commercial-Änderungen in der Zeile finden.")
        return None
        
    
    # Summiere Dealer/Intermediary und Asset Manager/Institutional für die "Commercials"
    total_long = dealer_long + asset_long
    total_short = dealer_short + asset_short
    total_change_long = dealer_change_long + asset_change_long
    total_change_short = dealer_change_short + asset_change_short
    
    return {
        'long_pos': total_long,
        'short_pos': total_short,
        'change_long': total_change_long,
        'change_short': total_change_short
    }


def fetch_and_process_cot_data_scraper():
    """Führt das Web Scraping durch und speichert die Daten in einem 
    JS-kompatiblen Format."""
    print(f"Lade COT-Report von {COT_REPORT_URL} und parse als reinen Text...")
    print("⚠️ WARNUNG: Dieser Scraper ist auf ein hardcodiertes Cookie angewiesen.")
    print("   Wenn der Download fehlschlägt (403 Forbidden/Cloudflare), muss das 'Cookie' im .py-Skript manuell aktualisiert werden!")
    
    try:
        response = requests.get(COT_REPORT_URL, headers=HEADERS)
        response.raise_for_status()
        
        cot_text = response.text
        
        # 1. Report Datum extrahieren
        # KORRIGIERTE LOGIK: Sucht nach "Positions as of" gefolgt vom vollständigen Monats-/Datumsmuster.
        # Dieses Regex ist spezifischer, um falsche Treffer zu vermeiden.
        date_match = re.search(r'Positions as of\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})', cot_text)
        
        report_date_str = ""
        if date_match:
            report_date_str = date_match.group(1).strip() # z.B. "September 2, 2025"
        
        report_date = ""
        
        try:
            # Versucht, das volle Datum zu parsen (z.B. "September 2, 2025")
            # Das Format %d funktioniert für '2' und '02'
            report_date = datetime.strptime(report_date_str, "%B %d, %Y").strftime("%Y-%m-%d")
        except ValueError:
            # === KORRIGIERTER BUGFIX ===
            # Wenn das Parsen fehlschlägt (z.B. date_match war None),
            # weise NICHT den kaputten String zu, sondern einen sicheren Fallback.
            print(f"   --> WARNUNG: Konnte Datum nicht aus '{report_date_str}' parsen. Nutze heutiges Datum.")
            report_date = datetime.now().strftime("%Y-%m-%d")
        
        print(f"Report-Datum gefunden: {report_date}")

        # === NEUE LOGIK: JS-kompatible Liste ===
        new_entries = []
        
        # 2. Daten für jede Währung scrapen
        for journal_code, search_term in WAHRUNGEN_COT_MAPPING.items():
            print(f"Suche Daten für {journal_code} (Suchbegriff: {search_term})...")
            raw_data = extract_data_from_text(cot_text, journal_code, search_term)
            
            if raw_data:
                netto_position = raw_data['long_pos'] - raw_data['short_pos']
                
                # Erstelle einen Eintrag, der mit data_manager.js kompatibel ist
                entry = {
                    "id": int(datetime.now().timestamp() * 1000) + len(new_entries), # Eindeutige ID
                    "date": report_date,
                    "symbol": journal_code,
                    "commercial_net_position": netto_position
                }
                new_entries.append(entry)
                print(f"✅ {journal_code}: Netto-Position: {netto_position}")

        # 3. Daten speichern (Logik angepasst)
        if new_entries:
            # Lade bestehende Daten, um Duplikate zu vermeiden
            all_reports_js_format = []
            if os.path.exists(OUTPUT_FILE):
                with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                    try:
                        all_reports_js_format = json.load(f)
                    except json.JSONDecodeError:
                        pass # Datei ist leer oder korrupt

            # Finde heraus, welche Einträge (basierend auf Datum UND Symbol) neu sind
            existing_keys = {f"{r.get('date')}_{r.get('symbol')}" for r in all_reports_js_format}
            added_count = 0
            
            for entry in new_entries:
                entry_key = f"{entry['date']}_{entry['symbol']}"
                if entry_key not in existing_keys:
                    all_reports_js_format.append(entry)
                    added_count += 1
                else:
                    print(f"   -> {entry['symbol']} am {entry['date']} existiert bereits, wird übersprungen.")

            if added_count > 0:
                with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                    json.dump(all_reports_js_format, f, ensure_ascii=False, indent=4)
                
                print(f"\n✨ Erfolgreich {added_count} NEUE Währungs-Einträge verarbeitet. Report-Datum: {report_date}")
                print(f"Die Daten wurden zur Datei '{OUTPUT_FILE}' hinzugefügt.")
            else:
                print(f"\nℹ️ Keine neuen Einträge für das Datum {report_date} gefunden. Datei ist aktuell.")
        else:
            print("\n❌ Abbruch: Keine COT-Daten konnten erfolgreich abgerufen oder geparst werden. Prüfe das Cookie oder die Regex-Logik.")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Fehler beim Abrufen der Webseite: {e}")
        print("WAHRSCHEINLICHER GRUND: Das 'Cookie' ist abgelaufen oder die Seite blockiert den Zugriff.")
    except Exception as e:
        print(f"❌ Ein unerwarteter Fehler ist aufgetreten: {e}")


if __name__ == "__main__":
    fetch_and_process_cot_data_scraper()