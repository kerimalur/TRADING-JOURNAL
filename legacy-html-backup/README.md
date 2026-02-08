# 📊 Trading Journal Professional v2.0

Ein vollständiges, professionelles Trading Journal mit erweiterten Features für seriöse Trader.

## 🚀 Features

### Core Trading Features
- ✅ **Dual-Account System**: Separate EK & Funded Accounts
- ✅ **Trade Management**: Vollständige CRUD mit R-Multiple Tracking
- ✅ **5 Setup-Typen**: Daily BOS, Value Area, Market Structure, Weekly GVA, 3Day GVA
- ✅ **Equity Curve**: Interaktive Charts mit PnL & R-Multiple Ansicht
- ✅ **Umfassende Statistiken**: Win Rate, Expectancy, Profit Factor, Performance-Analysen
- ✅ **Calendar View**: Monatliche Übersicht aller Trades

### Erweiterte Features (NEU in v2.0)
- 🔒 **Verbesserte Sicherheit**: PBKDF2 Hashing, Session-Timeout, Brute-Force Schutz
- 💾 **Auto-Backup System**: IndexedDB mit automatischen Backups alle 5 Minuten
- 📤 **Erweiterte Import/Export**: CSV, JSON, Excel, MT4/MT5 Import
- 🚀 **Performance-Optimierungen**: Virtual Scrolling, Lazy Loading, Memoization
- 📡 **Offline-Fähigkeit**: Service Worker mit vollständiger Offline-Nutzung
- 🎨 **UI Feedback System**: Toast Notifications, Loading States, Skeleton Screens
- 🔄 **Robustes API-Handling**: Retry-Mechanismus, Fallbacks, Error-Logging

### Datenquellen & Analysen
- 📊 **COT-Daten**: Automatischer Import von CFTC (Commitment of Traders)
- 📰 **Wirtschaftskalender**: Forex Factory News-Integration
- 💱 **Währungsanalyse**: Multi-Faktor Confluence (COT + Bias + News)
- 🎲 **Monte Carlo Simulation**: 1000 Szenarien für Zukunftsprognosen
- 🤖 **ML Data Export**: Bereite Daten für Machine Learning vor

## 🛠️ Installation & Setup

### Schritt 1: Dateien Herunterladen
```bash
# Klone oder lade das Repository herunter
git clone https://github.com/yourusername/trading-journal.git
cd trading-journal
```

### Schritt 2: Browser Öffnen
Öffne `startseite.html` in einem modernen Browser (Chrome, Firefox, Edge).

**Wichtig**: Für API-Features wird eine Internetverbindung benötigt.

### Schritt 3: Erstes Passwort Setzen
1. Du wirst automatisch zu [kontoeinstellungen.html](kontoeinstellungen.html) weitergeleitet
2. Erstelle ein sicheres Passwort (mindestens 6 Zeichen)
3. Konfiguriere deine Kontoeinstellungen

## 📚 Verwendung

### Trade Erfassen
1. Navigiere zu **EK Journal** oder **Funded Journal**
2. Klicke auf "Trade erfassen"
3. Fülle alle Felder aus:
   - **Datum**: Handelsdatum
   - **Paar**: Währungspaar (z.B. EURUSD)
   - **Richtung**: Long oder Short
   - **Entry/Exit/Stop Loss**: Preise
   - **R-Multiple**: Wird automatisch berechnet oder manuell eingeben
   - **Setup**: Wähle dein Trading-Setup
   - **Notes**: Optionale Notizen
   - **Screenshot**: Optional, Bild hochladen (wird komprimiert)
4. Speichern

### Daten Exportieren
1. Öffne **Kontoeinstellungen**
2. Scrolle zu "Daten-Management"
3. Wähle Exportformat:
   - **JSON**: Komplettes Backup aller Daten
   - **CSV**: Trades für Excel/Spreadsheets
   - **Backup**: IndexedDB Backup mit Zeitstempel

### Daten Importieren
1. **CSV-Import**: Drag & Drop oder Datei auswählen
2. **JSON-Import**: Komplettes Backup wiederherstellen
3. **MT4/MT5 Import**: HTML-Report von MetaTrader hochladen

### API-Keys Konfigurieren (Optional)
Für bessere COT-Daten-Qualität:

1. Gehe zu [Nasdaq Data Link](https://data.nasdaq.com/) (ehemals Quandl)
2. Registriere dich kostenlos (50 API Calls/Tag)
3. Kopiere deinen API-Key
4. Öffne `api_data_service.js`
5. Trage Key ein:
   ```javascript
   NASDAQ_API_KEY: 'DEIN_KEY_HIER'
   ```

## ⚙️ Konfiguration

### Account-Einstellungen
In [kontoeinstellungen.html](kontoeinstellungen.html):

**EK-Konto**:
- Start-Balance
- Standard-Risiko pro Trade (%)
- Währung

**Funded-Konto**:
- Start-Balance
- Profit-Target (%, R oder absolut)
- Max Drawdown (%, R oder absolut)
- Standard-Risiko pro Trade (%)

### Themes
- **Dark Mode** (Standard)
- **Light Mode**
- Toggle über Sidebar oder Header

## 🔒 Sicherheit

### Passwort-Schutz
- **Algorithmus**: PBKDF2 mit 100.000 Iterationen
- **Salt**: 16-Byte zufälliger Salt pro Passwort
- **Session-Timeout**: 30 Minuten Inaktivität
- **Brute-Force Schutz**: 5 Versuche → 15 Min Sperre

### Daten-Backup
- **Auto-Backup**: Alle 5 Minuten in IndexedDB
- **Manuelles Backup**: Jederzeit exportieren
- **Wiederherstellung**: Bei Datenverlust automatisch

### Datenverschlüsselung (Optional)
```javascript
// Verschlüssele sensible Daten
const encrypted = await EnhancedAuth.encryptData({ ...data });
localStorage.setItem('key', JSON.stringify(encrypted));

// Entschlüssele
const decrypted = await EnhancedAuth.decryptData(encrypted);
```

## 🌐 Offline-Nutzung

Die App ist vollständig offline-fähig:

1. **Service Worker** cached alle Ressourcen
2. **IndexedDB** speichert Backups
3. **LocalStorage** speichert Haupt-Daten
4. **API-Cache** behält COT & News für 6+ Stunden

**Offline-Features**:
- ✅ Trades erfassen/bearbeiten
- ✅ Statistiken anzeigen
- ✅ Charts zeichnen
- ✅ Daten exportieren
- ❌ COT/News Updates (benötigt Internet)

## 📊 API-Integrationen

### COT-Daten (Commitment of Traders)
**Quelle**: CFTC (U.S. Commodity Futures Trading Commission)
**Update**: Alle 6 Stunden
**Retry**: 3 Versuche mit exponentieller Backoff
**Fallback**: Gecachte Daten bei Fehler

**Unterstützte Währungen**:
- EUR, GBP, JPY, CHF, CAD, AUD, NZD, USD Index

### Wirtschaftskalender
**Quelle**: Forex Factory (via Proxy)
**Update**: Alle 30 Minuten
**Daten**: High-Impact Events für nächste 7 Tage

## 🚀 Performance-Tipps

### Für viele Trades (>1000)
```javascript
// Aktiviere Virtual Scrolling
const scroller = new PerformanceManager.VirtualScroller(
    document.getElementById('trade-list'),
    {
        itemHeight: 150,
        renderItem: (trade) => `<div>...</div>`
    }
);
scroller.setItems(trades);
```

### Optimierte Berechnungen
```javascript
// Memoize teure Funktionen
const memoizedCalc = PerformanceManager.memoize(expensiveFunction);
```

### Lazy Loading für Bilder
```javascript
// Bilder lazy laden
const lazyLoader = new PerformanceManager.LazyImageLoader();
document.querySelectorAll('img[data-src]').forEach(img => {
    lazyLoader.observe(img);
});
```

## 🐛 Troubleshooting

### Problem: COT-Daten laden nicht
**Lösung**:
1. Prüfe Internetverbindung
2. Öffne Browser Console (F12)
3. Suche nach Fehlermelungen
4. Fallback: Manuelle JSON-Datei importieren aus `cot_import_data.json`

### Problem: Trades verschwunden
**Lösung**:
1. Öffne **Kontoeinstellungen**
2. Klicke auf "Backup-Verwaltung"
3. Wähle letztes Auto-Backup
4. Klicke "Wiederherstellen"

### Problem: Session läuft ständig ab
**Lösung**:
1. Öffne `enhanced_auth.js`
2. Ändere `SESSION_TIMEOUT`:
   ```javascript
   SESSION_TIMEOUT: 60 * 60 * 1000, // 60 Minuten
   ```

### Problem: Performance langsam bei vielen Trades
**Lösung**:
1. Aktiviere Virtual Scrolling (siehe Performance-Tipps)
2. Exportiere alte Trades in Archive
3. Lösche Browser-Cache

## 📱 Mobile Nutzung

Die App ist vollständig responsive:
- ✅ Touch-optimierte UI
- ✅ Mobile Navigation (Hamburger Menu)
- ✅ Swipe-Gesten für Popups
- ✅ PWA-Installation möglich

**Installation als App (Android/iOS)**:
1. Öffne in Chrome/Safari
2. Menü → "Zum Startbildschirm hinzufügen"
3. App öffnet sich wie native App

## 🔧 Entwicklung

### Technologie-Stack
- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 mit CSS Variables
- **Charts**: Chart.js
- **Particles**: tsParticles
- **Icons**: Font Awesome
- **Storage**: LocalStorage + IndexedDB
- **PWA**: Service Worker + Web App Manifest

### Dateistruktur
```
Trading Journal/
├── Core
│   ├── config.js                    # Zentrale Konfiguration
│   ├── data_manager.js              # CRUD Operationen
│   ├── global.js                    # Globale UI-Funktionen
│   └── sidebar.js                   # Navigation
│
├── Security & Auth
│   ├── auth_guard.js                # Auth-Middleware
│   ├── enhanced_auth.js             # PBKDF2 Auth-System
│   ├── login.js                     # Login-Logik
│   └── kontoeinstellungen.js        # Settings
│
├── Data & APIs
│   ├── api_data_service.js          # COT & News APIs
│   ├── backup_manager.js            # IndexedDB Backup
│   └── import_export_manager.js     # CSV/JSON/MT4 Import
│
├── Performance
│   ├── performance_manager.js       # Virtual Scrolling, Lazy Loading
│   └── service-worker.js            # Offline-Caching
│
├── UI/UX
│   ├── ui_feedback.js               # Toast, Loading, Modals
│   └── styles.css                   # Haupt-Styling
│
└── Pages
    ├── startseite.html              # Dashboard/Home
    ├── EK_journal.html              # EK Trades
    ├── funded_journal.html          # Funded Trades
    ├── equity_curve.html            # Performance Chart
    ├── uebersicht.html              # Statistiken
    ├── kalender.html                # Calendar View
    ├── cot_daten.html               # COT Analyse
    ├── waehrungsanalyse.html        # Currency Confluence
    ├── simulation.html              # Monte Carlo
    └── machine_learning.html        # ML Export
```

### Neue Features hinzufügen
1. Erstelle JavaScript-Modul in separater Datei
2. Exportiere als IIFE mit `window.ModuleName`
3. Inkludiere in relevanten HTML-Dateien
4. Dokumentiere in diesem README

## 📈 Roadmap

### v2.1 (Geplant)
- [ ] Multi-User Support mit Cloud-Sync
- [ ] Real-time Broker-Integration (MT4/MT5 API)
- [ ] Advanced ML-Features (Prediction Models)
- [ ] Telegram/Discord Notifications
- [ ] Automatische Trade-Journaling via Screenshot OCR

### v2.2 (Geplant)
- [ ] Backtesting-Modul
- [ ] Strategy Optimizer
- [ ] Social Trading Features
- [ ] Mobile Native Apps (React Native)

## 🤝 Beitragen

Contributions willkommen! Bitte:
1. Fork das Repository
2. Erstelle Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Commit deine Änderungen (`git commit -m 'Add AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne Pull Request

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE) für Details.

## 🙏 Credits

- **Icons**: [Font Awesome](https://fontawesome.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/)
- **Particles**: [tsParticles](https://particles.js.org/)
- **COT Data**: [CFTC](https://www.cftc.gov/)
- **News Data**: [Forex Factory](https://www.forexfactory.com/)

## 📞 Support

Bei Fragen oder Problemen:
1. Prüfe [Troubleshooting](#🐛-troubleshooting)
2. Öffne [GitHub Issue](https://github.com/yourusername/trading-journal/issues)
3. Kontakt: trading@example.com

---

**Made with ❤️ for serious traders**

Version 2.0.0 | © 2026 Trading Journal Professional
