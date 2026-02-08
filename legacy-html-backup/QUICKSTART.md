# 🚀 Quick Start Guide - Trading Journal v2.0

## 1. Erste Schritte (5 Minuten)

### Schritt 1: Öffne die App
1. Öffne `startseite.html` in deinem Browser (Chrome, Firefox oder Edge empfohlen)
2. Du wirst automatisch zu den Kontoeinstellungen weitergeleitet

### Schritt 2: Passwort erstellen
1. Erstelle ein sicheres Passwort (mindestens 6 Zeichen)
2. Bestätige das Passwort
3. Klicke "Speichern"

### Schritt 3: Kontoeinstellungen konfigurieren
**EK-Konto:**
- Start-Balance: z.B. 10.000 USD
- Standard-Risiko: z.B. 0.5%
- Währung: USD/EUR/etc.

**Funded-Konto (optional):**
- Start-Balance: z.B. 100.000 USD
- Profit-Target: z.B. 8% (oder 8R oder 8000 USD)
- Max Drawdown: z.B. 5%
- Standard-Risiko: z.B. 1%

Klicke "Speichern" für beide Konten.

---

## 2. Deinen ersten Trade erfassen (2 Minuten)

### Option A: EK-Konto
1. Klicke in der Sidebar auf **"EK Journal"**
2. Klicke auf **"Trade erfassen"**
3. Fülle das Formular aus:
   ```
   Datum: Heute
   Paar: EURUSD
   Richtung: Long
   Entry: 1.1000
   Exit: 1.1050
   Stop Loss: 1.0950
   R-Multiple: +1.0 (oder wird automatisch berechnet)
   Setup: Daily BOS
   Notes: Mein erster Trade!
   ```
4. Klicke **"Trade speichern"**

✅ **Fertig!** Dein erster Trade ist erfasst.

### Option B: Import von MT4/MT5
1. Exportiere History Report aus MetaTrader (File → Open Data Folder → MQL4/Reports)
2. Gehe zu **"Kontoeinstellungen"** → **"Daten-Management"**
3. Klicke **"MT4/MT5 Import"**
4. Wähle die HTML-Datei aus
5. Fertig! Trades werden automatisch importiert

---

## 3. Statistiken ansehen (1 Minute)

1. Klicke in der Sidebar auf **"Übersicht"**
2. Du siehst:
   - **Win Rate**: Prozent gewonnener Trades
   - **Durchschnitt Win/Loss**: Durchschnittliches R pro Gewinn/Verlust
   - **Expectancy**: Erwartungswert pro Trade
   - **Performance nach Wochentag**: Bester/Schlechtester Tag
   - **Performance nach Setup**: Welches Setup am besten läuft

---

## 4. Equity Curve ansehen (30 Sekunden)

1. Klicke in der Sidebar auf **"Equity Curve"**
2. Toggle zwischen **PnL (€)** und **R-Multiple**
3. Wähle Zeitfilter: **All / 7D / 30D / 90D / YTD / Custom**
4. Klicke auf einen Datenpunkt um Trade-Details zu sehen

---

## 5. COT-Daten nutzen (Optional)

### Automatischer Import (Empfohlen)
1. Gehe zu **"COT Daten"**
2. Warte 10 Sekunden - Daten werden automatisch geladen
3. Falls Fehler: Prüfe Internetverbindung

### Manueller Import (Falls API nicht funktioniert)
1. Öffne `cot_import_data.json` (Beispieldaten enthalten)
2. Gehe zu **"COT Daten"** → Klicke **"JSON importieren"**
3. Wähle die Datei aus
4. Fertig!

### API-Key konfigurieren (Optional, für bessere Qualität)
1. Registriere dich bei [Nasdaq Data Link](https://data.nasdaq.com/)
2. Kopiere deinen API-Key
3. Öffne `api_data_service.js`
4. Trage ein:
   ```javascript
   NASDAQ_API_KEY: 'DEIN_KEY_HIER',
   ```
5. Speichern & Seite neu laden

---

## 6. Backup erstellen (1 Minute)

### Automatisches Backup
- ✅ Läuft bereits! Alle 5 Minuten wird automatisch ein Backup erstellt
- Gespeichert in IndexedDB (Browser-Datenbank)

### Manuelles Backup
1. Gehe zu **"Kontoeinstellungen"**
2. Scrolle zu **"Daten-Management"**
3. Klicke **"JSON Export (Komplettbackup)"**
4. Datei wird heruntergeladen
5. Speichere sie sicher (USB-Stick, Cloud, etc.)

### Backup wiederherstellen
1. Gehe zu **"Kontoeinstellungen"** → **"Backup-Verwaltung"**
2. Wähle ein Backup aus
3. Klicke **"Wiederherstellen"**
4. Bestätige
5. Seite wird neu geladen

---

## 7. Offline-Nutzung aktivieren (30 Sekunden)

Die App ist **automatisch offline-fähig** nach dem ersten Laden!

**Test:**
1. Öffne die App
2. Deaktiviere Internet/WLAN
3. Navigiere durch die Seiten
4. Erfasse einen Trade
5. Alles funktioniert! 📱

**Hinweis:** COT/News-Updates benötigen Internet, aber alle anderen Features funktionieren offline.

---

## 8. Als App installieren (PWA)

### Android (Chrome)
1. Öffne die App im Chrome-Browser
2. Tippe auf **Menü (⋮)** → **"Zum Startbildschirm hinzufügen"**
3. Benenne die App
4. Fertig! App erscheint wie native App

### iOS (Safari)
1. Öffne die App im Safari-Browser
2. Tippe auf **Teilen-Button** → **"Zum Home-Bildschirm"**
3. Benenne die App
4. Fertig!

### Desktop (Chrome/Edge)
1. Öffne die App
2. Klicke auf **⊕-Symbol** in der Adressleiste
3. Klicke **"Installieren"**
4. App öffnet sich in eigenem Fenster

---

## 9. Häufige Fragen

### Wie lösche ich einen Trade?
1. Öffne Trade-Detail-Popup (Klick auf Trade-Karte)
2. Klicke unten auf **"Löschen"**
3. Bestätige

### Wie bearbeite ich einen Trade?
1. Öffne Trade-Detail-Popup
2. Klicke auf **"Bearbeiten"**
3. Ändere Felder
4. Speichern

### Wie ändere ich mein Passwort?
1. **"Kontoeinstellungen"** → **"Passwort ändern"**
2. Altes Passwort eingeben
3. Neues Passwort eingeben
4. Bestätigen & Speichern

### Wie exportiere ich Trades für Excel?
1. **"Kontoeinstellungen"** → **"Daten-Management"**
2. Klicke **"CSV Export (Excel)"**
3. Öffne in Excel/Google Sheets

### Session läuft zu schnell ab?
1. Öffne `enhanced_auth.js` in einem Editor
2. Finde Zeile 13:
   ```javascript
   SESSION_TIMEOUT: 30 * 60 * 1000, // 30 Minuten
   ```
3. Ändere auf gewünschte Zeit:
   ```javascript
   SESSION_TIMEOUT: 60 * 60 * 1000, // 60 Minuten
   ```
4. Speichern

### Wo werden meine Daten gespeichert?
- **LocalStorage**: Haupt-Daten (Trades, COT, News)
- **IndexedDB**: Auto-Backups
- **SessionStorage**: Login-Session
- Alles **lokal** im Browser, keine Cloud!

---

## 10. Tipps & Tricks

### Performance bei vielen Trades
Wenn du 1000+ Trades hast:
1. Öffne Browser Console (F12)
2. Tippe:
   ```javascript
   console.log('Enable virtual scrolling in journal.js')
   ```
3. Kontaktiere Support für Performance-Optimierung

### API-Fehler beheben
1. Öffne Console (F12)
2. Tippe:
   ```javascript
   ApiDataService.updateCotData(true); // Force update
   ```
3. Oder: Manuellen JSON-Import nutzen

### Diagnose bei Problemen
1. Öffne Console (F12)
2. Tippe:
   ```javascript
   diagnose();
   ```
3. Kopiere Output für Support

### Alle Caches löschen
1. Console (F12):
   ```javascript
   clearAllCaches();
   ```
2. App wird neu geladen

---

## 11. Keyboard-Shortcuts

| Shortcut | Aktion |
|----------|--------|
| `Ctrl + N` | Neuer Trade (wenn auf Journal-Seite) |
| `Ctrl + S` | Speichern (in Formularen) |
| `Esc` | Popup schließen |
| `Ctrl + B` | Backup erstellen |
| `Ctrl + E` | Daten exportieren |

---

## 12. Nächste Schritte

Nach dem Setup kannst du:
1. ✅ **Monte Carlo Simulation** nutzen (Simulation-Seite)
2. ✅ **Währungsanalyse** mit COT+Bias+News (Währungsanalyse-Seite)
3. ✅ **Machine Learning Export** für Python/ML-Tools
4. ✅ **Kalender-View** für monatliche Übersicht

---

## 📞 Hilfe benötigt?

1. **Dokumentation**: Siehe [README.md](README.md)
2. **Console-Diagnose**: Tippe `diagnose()` in Browser Console
3. **GitHub Issues**: [Issues öffnen](https://github.com/yourusername/trading-journal/issues)
4. **Support**: trading@example.com

---

**Viel Erfolg mit deinem Trading!** 📈

© 2026 Trading Journal Professional v2.0
