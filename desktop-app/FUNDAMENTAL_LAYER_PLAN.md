# Plan: Fundamental-Layer für Smart COT (Ausführung morgen)

Ziel: Alle fehlenden fundamentalen Treiber in den **Wochen-Ausblick** einbauen, damit man Sonntag draufschaut und sieht: welche Währung stark/schwach (Woche + 4–8 Wochen), warum, mit welcher Konfidenz. Echtes Geld → Daten datiert, verifizierbar, ehrlich gelabelt.

## Was schon drin ist (nicht anfassen)
- COT-Positionierung + Perzentil + Spec-Crowding (#23–25)
- Zins-Carry Level + Richtung via `change` (#1 teilweise)
- Risk-Off-Wächter JPY/CHF (#4 Proxy)
- Saisonalität klein gewichtet (#37)
- Stärke-Board, Event-Kalender, Konfidenz, Caution-Flags
- Education-Panel (Daten-Impact + Sonntags-Routine) in Lightbulb

## Was gebaut wird (Reihenfolge nach Hebel ÷ Aufwand)

### 1. Pair-Signale-Tab in Wochen-Ausblick zusammenlegen (Quick)
- Tab "Pair Signale" entfernen. Tabs danach: **Wochen-Ausblick · Währungen · Experimentell**.
- Datei: `src/pages/COTData.tsx` (Tab-Nav + `activeTab`-Typ + 'pairs'-Block raus).

### 2. #3 Wachstums-Überraschung — LIVE aus Kalender (größter Hebel, gratis)
- Neue Datei: `src/services/fundamentalDrivers.ts` → `growthSurprise(events)`.
- Logik: Events mit forecast + actual (faireconomy thisweek hat zurückliegende Tage mit actual).
  - Parsen: floats aus "3.2%", "250K", "-1.1" (Suffixe K/M/B/% strippen).
  - Richtung: höher = positiv bei GDP/PMI/CPI/Retail/Employment/NFP/Wages/Confidence;
    höher = NEGATIV bei Unemployment Rate / Jobless Claims.
  - Score pro Währung = Σ sign(actual−forecast) × impactGewicht (high=2, med=1), normalisiert.
- Ehrlich: deckt nur „diese Woche bisher" ab (kein Archiv) → als „Daten-Momentum diese Woche" labeln.
- Integration: als Treiber im Outlook + Tag im Stärke-Board (`Daten+`/`Daten−`) + leichte Conviction-Anpassung (±4..6).

### 3. #2 Real-2Y-Zins + #1 Zins-Bias schärfen — datierter Datensatz
- In `fundamentalDrivers.ts`: `FUNDAMENTALS_ASOF = '2026-06-20'` + Tabelle pro Währung:
  `{ policyRate, trajectory: 'hiking'|'cutting'|'hold', yield2Y, cpi }`.
  - realYield = yield2Y − cpi. realYieldDelta = ccy.realYield − G10-Schnitt.
  - Startwerte konsistent zu vorhandenen Leitzinsen (USD 4.50, EUR 2.25, GBP 4.25, JPY 0.50, CHF 0.25, CAD 2.75, AUD 4.10, NZD 3.50). 2Y/CPI als plausible Startwerte — **vom User zu verifizieren**.
- Integration: realYieldDelta als stärkster Carry-Treiber (ersetzt/ergänzt Leitzins-Carry), trajectory verschärft hawkish/dovish.
- UI: „Fundamentaldaten Stand 2026-06-20 (manuell — bitte prüfen)" + editierbar machen (analog Manual-COT-Input) als Stretch.

### 4. #6 Rohstoff-Tilt — datierter Trend + Mapping
- In `fundamentalDrivers.ts`: `commodities = { oil, metals, gold: 'up'|'down'|'flat' }` (datiert, manuell).
- Mapping: Öl↑ → CAD+, NOK+ (n/a), JPY−, EUR−; Metalle/Eisenerz↑ → AUD+; Gold↑ → AUD+, USD−.
- Integration: nur für betroffene Währungen als Treiber + kleine Conviction-Anpassung. Default 'flat' (kein Fake-Signal bis gesetzt).

### 5. Fundamental-Breakdown pro Währung (UI)
- Im „Währungen"-Detail neuer Block „Fundamentale Treiber": Real-2Y-Delta, Zins-Trajektorie, Daten-Überraschung, Rohstoff-Tilt — je mit Klartext-Satz + Wert.
- Stärke-Board-Tags erweitern: `Real+/−`, `Daten+/−`, `Öl+` etc.
- Stand-Datum sichtbar.

## Scoring-Integration (zentral)
- Neue Funktion `fundamentalOverlay(ccy, events)` in `fundamentalDrivers.ts` → liefert `{ score: -100..100, factors: {label,text,tone,value}[] }`.
- In `weeklyOutlook.buildWeeklyOutlook`: Overlay in Konfidenz + Treiber einweben (klar gelabelt, COT bleibt Basis).
- COT-Engine (`smartCotService`) NICHT umbauen — Fundamental ist ein Overlay obendrauf.

## Ehrlichkeits-Regeln (Pflicht)
- Jeder manuelle Wert: Stand-Datum + „bitte verifizieren".
- Überraschung: „nur laufende Woche".
- Keine erfundene Live-Präzision. Konfidenz bleibt Confluence, keine Trefferquote.

## Verifikation
- `npm run build` (tsc + vite) muss grün sein.
- Nach Deploy: Refresh → Stärke-Board zeigt Fundamental-Tags, Detail zeigt Breakdown, kein Konsolen-Fehler.

## Offen / später
- Echte Live-Feeds für 2Y/Inflation/Rohstoffe (Serverless-Proxy wie /api/calendar) als Upgrade.
- Separates Python-Walk-Forward-Script (eigenes Todo, Erinnerung 2026-06-20).
