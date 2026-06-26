# Plan — "COT-Problem" lösen: Smart COT → Fundamentaler Kompass

Datum: 2026-06-26
Status: Vorschlag (zur Reaktion, noch nicht freigegeben)

## Das eigentliche Problem (Diagnose)

Die Seite heißt "Smart COT" und ist um COT herum gebaut — aber sie ist längst
etwas anderes geworden: ein **fundamentales Unterstützungs-Tool**, in dem COT nur
*einer von mehreren* Treibern ist:

- COT-Positionierung (Commercial-Net-Perzentil + Momentum)
- Zins-Carry (rateDifferential)
- Wachstums-Überraschung (fundamentalDrivers / surprise)
- Event-Risiko der Woche (Wirtschaftskalender)
- Risk-Regime (JPY/CHF-Haven-Stärke)

Daraus folgen drei konkrete Probleme:

1. **Framing falsch.** Name + Aufbau suggerieren "COT-Tool". Tatsächlich ist COT
   nur eine Zutat. Das verwirrt beim Lesen ("wo ist das eigentliche Signal?").
2. **Unübersichtlich.** 4 gleichrangige Tabs (Wochen-Ausblick / Währungen /
   Trefferquote / Experimentell) mit **Überschneidungen** — die Stärke-Leiter
   erscheint z.B. in zwei Tabs. Unklar, was *die Antwort* ist und was nur Beleg.
3. **COT nicht als Treiber sichtbar.** Man sieht das Ergebnis (finalConviction),
   aber nicht sauber, *wie viel* COT vs. Carry vs. Wachstum dazu beigetragen hat.

Wichtig: Die **Rechen-Logik ist nicht das Problem** und bleibt unangetastet
(smartCotService, cotEval, fundamentalDrivers, weeklyOutlook). Reine Neuordnung
der Darstellung/Informationsarchitektur.

## Leitidee

Die Seite um ihre **eine Aufgabe** herum bauen:
> "Wer ist fundamental stark, wer schwach — und wie sicher darf ich mir sein?"

COT wird von der Überschrift zu **einem beschrifteten Treiber unter mehreren**
degradiert. Das löst Framing *und* Übersicht gleichzeitig.

## Restruktur: 4 Tabs → 3 Ebenen nach Entscheidungs-Nähe

Statt 4 gleichrangiger, überlappender Tabs → Gliederung danach, wie nah am
Trade die Info ist:

### Ebene 1 — Die Antwort (immer sichtbar)
- **Stärke-Leiter** (stark → schwach, finalConviction) + **Top Pair-Ideen**
  (stark gegen schwach).
- Ein Screen. Das ist, worauf man handelt.
- Ersetzt die Duplikate aus "Wochen-Ausblick" + "Währungen".

### Ebene 2 — Das Warum (pro Währung/Pair aufklappbar)
- Einheitliches **Treiber-Panel** je Währung: feste Zeilen
  `COT · Carry · Wachstum · Momentum · Events`, jede mit Wert + Richtung +
  Beitrag zur Gesamt-Einschätzung.
- **Hier lebt COT** — als eine Zeile von fünf. Volle Transparenz, warum eine
  Währung stark/schwach ist.

### Ebene 3 — Das Vertrauen (eigener, ruhiger Bereich)
- **Trefferquote/Eval** + **Experimentell (ML)** zusammen, klar als
  *Validierung/Ehrlichkeit* markiert — nicht für die tägliche Entscheidung.
- Bewusst de-betont (kein gleichrangiger Tab mehr).

## Umsetzung in Phasen (jede einzeln shippbar, nur Darstellung)

**Phase 0 — Reframe (klein, große Wirkung)**
- Rename "Smart COT" → z.B. "Fundamentaler Kompass" / "Fundamental Bias".
- Eine Zweck-Zeile oben: "Wer ist fundamental stark/schwach — und wie sicher."
- COT-Begriffe wo nötig zu "Positionierung (COT)" umlabeln.

**Phase 1 — Ebene 1 zusammenführen**
- Wochen-Ausblick + Währungen verschmelzen zu einer "Bias"-Ansicht.
- Duplizierte Stärke-Leiter entfernen (nur noch einmal).

**Phase 2 — Treiber-Panel**
- Pro Währung das einheitliche 5-Zeilen-Panel (COT als ein Treiber, mit
  sichtbarem Beitrag). Nutzt vorhandene Felder (currentPercentile, momentumSignal,
  rateDifferential, surprise, events).

**Phase 3 — Ebene 3 abtrennen**
- Eval + ML in einen eigenen "Vertrauen/Validierung"-Bereich, optisch ruhiger.

**Phase 4 — Optische Entrümpelung**
- Badge-/Disclaimer-Flut reduzieren (viele `[10px] uppercase`-Badges, wiederholte
  Warntexte → ein "i"-Info statt Textwände). Abstände/Hierarchie schärfen.

## Bewusst NICHT in Scope
- Rechen-/Scoring-Logik, ML-Pipeline, Datenquellen/API.
- Neue fundamentale Treiber hinzufügen (separates Thema).
- Echtes In-App-Chart/Replay.

## Offene Punkte (für Kerim zum Entscheiden)
- Name: "Fundamentaler Kompass" vs. "Fundamental Bias" vs. anders?
- Eval+ML wirklich zusammenlegen, oder ML ganz raus (experimentell, ~50%)?
- Treiber-Gewichte sichtbar machen (Zahlen) oder nur Richtung (Pfeile)?
