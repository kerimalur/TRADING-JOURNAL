# Backtest-Modul Rework + Light-Theme — Design

Datum: 2026-06-28
Status: umgesetzt

## Ziel

Zwei zusammenhängende Arbeiten:
1. **Design-Umbau** auf das helle „TradeSync"-System (Inter, blaue Akzentfarbe
   #2563EB, weiche Schatten, weiße Karten auf #F1F5F9). Nur Optik, keine Logik.
2. **Backtest-Modul** funktional erweitern — Fokus-Raum, Datum-Persistenz,
   Probleme/Notizen-Trennung mit Wiederverwendung, Equity-Zeiträume, Filter.

## Backtest — Drei Ansichten

Aus der monolithischen `Backtest.tsx` (1120 Z.) wird ein Orchestrator + Module:

- `types.ts` — `BacktestTrade`, `BacktestSession` (neu: `startDate?`), `BacktestStats`,
  Utils (`newId`, `isUuid`, `downscaleImage`).
- `backtestStats.ts` — reine Helfer: `computeStats`, `buildEquityByDate` (Zeitraum),
  `computeSetupStats`, `computeProblemStats`, `filterTrades`.
- `useBacktestSessions.ts` — Session-State, Hybrid-Load (Supabase ⇄ localStorage),
  CRUD, Persistenz.
- Views: `BacktestLanding`, `BacktestRoom`, `BacktestAnalysis`, `BacktestWizard`.
- `Backtest.tsx` — View-Orchestrator (`landing | room | analysis`).

### 1. Übersicht (Landing)
Neue Session (Wizard) oder Liste bestehender Sessions mit Aktionen
**Weiter testen** (Raum) / **Auswerten** (Analyse) / Löschen.

### 2. Fokus-Raum (Vollbild)
`fixed inset-0 z-[110]` deckt Sidebar + Header zu → „verschlossener Raum".
Nur Speed-Eingabe (L/S · W/X/B · 1–9=R · +/− · Enter · Strg+V) + Mini-Stats.
Topbar: Timer, `Eintrag #n`, Pause, **Beenden** (abschließen), **Speichern &
Schließen**. Beide Wege → zurück zur Übersicht. Timer wird beim Schließen
eingefroren, beim „Weiter testen" fortgesetzt.

**Datum-Persistenz:** Form-Datum = letztes Trade-Datum → sonst `session.startDate`
→ sonst heute. Bleibt nach jedem Trade stehen, springt nie auf heute. Wizard
fragt optionales Startdatum (für Backtests Jahre in der Vergangenheit).

### 3. Auswertung (Analyse)
- **Filterleiste:** Setups (mehrfach) + Probleme (mehrfach) + Stichwort
  (Notizen & Probleme). Filter wirkt auf Tabelle **und** auf alle Kennzahlen.
- **Stat-Cards** auf gefilterter Teilmenge.
- **Equity-Kurve** mit Zeitraum-Umschalter (Alles/1J/6M/3M/1M/1W), X-Achse nach
  Datum, ein Punkt/Tag, Zeitraum rückwärts vom letzten Trade-Datum gemessen.
- **Setup-Performance** + **Problem-Performance** (Leaks, schlechteste zuerst):
  je n, Winrate, Expectancy, ΣR, Stichproben-Warnung < 20.
- **Trade-Tabelle** (gefiltert) inkl. Notiz-Zeilen, Screenshot, Löschen, CSV/JSON.

## Probleme vs. Notizen

- **Probleme & Fehler** = gemeinsamer Tag-Block, wiederverwendbar
  (`getProblems`/`saveProblems` + Pref `problems`).
- **Notizen** = separater Freitext + **wiederverwendbare Bausteine**
  (`getNoteSnippets`/`saveNoteSnippets` + Pref `noteSnippets`): Chips zum
  Einfügen, `★ als Baustein speichern`.

## Daten/Schema

Nur additive optionale Felder → abwärtskompatibel: `BacktestSession.startDate?`,
neue Pref `noteSnippets: string[]`. Kein Bruch an localStorage/Supabase.

## Nicht im Scope

Kein Wechsel der Icon-/Chart-Library (lucide + recharts bleiben, nur Stil
angeglichen). Keine Änderung am Live-Journal. Backtest-Trades bleiben separat.
