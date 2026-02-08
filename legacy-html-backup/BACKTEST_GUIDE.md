# 🚀 High-Speed Backtesting Module

## Übersicht

Das Backtest-Modul ist eine dedizierte Umgebung für schnelle Strategie-Validierung, vollständig getrennt vom Live-Journal.

### ✨ Key Features

- **⚡ Speed-Entry**: Optimiertes Formular für Geschwindigkeit
- **⌨️ Tastaturkürzel**: L (Long), S (Short), Enter (Speichern)
- **📊 Live-Auswertung**: Echtzeit-Winrate und Equity-Kurve
- **📷 Screenshot-Paste**: Strg+V zum direkten Einfügen
- **🎯 Session-basiert**: Jede Session ist isoliert
- **🔒 Separation**: Keine Beeinflussung der Live-Performance

---

## 🎮 Verwendung

### 1. Neue Backtest-Session starten

1. Öffne `backtest.html`
2. Eine neue Session wird automatisch gestartet
3. Session-Name und Timer werden oben angezeigt

### 2. Trades erfassen (Speed-Entry)

#### Methode 1: Mit Maus
1. Klicke auf **LONG** oder **SHORT**
2. Fülle die Pflichtfelder aus:
   - Währungspaar
   - Datum
   - R-Multiple
3. Optional: Setup, Timeframe, Notizen
4. Optional: Screenshot einfügen (Strg+V)
5. Klicke auf **Trade hinzufügen**

#### Methode 2: Mit Tastatur (Schnellste!)
```
L          → Aktiviert LONG
S          → Aktiviert SHORT
Tab        → Zwischen Feldern wechseln
Strg+V     → Screenshot einfügen
Enter      → Trade speichern
```

#### Typischer Workflow (< 10 Sekunden pro Trade):
```
1. L (Long auswählen)
2. Tab → EURUSD eingeben
3. Tab → Datum (bereits gesetzt)
4. Tab → 2.5 (R-Multiple)
5. Tab → FVG (Setup)
6. Strg+V (Screenshot aus TradingView)
7. Enter (Speichern)
→ Fertig! Formular ist reset, Fokus auf Pair-Feld
```

---

## 📊 Live-Statistiken

Die rechte Sidebar zeigt **Echtzeit-Feedback**:

### Winrate-Display
- **Große Zahl**: Aktuelle Winrate in %
- **Wins/Losses**: Anzahl gewonnener/verlorener Trades
- Aktualisiert sich nach jedem Trade

### Performance-Metriken
- **Total R**: Gesamtes R-Multiple der Session
- **Avg R**: Durchschnittliches R pro Trade
- **Best R**: Bester Trade
- **Worst R**: Schlechtester Trade

### Equity Curve
- Zeigt kumulative Performance
- Grün bei positivem R, Rot bei negativem R
- Aktualisiert sich automatisch

### Letzte Trades
- Liste der letzten 10 Trades
- Farbcodiert (Grün = Win, Rot = Loss)
- Schneller Überblick über Pattern

---

## 🎯 Session-Management

### Neue Session starten
```
Button: "Neue Session" → Speichert aktuelle, startet neue
```

### Session pausieren
```
Button: "Pause" → Stoppt Timer, blockiert Eingaben
Button: "Fortsetzen" → Resumed
```

### Session speichern
```
Button: "Session speichern" → Speichert und startet neue
```

### Session-Historie
```
Button: "Verlauf" → Zeigt alle gespeicherten Sessions
→ Klicke "Laden" um Session zu öffnen
→ Klicke "Löschen" um Session zu entfernen
```

---

## 📷 Screenshot-Integration

### Methode 1: Paste (Empfohlen)
1. Screenshot in TradingView erstellen (z.B. Windows-Tool)
2. In Backtest-Modul wechseln
3. **Strg+V** drücken
4. Screenshot erscheint sofort im Formular

### Methode 2: Upload
1. Klicke auf Paste-Zone
2. Wähle Bild-Datei aus

### Screenshot entfernen
- Klicke auf **X**-Button im Preview

---

## 🗄️ Datenbank-Struktur

### Separation von Live-Trades

Backtest-Trades werden in einer **separaten Tabelle** gespeichert:

```javascript
// Live-Trades
db.trades (sessionType: 'live')

// Backtest-Trades
db.backtests (sessionId: 'backtest_2026-01-24_...')
```

### Vorteile:
✅ **Keine Vermischung**: Live-Stats bleiben unberührt  
✅ **Session-Tracking**: Jede Session hat eindeutige ID  
✅ **Schnelles Laden**: Nur relevante Daten  
✅ **Einfaches Löschen**: Session-basiertes Cleanup  

---

## 🔍 Technische Details

### Session-ID Format
```
backtest_YYYY-MM-DD_TIMESTAMP
Beispiel: backtest_2026-01-24_1737734400000
```

### Daten-Schema (Backtest-Trade)
```javascript
{
    id: 123,                    // Auto-Increment
    sessionId: 'backtest_...',  // Session-Zuordnung
    pair: 'EURUSD',
    date: '2026-01-24',
    direction: 'long',
    rMultiple: 2.5,
    setup: 'FVG',
    timeframe: 'H4',
    riskPercent: 1.0,
    notes: 'Optional',
    createdAt: '2026-01-24T10:30:00.000Z'
}
```

### Screenshot-Handling
- Screenshots werden als **Blobs** in separater Tabelle gespeichert
- Automatische Kompression (JPEG, 85% Qualität, max 1920px)
- Verknüpfung über `backtestId`

---

## ⚡ Performance-Tipps

### Schnellste Eingabe-Methode:

1. **Nur Pflichtfelder verwenden**:
   - Pair, Date, R-Multiple
   - Setup und Notes weglassen wenn nicht wichtig

2. **Tastatur-Only Workflow**:
   ```
   L → Tab → Pair → Tab → Tab → R → Enter
   (Datum wird automatisch beibehalten)
   ```

3. **Gleiche Setups gruppieren**:
   - Erst alle FVG-Trades
   - Dann alle BOS-Trades
   - Setup-Feld wird nicht zurückgesetzt

4. **Screenshots optional**:
   - Nur bei wichtigen Trades
   - Paste ist schneller als Upload

---

## 🎨 Visuelle Hinweise

### Farbcodierung

| Element | Farbe | Bedeutung |
|---------|-------|-----------|
| **Winrate-Box** | Grün Border | Session läuft |
| **Trade-Item** | Grüner Rand | Win (+R) |
| **Trade-Item** | Roter Rand | Loss (-R) |
| **Equity Curve** | Grün | Positive Session |
| **Equity Curve** | Rot | Negative Session |
| **Total R** | Grün | Profit |
| **Total R** | Rot | Loss |

### Animationen
- **Pulse-Effekt**: Nach jedem gespeicherten Trade
- **Live-Update**: Statistiken ändern sich sofort
- **Smooth-Scroll**: Recent Trades Liste

---

## 🐛 Troubleshooting

### "Bitte Richtung auswählen"
**Lösung**: Klicke auf LONG oder SHORT (oder drücke L/S)

### Screenshots werden nicht eingefügt
**Lösung**: 
1. Stelle sicher, dass ein Bild in der Zwischenablage ist
2. Klicke ins Browser-Fenster
3. Drücke Strg+V

### Trades erscheinen nicht in Live-Journal
**Antwort**: Das ist korrekt! Backtest-Trades sind **komplett separiert**.

### Session-Timer läuft nicht
**Lösung**: Klicke auf "Fortsetzen" (Session ist pausiert)

---

## 📈 Best Practices

### 1. Strukturierte Sessions
```
Session-Name: "FVG Strategie - Januar 2026"
Fokus: Nur ein Setup pro Session testen
Ziel: Mindestens 20-30 Trades für Aussagekraft
```

### 2. Notizen nutzen
```
Gut: "Asia High Break, London Bestätigung"
Gut: "News um 14:30, volatiler Exit"
Schlecht: "Trade 1", "ok"
```

### 3. Regelmäßig speichern
```
Nach jeder Session → "Session speichern" klicken
Verhindert Datenverlust bei Browser-Crash
```

### 4. Sessions vergleichen
```
Historie öffnen → Sessions nebeneinander vergleichen
Welches Setup hat bessere Winrate?
Welche Timeframe funktioniert besser?
```

---

## 🔮 Geplante Features (zukünftig)

- [ ] Export von Sessions als CSV/PDF
- [ ] Session-Vergleichs-Dashboard
- [ ] Pattern-Erkennung über Sessions
- [ ] Heatmap: Beste Tageszeiten/Pairs
- [ ] Import von MT4/MT5 Historie

---

## 🎯 Workflow-Beispiel

### Szenario: 50 Trades aus historischen Charts backtesten

1. **Vorbereitung** (1 Minute)
   - Öffne `backtest.html`
   - Öffne TradingView mit historischen Charts
   - Bereite Screenshot-Tool vor

2. **Execution** (10-15 Sekunden pro Trade)
   ```
   Pro Trade:
   - Chart analysieren
   - Screenshot erstellen (Windows+Shift+S)
   - Zurück zu Backtest
   - L/S drücken
   - Tab → Pair
   - Tab → Tab → R-Multiple eingeben
   - Strg+V (Screenshot)
   - Enter
   → Repeat
   ```

3. **Gesamt-Zeit**: ~10-15 Minuten für 50 Trades

4. **Auswertung** (Live während Eingabe!)
   - Winrate steigt/fällt in Echtzeit
   - Equity-Curve zeigt Trend
   - Pattern werden sofort sichtbar

5. **Speichern**
   - "Session speichern" klicken
   - Fertig!

---

**Viel Erfolg beim Backtesting! 🚀**
