# Smart COT Eval-Transparenz + Backtest Problem-Tags — Design

Datum: 2026-06-26
Status: approved

## Ziel

Zwei unabhängige Aufgaben im Trading Journal (`desktop-app`):

1. Smart COT Eval-Tab nachvollziehbar machen — pro Treffer/Verfehler die
   zugrundeliegenden COT-Werte/Schwellen zeigen.
2. Backtest-Datensammlung um wiederverwendbare "Problem"-Tags + CSV-Export
   erweitern.

Übergeordnet: saubere Datenbasis zur Festigung der eigenen Strategie. Kein
Scope-Creep über das hier Beschriebene hinaus.

---

## Aufgabe 1: Smart COT — Eval-Transparenz (fokussiert)

Tab-Struktur (`weekly`/`overview`/`eval`/`ml`) bleibt. Schwerpunkt: Eval-Tab.

### Service: `src/services/cotEval.ts` — additiv, KEINE Logik-Änderung

`EvalWeek` um read-only Felder erweitern, die in `runEval` bereits intern
existieren (`top`/`bottom`):

```ts
topPercentile: number;       // COT-Positionierung top-Seite
bottomPercentile: number;    // COT-Positionierung bottom-Seite
topMomentum4w: number;       // 4W Commercial-Net Momentum top
bottomMomentum4w: number;    // 4W Commercial-Net Momentum bottom
```

Werte werden nur in das gepushte `EvalWeek`-Objekt durchgereicht. Scoring-,
Hit- und Bucket-Logik bleiben unverändert. Schwellen (≥60 long / ≤40 short,
≥90/≤10 ausgereizt) sind Konstanten → als statische Legende angezeigt, nicht
neu berechnet.

### UI: `src/pages/COTData.tsx` — "Letzte Wochen"-Block (~L1379)

Jede Wochen-Zeile zeigt zusätzlich pro Seite die COT-Begründung, z.B.:
`EUR 92.Perz · Mom +1.2k → COT long` vs `JPY 6.Perz · Mom −0.8k → COT short`,
plus vorhandene Flags (Treiber einig / ausgereizt). So zeigt ✓/✗ jetzt das
WARUM hinter der Prognose. Kleinere Layout-/Lesbarkeitspolitur erlaubt, kein
Tab-Umbau.

**Nicht in Scope:** Berechnungslogik in Services, ML-Pipeline, Datenquellen.

---

## Aufgabe 2: Backtest Problem-Tags + CSV

Problem-Tags spiegeln das **Confluences**-Muster (user-verwaltbare Liste via
localStorage + Settings-UI), nicht das hartcodierte `SETUP_DEFINITIONS`.

### `src/types/index.ts`

```ts
export const DEFAULT_PROBLEMS = [ /* kleine Seed-Liste */ ] as const;
// localStorage-Key: tradingJournal_problems
export function getProblems(): string[]
export function saveProblems(list: string[]): void
```
Analog zu `getConfluences`/`saveConfluences`.

### `src/pages/Backtest.tsx`

- `BacktestTrade` erhält `problems: string[]`.
- `formData` erhält `problems: []`, Reset beim Submit (wie `setups`).
- Speed-Entry: Problem-Chips (Mehrfachauswahl, Toggle wie Setups) + kleines
  Inline-Feld "+ neu" → fügt sofort zur gespeicherten Liste hinzu,
  wiederverwendbar für künftige Trades.
- Trade-Tabelle: Felder klar vergleichbar — Pair, Richtung, Ergebnis,
  R-Multiple, Datum, Setups, **Problem** (neu, als Tags), Notizen.
- `exportSessionCSV()` neben bestehendem JSON-Export: alle Felder inkl.
  Problem-Tags (Join `;`), korrektes CSV-Escaping, keine neue Dependency.

### `src/pages/Settings.tsx`

Neue Sektion "Probleme" als Kopie der Confluences-Sektion (Add/Edit/Delete,
gleiches Handler-Muster), direkt unter Confluences.

**Nicht in Scope:** Speed-Eingabe-Logik, Tastenkürzel, Equity-Curve,
Session-Persistenz (außer neuem `problems`-Feld).

---

## Allgemein

Code-Stil beibehalten (Tailwind, `clsx`, lucide-react). Keine neuen
Dependencies. Nach Umsetzung kurz zusammenfassen, welche Dateien geändert
wurden und wie "Problem" in den Einstellungen verwaltet wird.
