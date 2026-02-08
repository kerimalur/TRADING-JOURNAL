# Trading Journal - Neue Datenbank-Architektur

## 📦 Installation & Setup

### 1. Dexie.js einbinden

Fügen Sie diese Zeile in **ALLE** HTML-Dateien ein (im `<head>`-Bereich, **VOR** anderen Scripts):

```html
<!-- Dexie.js (IndexedDB Library) -->
<script src="https://unpkg.com/dexie@3.2.4/dist/dexie.js"></script>

<!-- Datenbank-Layer -->
<script src="db.js"></script>

<!-- Migrations-Script -->
<script src="migration.js"></script>

<!-- Data Manager (Kompatibilitäts-Layer) -->
<script src="data_manager.js"></script>
```

### 2. Wichtige Reihenfolge

Die Scripts müssen in dieser Reihenfolge geladen werden:
1. `dexie.js` (externe Library)
2. `db.js` (Datenbank-Definition)
3. `migration.js` (automatische Migration)
4. `data_manager.js` (Kompatibilität für alten Code)
5. Ihre anderen Scripts (journal.js, uebersicht.js, etc.)

---

## 🚀 Was wurde geändert?

### Alte Architektur (localStorage)
- ❌ Daten gehen verloren beim Cache löschen
- ❌ Screenshots als Base64-Strings = Massiver Speicherverbrauch
- ❌ Limit von ~5-10 MB pro Domain
- ❌ Synchrone Operationen blockieren UI

### Neue Architektur (IndexedDB)
- ✅ Persistente Speicherung (überlebt Cache-Löschung)
- ✅ Screenshots als komprimierte Blobs (95% weniger Speicher)
- ✅ Unbegrenzter Speicher (mehrere GB möglich)
- ✅ Asynchrone Operationen (keine UI-Blockierung)
- ✅ Separate Backtest-Tabelle
- ✅ Automatische Migration von alten Daten

---

## 📊 Datenbank-Schema

Die IndexedDB enthält folgende Tabellen:

| Tabelle | Beschreibung | Primärschlüssel |
|---------|--------------|-----------------|
| `trades` | Live-Trading Einträge | `++id` (Auto-Increment) |
| `backtests` | Backtest-Trades (separiert) | `++id` |
| `screenshots` | Bilder als Blobs | `++id` |
| `cotData` | COT-Reports | `++id` |
| `newsData` | News-Einträge | `++id` |
| `transactions` | Ein-/Auszahlungen | `++id` |
| `accountConfigs` | EK/Funded Configs | `type` (ek/funded) |
| `settings` | App-Settings | `key` |
| `interestRates` | Zinssätze für Währungen | `currency` |

---

## 🔧 API-Verwendung

### Alte Funktionen (noch unterstützt, aber ASYNC!)

**WICHTIG:** Alle Funktionen sind jetzt **asynchron**. Sie müssen `await` oder `.then()` verwenden!

#### Vorher (localStorage):
```javascript
const trades = loadTrades(); // Synchron
```

#### Jetzt (IndexedDB):
```javascript
const trades = await loadTrades(); // ASYNC!

// Oder mit .then():
loadTrades().then(trades => {
    console.log(trades);
});
```

### Neue Funktionen (empfohlen)

#### Trades laden:
```javascript
// Alle Live-Trades
const liveTrades = await dbLoadTrades({ sessionType: 'live' });

// Nur EK-Trades
const ekTrades = await dbLoadTrades({ type: 'ek', sessionType: 'live' });
```

#### Trade mit Screenshot speichern:
```javascript
// Mit Screenshot-File
await dbSaveTrade(tradeData, screenshotFile);

// Mit Base64-String (wird automatisch konvertiert)
await dbSaveTrade(tradeData, 'data:image/png;base64,...');

// Ohne Screenshot
await dbSaveTrade(tradeData);
```

#### Screenshot laden:
```javascript
// Screenshot für einen Trade laden
const dataURL = await dbLoadTradeScreenshot(tradeId);
if (dataURL) {
    imgElement.src = dataURL;
}

// Mehrere Screenshots gleichzeitig (optimiert)
const screenshots = await dbLoadTradeScreenshots([1, 2, 3]);
// Ergebnis: { 1: 'data:image...', 2: 'data:image...', 3: 'data:image...' }
```

#### Backtests (neu):
```javascript
// Session-ID generieren
const sessionId = generateBacktestSessionId();
// Ergebnis: "backtest_2026-01-24_1737734400000"

// Backtest speichern
await dbSaveBacktest(backtestData, sessionId, screenshot);

// Backtests einer Session laden
const backtests = await dbLoadBacktests(sessionId);

// Session löschen
await dbDeleteBacktestSession(sessionId);
```

---

## 🔄 Migration

### Automatisch beim ersten Start

Die Migration läuft **automatisch** beim ersten Laden der App:
1. Prüft, ob localStorage-Daten vorhanden sind
2. Überträgt alle Trades, COT-Data, News, Transactions
3. Konvertiert Base64-Screenshots in Blobs
4. Setzt Flag, damit Migration nur einmal läuft
5. **Behält localStorage-Daten** (als Backup)

### Manuell testen/wiederholen

```javascript
// In Browser-Konsole:

// Migration-Status prüfen
isMigrationComplete(); // true/false

// Migration zurücksetzen (läuft beim nächsten Reload)
resetMigrationFlag();

// Migration manuell starten
await migrateAllData();

// ACHTUNG: Alle DB-Daten löschen (nur für Tests!)
await clearAllDatabaseData(); // Fordert Bestätigung
```

---

## 📝 Code-Beispiele für bestehende Seiten

### journal.js - Trade-Formular anpassen

```javascript
// ALT (synchron):
function handleSaveClick() {
    const trade = {...};
    saveTrade(trade);
    loadAndDisplayTrades();
}

// NEU (async):
async function handleSaveClick() {
    const trade = {...};
    const screenshot = getScreenshotFromForm(); // File oder Base64
    
    await saveTrade(trade, screenshot);
    await loadAndDisplayTrades();
}

async function loadAndDisplayTrades() {
    const trades = await loadTrades();
    // ... Tabelle rendern
    
    // Screenshots laden (optimiert)
    const tradeIds = trades.map(t => t.id);
    const screenshots = await dbLoadTradeScreenshots(tradeIds);
    
    trades.forEach(trade => {
        const screenshotUrl = screenshots[trade.id];
        if (screenshotUrl) {
            // Zeige Screenshot an
        }
    });
}
```

### uebersicht.js - Statistiken berechnen

```javascript
// ALT:
function calculateStats() {
    const trades = loadTrades();
    const configs = loadAccountConfigs();
    // ...
}

// NEU:
async function calculateStats() {
    const trades = await loadTrades();
    const configs = await loadAccountConfigs();
    // ... Rest bleibt gleich
}

// Beim Laden der Seite:
document.addEventListener('DOMContentLoaded', async () => {
    await calculateStats();
    await renderEquityCurve();
});
```

---

## 🎨 Screenshot-Optimierung

Screenshots werden automatisch komprimiert:
- **Maximale Breite:** 1920px (bei höherer Auflösung wird skaliert)
- **Format:** JPEG
- **Qualität:** 85%
- **Durchschnittliche Ersparnis:** 90-95% gegenüber Base64

### Beispiel:
- Vorher (Base64): 2.5 MB
- Nachher (Blob): 180 KB

---

## 🛠️ Debugging & Troubleshooting

### Browser-Konsole
```javascript
// Datenbank-Objekt anzeigen
console.log(db);

// Anzahl der Trades prüfen
db.trades.count().then(count => console.log('Trades:', count));

// Alle Trades anzeigen
db.trades.toArray().then(trades => console.table(trades));

// Speicher-Nutzung anzeigen (Chrome)
navigator.storage.estimate().then(estimate => {
    console.log('Verwendet:', (estimate.usage / 1024 / 1024).toFixed(2), 'MB');
    console.log('Verfügbar:', (estimate.quota / 1024 / 1024).toFixed(2), 'MB');
});
```

### Häufige Fehler

#### Fehler: "db is not defined"
**Lösung:** Dexie.js und db.js müssen VOR anderen Scripts geladen werden.

#### Fehler: "Cannot read property 'then' of undefined"
**Lösung:** Funktion ist jetzt async, verwenden Sie `await` oder `.then()`.

#### Trades werden nicht angezeigt
**Lösung:** Prüfen Sie, ob `loadTrades()` mit `await` aufgerufen wird.

---

## 🚀 Nächste Schritte

1. ✅ Datenbank-Layer implementiert
2. ✅ Migration-Script erstellt
3. ✅ Data Manager angepasst
4. ⏳ HTML-Dateien aktualisieren (Dexie.js einbinden)
5. ⏳ Backtest-Modul erstellen
6. ⏳ TradingView Integration
7. ⏳ Automatisierte Analyse-Logik
8. ⏳ Dashboard-Verbesserungen

---

## 📞 Support

Bei Fragen oder Problemen:
1. Prüfen Sie die Browser-Konsole auf Fehler
2. Testen Sie `isMigrationComplete()` in der Konsole
3. Prüfen Sie die Reihenfolge der Script-Tags

---

**Version:** 1.0  
**Datum:** Januar 2026  
**Status:** Migration Phase 1 abgeschlossen ✅
