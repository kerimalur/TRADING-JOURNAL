/**
 * ========================================================================
 * Trading Journal – Fundamentals Hub
 * ========================================================================
 * Tabs:
 *   Global  – Makroübersicht je Land/Währung (BIP, CPI, Arb.-losigkeit, CB-Stance)
 *   News    – Wirtschaftskalender + Nachrichten-Feed
 *   COT     – Commitment of Traders (Commercials / Smart Money)
 *   Zinsen  – Zentralbank-Leitzinsen + Zinsdifferenz-Matrix
 *
 * TODO Phase 2 – API-Integration:
 *   Global  → Trading Economics API / IMF / World Bank
 *   News    → ForexFactory / Investing.com RSS / Reuters API
 *   COT     → CFTC publicreporting.cftc.gov API
 *   Zinsen  → centralbanksrates.com / Trading Economics
 * ========================================================================
 */

import { useState } from 'react';
import {
  Globe2, Newspaper, Database, Percent,
  TrendingUp, TrendingDown, Minus,
  ArrowUpRight, ArrowDownRight,
  Clock, Calendar, Info,
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/ui/PageTransition';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type PolicyStance  = 'hawkish' | 'neutral' | 'dovish';
type Trend         = 'up' | 'down' | 'flat';
type COTSignal     = 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
type ImpactLevel   = 'low' | 'medium' | 'high';
type ExpectedMove  = 'hike' | 'cut' | 'hold' | 'uncertain';
type Sentiment     = 'bullish' | 'bearish' | 'neutral';

interface CountryMacro {
  currency:            string;
  flag:                string;
  country:             string;
  centralBank:         string;
  rate:                number;
  rateTrend:           'hiking' | 'cutting' | 'holding';
  policyStance:        PolicyStance;
  nextMeeting:         string;
  gdp:                 number;
  gdpTrend:            Trend;
  cpi:                 number;
  cpiTrend:            Trend;
  unemployment:        number;
  unemploymentTrend:   Trend;
  tradeBalance:        'surplus' | 'deficit' | 'neutral';
  economicScore:       number;  // –100 … +100
  keyNote:             string;
}

interface EconomicEvent {
  id:        string;
  date:      string;
  time:      string;
  currency:  string;
  impact:    ImpactLevel;
  event:     string;
  actual?:   string;
  forecast?: string;
  previous?: string;
}

interface NewsArticle {
  id:                 string;
  title:              string;
  summary:            string;
  source:             string;
  publishedAt:        string;
  relatedCurrencies:  string[];
  sentiment:          Sentiment;
}

interface COTRow {
  currency:     string;
  flag:         string;
  long:         number;
  short:        number;
  net:          number;
  weeklyChange: number;
  percentile:   number;  // 0–100
  signal:       COTSignal;
}

interface RateRow {
  currency:       string;
  flag:           string;
  country:        string;
  centralBank:    string;
  rate:           number;
  previousRate:   number;
  lastChangeDate: string;
  lastChangeDir:  'up' | 'down';
  nextMeeting:    string;
  expectedMove:   ExpectedMove;
  marketPricing:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER DATA  (werden in Phase 2 durch API-Calls ersetzt)
// ─────────────────────────────────────────────────────────────────────────────

const MACRO_DATA: CountryMacro[] = [
  {
    currency: 'USD', flag: '🇺🇸', country: 'USA', centralBank: 'Federal Reserve',
    rate: 4.50, rateTrend: 'cutting', policyStance: 'neutral',
    nextMeeting: '2026-06-11',
    gdp: 2.1, gdpTrend: 'flat', cpi: 2.4, cpiTrend: 'down',
    unemployment: 4.2, unemploymentTrend: 'flat',
    tradeBalance: 'deficit', economicScore: 35,
    keyNote: 'Fed wartet auf weitere Disinflation. Arbeitsmarkt bleibt solide. Keine Eile bei weiteren Senkungen.',
  },
  {
    currency: 'EUR', flag: '🇪🇺', country: 'Eurozone', centralBank: 'EZB',
    rate: 2.25, rateTrend: 'cutting', policyStance: 'dovish',
    nextMeeting: '2026-06-05',
    gdp: 1.1, gdpTrend: 'up', cpi: 2.2, cpiTrend: 'down',
    unemployment: 6.2, unemploymentTrend: 'down',
    tradeBalance: 'surplus', economicScore: 20,
    keyNote: 'EZB nähert sich neutralem Zinsniveau. Wachstum erholt sich langsam. Weitere Senkung erwartet.',
  },
  {
    currency: 'GBP', flag: '🇬🇧', country: 'UK', centralBank: 'Bank of England',
    rate: 4.25, rateTrend: 'cutting', policyStance: 'neutral',
    nextMeeting: '2026-06-19',
    gdp: 1.3, gdpTrend: 'flat', cpi: 2.8, cpiTrend: 'down',
    unemployment: 4.5, unemploymentTrend: 'up',
    tradeBalance: 'deficit', economicScore: 15,
    keyNote: 'BoE vorsichtig – Dienstleistungsinflation noch erhöht. Senkungszyklus beginnt graduell.',
  },
  {
    currency: 'JPY', flag: '🇯🇵', country: 'Japan', centralBank: 'Bank of Japan',
    rate: 0.50, rateTrend: 'hiking', policyStance: 'hawkish',
    nextMeeting: '2026-06-17',
    gdp: 0.8, gdpTrend: 'down', cpi: 2.6, cpiTrend: 'flat',
    unemployment: 2.5, unemploymentTrend: 'flat',
    tradeBalance: 'deficit', economicScore: -10,
    keyNote: 'BoJ normalisiert Geldpolitik graduell. Lohnwachstum stützt weitere Zinserhöhungen.',
  },
  {
    currency: 'CAD', flag: '🇨🇦', country: 'Kanada', centralBank: 'Bank of Canada',
    rate: 2.75, rateTrend: 'cutting', policyStance: 'dovish',
    nextMeeting: '2026-06-04',
    gdp: 1.5, gdpTrend: 'down', cpi: 1.9, cpiTrend: 'down',
    unemployment: 6.7, unemploymentTrend: 'up',
    tradeBalance: 'surplus', economicScore: -20,
    keyNote: 'US-Zölle belasten Exporte. Wachstum schwächelt. BoC senkt weiter.',
  },
  {
    currency: 'AUD', flag: '🇦🇺', country: 'Australien', centralBank: 'RBA',
    rate: 4.10, rateTrend: 'cutting', policyStance: 'neutral',
    nextMeeting: '2026-06-03',
    gdp: 1.8, gdpTrend: 'up', cpi: 2.9, cpiTrend: 'down',
    unemployment: 4.1, unemploymentTrend: 'flat',
    tradeBalance: 'surplus', economicScore: 25,
    keyNote: 'RBA beginnt vorsichtigen Senkungszyklus. Rohstoffexporte stützen Wirtschaft.',
  },
  {
    currency: 'NZD', flag: '🇳🇿', country: 'Neuseeland', centralBank: 'RBNZ',
    rate: 3.50, rateTrend: 'cutting', policyStance: 'dovish',
    nextMeeting: '2026-07-09',
    gdp: 0.9, gdpTrend: 'down', cpi: 2.1, cpiTrend: 'down',
    unemployment: 5.1, unemploymentTrend: 'up',
    tradeBalance: 'deficit', economicScore: -25,
    keyNote: 'NZ-Wirtschaft unter Druck. RBNZ senkt aggressiv. Schwacher Arbeitsmarkt.',
  },
  {
    currency: 'CHF', flag: '🇨🇭', country: 'Schweiz', centralBank: 'SNB',
    rate: 0.25, rateTrend: 'cutting', policyStance: 'dovish',
    nextMeeting: '2026-06-19',
    gdp: 1.2, gdpTrend: 'flat', cpi: 0.8, cpiTrend: 'flat',
    unemployment: 2.8, unemploymentTrend: 'flat',
    tradeBalance: 'surplus', economicScore: 10,
    keyNote: 'SNB könnte auf 0% zusteuern. Franken-Stärke bleibt Hauptsorge.',
  },
];

const _today    = new Date().toISOString().split('T')[0];
const _tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

const ECONOMIC_EVENTS: EconomicEvent[] = [
  { id: 'e1', date: _today,    time: '08:30', currency: 'USD', impact: 'high',   event: 'US CPI m/m',               forecast: '0.2%',  previous: '0.3%'  },
  { id: 'e2', date: _today,    time: '10:00', currency: 'EUR', impact: 'medium', event: 'EZB-Rede Lagarde'                                                 },
  { id: 'e3', date: _today,    time: '14:30', currency: 'USD', impact: 'high',   event: 'US Retail Sales m/m',      forecast: '0.4%',  previous: '-0.2%' },
  { id: 'e4', date: _today,    time: '16:00', currency: 'USD', impact: 'low',    event: 'Michigan Konsumklima',     forecast: '68.5',  previous: '67.4'  },
  { id: 'e5', date: _tomorrow, time: '09:00', currency: 'GBP', impact: 'high',   event: 'UK CPI (Inflation)',       forecast: '2.6%',  previous: '2.8%'  },
  { id: 'e6', date: _tomorrow, time: '09:30', currency: 'CAD', impact: 'medium', event: 'Kanada BIP m/m',           forecast: '0.1%',  previous: '0.0%'  },
  { id: 'e7', date: _tomorrow, time: '13:30', currency: 'EUR', impact: 'high',   event: 'EZB Sitzungsprotokoll'                                            },
  { id: 'e8', date: _tomorrow, time: '14:15', currency: 'USD', impact: 'medium', event: 'Fed Industrial Production', forecast: '0.2%', previous: '-0.3%' },
  { id: 'e9', date: _tomorrow, time: '15:00', currency: 'AUD', impact: 'high',   event: 'RBA Gouverneur Rede'                                              },
];

const NEWS_ARTICLES: NewsArticle[] = [
  {
    id: 'n1', sentiment: 'neutral',
    title: 'Fed hält Zinsen stabil – Datenlage weiterhin abwartend',
    summary: 'Die Federal Reserve beließ die Zinsen unverändert. Fed-Chef signalisiert keine Eile bei weiteren Senkungen und betont Datenabhängigkeit.',
    source: 'Reuters', publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    relatedCurrencies: ['USD'],
  },
  {
    id: 'n2', sentiment: 'bearish',
    title: 'EZB senkt Leitzins auf 2,25% – weiterer Schritt möglich',
    summary: 'Die Europäische Zentralbank hat ihren Leitzins erneut gesenkt. Marktteilnehmer erwarten bis Jahresende eine weitere Senkung auf 2,00%.',
    source: 'Bloomberg', publishedAt: new Date(Date.now() - 7_200_000).toISOString(),
    relatedCurrencies: ['EUR'],
  },
  {
    id: 'n3', sentiment: 'bullish',
    title: 'Bank of Japan erwägt weitere Zinserhöhung im Sommer',
    summary: 'Starkes Lohnwachstum und stabile Inflation geben der BoJ Spielraum zur weiteren Normalisierung der Geldpolitik. JPY legt zu.',
    source: 'Nikkei', publishedAt: new Date(Date.now() - 10_800_000).toISOString(),
    relatedCurrencies: ['JPY'],
  },
  {
    id: 'n4', sentiment: 'neutral',
    title: 'SNB: Frankenstärke bleibt unter strenger Beobachtung',
    summary: 'Die Schweizerische Nationalbank beobachtet die CHF-Aufwertung genau. Devisenmarktinterventionen bleiben ein Instrument.',
    source: 'FT', publishedAt: new Date(Date.now() - 14_400_000).toISOString(),
    relatedCurrencies: ['CHF'],
  },
  {
    id: 'n5', sentiment: 'bearish',
    title: 'US-Zölle belasten Kanada – BoC senkt erneut auf 2,75%',
    summary: 'Importzölle auf kanadische Waren bremsen das Wachstum. Bank of Canada reagiert mit weiterer Senkung und warnt vor Rezessionsrisiken.',
    source: 'Globe & Mail', publishedAt: new Date(Date.now() - 18_000_000).toISOString(),
    relatedCurrencies: ['CAD'],
  },
  {
    id: 'n6', sentiment: 'neutral',
    title: 'RBA leitet vorsichtig Zinswende ein – AUD unter Druck',
    summary: 'Reserve Bank of Australia senkt den Leitzins auf 4,10%. Weitere Schritte sind datenabhängig. Rohstoffpreise bleiben Stütze.',
    source: 'AFR', publishedAt: new Date(Date.now() - 21_600_000).toISOString(),
    relatedCurrencies: ['AUD'],
  },
];

const COT_DATA: COTRow[] = [
  { currency: 'USD', flag: '🇺🇸', long: 42300,  short: 18900, net:  23400, weeklyChange:  1200, percentile: 68, signal: 'bull'        },
  { currency: 'EUR', flag: '🇪🇺', long: 167000, short: 89000, net:  78000, weeklyChange: -3200, percentile: 52, signal: 'neutral'      },
  { currency: 'GBP', flag: '🇬🇧', long: 64000,  short: 71000, net:  -7000, weeklyChange: -1800, percentile: 38, signal: 'bear'        },
  { currency: 'JPY', flag: '🇯🇵', long: 55000,  short: 32000, net:  23000, weeklyChange:  4500, percentile: 72, signal: 'bull'        },
  { currency: 'CAD', flag: '🇨🇦', long: 28000,  short: 58000, net: -30000, weeklyChange: -2100, percentile: 22, signal: 'strong_bear' },
  { currency: 'AUD', flag: '🇦🇺', long: 51000,  short: 43000, net:   8000, weeklyChange:   800, percentile: 55, signal: 'neutral'      },
  { currency: 'NZD', flag: '🇳🇿', long: 18000,  short: 31000, net: -13000, weeklyChange:  -600, percentile: 28, signal: 'bear'        },
  { currency: 'CHF', flag: '🇨🇭', long: 22000,  short:  9000, net:  13000, weeklyChange:  2300, percentile: 81, signal: 'strong_bull' },
];

const RATE_DATA: RateRow[] = [
  { currency: 'USD', flag: '🇺🇸', country: 'USA',        centralBank: 'Fed',  rate: 4.50, previousRate: 4.75, lastChangeDate: '2026-03-19', lastChangeDir: 'down', nextMeeting: '2026-06-11', expectedMove: 'hold', marketPricing: 'Pause  70%'   },
  { currency: 'EUR', flag: '🇪🇺', country: 'Eurozone',   centralBank: 'EZB',  rate: 2.25, previousRate: 2.50, lastChangeDate: '2026-04-17', lastChangeDir: 'down', nextMeeting: '2026-06-05', expectedMove: 'cut',  marketPricing: '–25 bps 65%'  },
  { currency: 'GBP', flag: '🇬🇧', country: 'UK',         centralBank: 'BoE',  rate: 4.25, previousRate: 4.50, lastChangeDate: '2026-05-08', lastChangeDir: 'down', nextMeeting: '2026-06-19', expectedMove: 'hold', marketPricing: 'Pause  55%'   },
  { currency: 'JPY', flag: '🇯🇵', country: 'Japan',      centralBank: 'BoJ',  rate: 0.50, previousRate: 0.25, lastChangeDate: '2026-03-19', lastChangeDir: 'up',   nextMeeting: '2026-06-17', expectedMove: 'hike', marketPricing: '+25 bps 40%'  },
  { currency: 'CAD', flag: '🇨🇦', country: 'Kanada',     centralBank: 'BoC',  rate: 2.75, previousRate: 3.00, lastChangeDate: '2026-04-16', lastChangeDir: 'down', nextMeeting: '2026-06-04', expectedMove: 'cut',  marketPricing: '–25 bps 60%'  },
  { currency: 'AUD', flag: '🇦🇺', country: 'Australien', centralBank: 'RBA',  rate: 4.10, previousRate: 4.35, lastChangeDate: '2026-05-06', lastChangeDir: 'down', nextMeeting: '2026-06-03', expectedMove: 'hold', marketPricing: 'Pause  50%'   },
  { currency: 'NZD', flag: '🇳🇿', country: 'Neuseeland', centralBank: 'RBNZ', rate: 3.50, previousRate: 3.75, lastChangeDate: '2026-04-09', lastChangeDir: 'down', nextMeeting: '2026-07-09', expectedMove: 'cut',  marketPricing: '–25 bps 70%'  },
  { currency: 'CHF', flag: '🇨🇭', country: 'Schweiz',    centralBank: 'SNB',  rate: 0.25, previousRate: 0.50, lastChangeDate: '2026-03-20', lastChangeDir: 'down', nextMeeting: '2026-06-19', expectedMove: 'cut',  marketPricing: '–25 bps 45%'  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG MAPS
// ─────────────────────────────────────────────────────────────────────────────

const POLICY_CFG: Record<PolicyStance, { label: string; color: string; bg: string }> = {
  hawkish: { label: 'Hawkish', color: 'text-pnl-positive', bg: 'bg-pnl-positive/10 border border-pnl-positive/25' },
  neutral: { label: 'Neutral', color: 'text-accent-gold',  bg: 'bg-accent-gold/10 border border-accent-gold/25'   },
  dovish:  { label: 'Dovish',  color: 'text-pnl-negative', bg: 'bg-pnl-negative/10 border border-pnl-negative/25' },
};

const SIGNAL_CFG: Record<COTSignal, { label: string; textColor: string; dotColor: string }> = {
  strong_bull: { label: 'Stark Long',  textColor: 'text-pnl-positive',    dotColor: 'bg-pnl-positive'     },
  bull:        { label: 'Long',        textColor: 'text-pnl-positive/80', dotColor: 'bg-pnl-positive/60'  },
  neutral:     { label: 'Neutral',     textColor: 'text-text-muted',      dotColor: 'bg-text-muted'       },
  bear:        { label: 'Short',       textColor: 'text-pnl-negative/80', dotColor: 'bg-pnl-negative/60'  },
  strong_bear: { label: 'Stark Short', textColor: 'text-pnl-negative',    dotColor: 'bg-pnl-negative'     },
};

const IMPACT_CFG: Record<ImpactLevel, { dot: string }> = {
  high:   { dot: 'bg-pnl-negative' },
  medium: { dot: 'bg-accent-gold'  },
  low:    { dot: 'bg-text-muted'   },
};

const MOVE_CFG: Record<ExpectedMove, { label: string; color: string }> = {
  hike:      { label: 'Erhöhung', color: 'text-pnl-positive' },
  cut:       { label: 'Senkung',  color: 'text-pnl-negative' },
  hold:      { label: 'Pause',    color: 'text-text-muted'   },
  uncertain: { label: 'Unklar',   color: 'text-accent-gold'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtK(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '–' : '';
  return abs >= 1000 ? `${sign}${(abs / 1000).toFixed(1)}K` : `${sign}${abs}`;
}

function TrendIcon({ t, size = 12 }: { t: Trend; size?: number }) {
  if (t === 'up')   return <TrendingUp   size={size} className="text-pnl-positive" />;
  if (t === 'down') return <TrendingDown size={size} className="text-pnl-negative" />;
  return <Minus size={size} className="text-text-muted" />;
}

/** Horizontal score bar centred at 0; green right, red left. */
function ScoreBar({ score }: { score: number }) {
  const c = Math.max(-100, Math.min(100, score));
  const w = Math.abs(c) / 2;
  const color = c > 20 ? '#22C55E' : c < -20 ? '#EF4444' : '#EAB308';
  return (
    <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className="absolute top-0 h-full rounded-full"
        style={{ left: c >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: color }}
      />
      <div className="absolute top-0 left-1/2 w-px h-full bg-white/20" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

function GlobalTab() {
  const [selected, setSelected] = useState<string | null>(null);
  const detail = MACRO_DATA.find(d => d.currency === selected) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-primary/5 border border-accent-primary/15 text-xs text-text-muted">
        <Info size={13} className="text-accent-primary flex-shrink-0" />
        Platzhalter-Daten · API-Integration folgt in Phase 2 (Trading Economics / IMF / World Bank)
      </div>

      {/* 4×2 currency macro cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {MACRO_DATA.map(d => {
          const stance   = POLICY_CFG[d.policyStance];
          const isActive = selected === d.currency;
          return (
            <motion.button
              key={d.currency}
              onClick={() => setSelected(isActive ? null : d.currency)}
              className={clsx(
                'text-left rounded-xl border p-4 transition-all duration-200',
                isActive
                  ? 'border-accent-primary/60 bg-accent-primary/5 shadow-glow-sm'
                  : 'border-border bg-background-card hover:border-border-light hover:bg-background-elevated',
              )}
              whileTap={{ scale: 0.99 }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none select-none">{d.flag}</span>
                  <div>
                    <p className="font-bold text-text-primary text-sm leading-tight">{d.currency}</p>
                    <p className="text-[10px] text-text-muted leading-tight">{d.centralBank}</p>
                  </div>
                </div>
                <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded', stance.bg, stance.color)}>
                  {stance.label}
                </span>
              </div>

              {/* Rate + trend */}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold tabular-nums text-text-primary">{d.rate.toFixed(2)}</span>
                <span className="text-xs text-text-muted">%</span>
                {d.rateTrend === 'hiking'  && <ArrowUpRight   size={14} className="text-pnl-positive ml-0.5" />}
                {d.rateTrend === 'cutting' && <ArrowDownRight size={14} className="text-pnl-negative ml-0.5" />}
                {d.rateTrend === 'holding' && <Minus          size={13} className="text-text-muted ml-0.5"   />}
              </div>

              {/* Economic score bar */}
              <ScoreBar score={d.economicScore} />

              {/* Mini metrics */}
              <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-1 text-[10px]">
                {[
                  { label: 'BIP',      val: d.gdp,          t: d.gdpTrend          },
                  { label: 'CPI',      val: d.cpi,          t: d.cpiTrend          },
                  { label: 'Arb.-los', val: d.unemployment, t: d.unemploymentTrend },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-text-muted">{m.label}</p>
                    <div className="flex items-center gap-0.5 font-semibold text-text-secondary">
                      {m.val.toFixed(1)}% <TrendIcon t={m.t} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Next meeting */}
              <div className="mt-3 flex items-center gap-1 text-[10px] text-text-muted">
                <Calendar size={10} />
                Meeting: <span className="text-text-secondary ml-0.5">{fmtDate(d.nextMeeting)}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {detail && (
          <motion.div
            key={detail.currency}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="rounded-xl border border-accent-primary/30 bg-accent-primary/5 p-5"
          >
            <div className="flex items-start gap-4">
              <span className="text-5xl leading-none select-none">{detail.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="font-bold text-text-primary text-base">{detail.country} · {detail.currency}</h3>
                  <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded', POLICY_CFG[detail.policyStance].bg, POLICY_CFG[detail.policyStance].color)}>
                    {POLICY_CFG[detail.policyStance].label}
                  </span>
                  <span className="text-xs text-text-muted">{detail.centralBank}</span>
                </div>
                <p className="text-sm text-text-secondary mb-4 leading-relaxed">{detail.keyNote}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Leitzins',        value: `${detail.rate.toFixed(2)} %` },
                    { label: 'BIP (YoY)',        value: `${detail.gdp.toFixed(1)} %` },
                    { label: 'Inflation (CPI)',  value: `${detail.cpi.toFixed(1)} %` },
                    { label: 'Arbeitslosigkeit', value: `${detail.unemployment.toFixed(1)} %` },
                  ].map(m => (
                    <div key={m.label}>
                      <p className="text-text-muted text-xs mb-0.5">{m.label}</p>
                      <p className="font-bold text-text-primary">{m.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-text-muted">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    Nächstes Meeting:
                    <span className="text-text-secondary ml-1">{fmtDate(detail.nextMeeting)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    Handelsbilanz:
                    <span className={clsx('ml-1 font-semibold',
                      detail.tradeBalance === 'surplus' ? 'text-pnl-positive' :
                      detail.tradeBalance === 'deficit' ? 'text-pnl-negative' : 'text-text-muted'
                    )}>
                      {detail.tradeBalance === 'surplus' ? 'Überschuss' : detail.tradeBalance === 'deficit' ? 'Defizit' : 'Ausgeglichen'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: NEWS
// ─────────────────────────────────────────────────────────────────────────────

const ALL_CCY = ['all', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF'] as const;

function NewsTab() {
  const [ccy,    setCcy]    = useState<string>('all');
  const [impact, setImpact] = useState<string>('all');

  const eventsFiltered = ECONOMIC_EVENTS.filter(e => {
    if (ccy !== 'all' && e.currency !== ccy) return false;
    if (impact !== 'all' && e.impact !== impact) return false;
    return true;
  });

  const newsFiltered = NEWS_ARTICLES.filter(n =>
    ccy === 'all' || n.relatedCurrencies.includes(ccy)
  );

  const eventsByDate = eventsFiltered.reduce<Record<string, EconomicEvent[]>>((acc, ev) => {
    (acc[ev.date] ??= []).push(ev);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {ALL_CCY.map(c => (
            <button
              key={c}
              onClick={() => setCcy(c)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                ccy === c
                  ? 'bg-accent-primary text-white'
                  : 'bg-background-elevated text-text-muted hover:text-text-primary border border-border',
              )}
            >
              {c === 'all' ? 'Alle' : c}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {(['all', 'high', 'medium', 'low'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setImpact(lvl)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                impact === lvl
                  ? 'bg-accent-primary text-white border-transparent'
                  : 'bg-background-elevated text-text-muted hover:text-text-primary border-border',
              )}
            >
              {lvl === 'all' ? 'Alle' : lvl === 'high' ? '● Hoch' : lvl === 'medium' ? '● Mittel' : '● Niedrig'}
            </button>
          ))}
        </div>
      </div>

      {/* Two columns: calendar + news */}
      <div className="grid grid-cols-2 gap-4">
        {/* Economic calendar */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Calendar size={14} className="text-accent-primary" />
            Wirtschaftskalender
          </h3>
          {Object.keys(eventsByDate).length === 0 ? (
            <div className="text-sm text-text-muted text-center py-10 rounded-xl border border-border bg-background-elevated">
              Keine Events für diesen Filter
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(eventsByDate).map(([date, events]) => (
                <div key={date}>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                    {date === _today ? 'Heute' : date === _tomorrow ? 'Morgen' : fmtDate(date)}
                  </p>
                  <div className="space-y-1">
                    {events.map(ev => (
                      <div
                        key={ev.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background-elevated border border-border hover:border-border-light transition-colors"
                      >
                        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', IMPACT_CFG[ev.impact].dot)} />
                        <span className="text-xs text-text-muted tabular-nums w-10 flex-shrink-0">{ev.time}</span>
                        <span className="text-xs font-semibold text-text-muted w-9 flex-shrink-0">{ev.currency}</span>
                        <span className="text-xs text-text-primary flex-1 min-w-0 truncate">{ev.event}</span>
                        <div className="flex gap-3 text-[10px] tabular-nums flex-shrink-0 text-text-muted">
                          {ev.forecast && <span>Prog: <span className="text-text-secondary">{ev.forecast}</span></span>}
                          {ev.actual   && <span className="font-semibold text-accent-primary">Ist: {ev.actual}</span>}
                          {ev.previous && <span>Vor: {ev.previous}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* News feed */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Newspaper size={14} className="text-accent-primary" />
            Nachrichten
          </h3>
          {newsFiltered.length === 0 ? (
            <div className="text-sm text-text-muted text-center py-10 rounded-xl border border-border bg-background-elevated">
              Keine News für diesen Filter
            </div>
          ) : (
            <div className="space-y-2">
              {newsFiltered.map(n => (
                <div
                  key={n.id}
                  className="px-3 py-3 rounded-lg bg-background-elevated border border-border hover:border-border-light transition-colors"
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <div className={clsx(
                      'mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0',
                      n.sentiment === 'bullish' ? 'bg-pnl-positive' :
                      n.sentiment === 'bearish' ? 'bg-pnl-negative' : 'bg-text-muted',
                    )} />
                    <p className="text-xs font-semibold text-text-primary leading-snug">{n.title}</p>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed pl-3.5 mb-2">{n.summary}</p>
                  <div className="flex items-center gap-2 pl-3.5">
                    <span className="text-[10px] text-text-muted">{n.source}</span>
                    <span className="text-[10px] text-text-muted">·</span>
                    <span className="text-[10px] text-text-muted">{fmtTime(n.publishedAt)}</span>
                    <div className="flex gap-1 ml-auto">
                      {n.relatedCurrencies.map(c => (
                        <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-accent-primary/10 text-accent-primary font-semibold">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: COT
// ─────────────────────────────────────────────────────────────────────────────

function CotTab() {
  const maxAbs = Math.max(...COT_DATA.map(d => Math.abs(d.net)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Info size={13} className="text-accent-primary flex-shrink-0" />
          Commitment of Traders · Commercials / Smart Money · CFTC-Daten wöchentlich (dienstags)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Clock size={12} />
          Stand: Platzhalter · API folgt (CFTC publicreporting)
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-background-elevated">
              {[
                { label: 'Währung',     align: 'left'  },
                { label: 'Long',        align: 'right' },
                { label: 'Short',       align: 'right' },
                { label: 'Netto',       align: 'right' },
                { label: 'Wöchentl.',   align: 'right' },
                { label: 'Netto-Bar',   align: 'left'  },
                { label: 'Perzentil',   align: 'right' },
                { label: 'Signal',      align: 'right' },
              ].map(h => (
                <th
                  key={h.label}
                  className={clsx(
                    'px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider',
                    h.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COT_DATA.map((row, i) => {
              const sig  = SIGNAL_CFG[row.signal];
              const pos  = row.net >= 0;
              const barW = (Math.abs(row.net) / maxAbs) * 44;
              return (
                <tr
                  key={row.currency}
                  className={clsx(
                    'border-b border-border/50 hover:bg-background-elevated/60 transition-colors',
                    i % 2 === 1 && 'bg-background-card/20',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none select-none">{row.flag}</span>
                      <span className="font-semibold text-text-primary">{row.currency}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{fmtK(row.long)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{fmtK(row.short)}</td>
                  <td className={clsx('px-4 py-3 text-right tabular-nums font-semibold', pos ? 'text-pnl-positive' : 'text-pnl-negative')}>
                    {pos ? '+' : ''}{fmtK(row.net)}
                  </td>
                  <td className={clsx('px-4 py-3 text-right tabular-nums text-xs', row.weeklyChange >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                    {row.weeklyChange >= 0 ? '▲' : '▼'} {fmtK(Math.abs(row.weeklyChange))}
                  </td>
                  <td className="px-4 py-3 w-32">
                    <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={clsx('absolute top-0 h-full rounded-full', pos ? 'bg-pnl-positive/70' : 'bg-pnl-negative/70')}
                        style={{ left: pos ? '50%' : `${50 - barW}%`, width: `${barW}%` }}
                      />
                      <div className="absolute top-0 left-1/2 w-px h-full bg-white/15" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-xs tabular-nums text-text-secondary">
                      {row.percentile}%
                      <div className="w-14 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-accent-primary/60" style={{ width: `${row.percentile}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className={clsx('w-1.5 h-1.5 rounded-full', sig.dotColor)} />
                      <span className={clsx('text-xs font-medium', sig.textColor)}>{sig.label}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-muted">
        <span>Commercials = institutionelle Marktteilnehmer / Hedger (Smart Money)</span>
        <span>·</span>
        <span>Netto = Long − Short Kontrakte</span>
        <span>·</span>
        <span>Perzentil = historisches Ranking der letzten 52 Wochen</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: ZINSEN
// ─────────────────────────────────────────────────────────────────────────────

const CARRY_PAIRS = [
  ['EUR','USD'],['GBP','USD'],['USD','JPY'],
  ['AUD','JPY'],['USD','CHF'],['NZD','USD'],
  ['USD','CAD'],['EUR','GBP'],
] as const;

function ZinsenTab() {
  const sorted  = [...RATE_DATA].sort((a, b) => b.rate - a.rate);
  const maxRate = sorted[0].rate;
  const rateMap = Object.fromEntries(RATE_DATA.map(r => [r.currency, r]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Info size={13} className="text-accent-primary flex-shrink-0" />
        Zentralbank-Leitzinsen · Platzhalter-Daten · API folgt (Trading Economics / CBR)
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {sorted.map(r => {
          const move = MOVE_CFG[r.expectedMove];
          return (
            <div key={r.currency} className="rounded-xl border border-border bg-background-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none select-none">{r.flag}</span>
                  <div>
                    <p className="font-bold text-text-primary text-sm leading-tight">{r.currency}</p>
                    <p className="text-[10px] text-text-muted">{r.centralBank}</p>
                  </div>
                </div>
                {r.lastChangeDir === 'down'
                  ? <ArrowDownRight size={15} className="text-pnl-negative" />
                  : <ArrowUpRight   size={15} className="text-pnl-positive" />
                }
              </div>

              {/* Big rate */}
              <div className="mb-1">
                <span className="text-3xl font-bold tabular-nums text-text-primary">{r.rate.toFixed(2)}</span>
                <span className="text-sm text-text-muted ml-1">%</span>
              </div>

              {/* Bar */}
              <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-4">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-accent-primary/60"
                  style={{ width: `${(r.rate / maxRate) * 100}%` }}
                />
              </div>

              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-text-muted">Vorheriger Zins</span>
                  <span className="tabular-nums text-text-secondary">{r.previousRate.toFixed(2)} %</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Letzte Änderung</span>
                  <span className="text-text-secondary">{fmtDate(r.lastChangeDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Nächstes Meeting</span>
                  <span className="text-text-secondary">{fmtDate(r.nextMeeting)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-border/40">
                  <span className="text-text-muted">Markt erwartet</span>
                  <div className="flex items-center gap-1">
                    <span className={clsx('font-semibold', move.color)}>{move.label}</span>
                    <span className="text-text-muted">· {r.marketPricing}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Carry / spread matrix */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Percent size={14} className="text-accent-primary" />
          Zinsdifferenz-Matrix · wichtige Pairs
        </h3>
        <div className="rounded-xl border border-border overflow-auto">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="border-b border-border bg-background-elevated">
                {[
                  { h: 'Pair',        left: true  },
                  { h: 'Basis-Rate',  left: false },
                  { h: 'Quote-Rate',  left: false },
                  { h: 'Spread',      left: false },
                  { h: 'Carry-Bias',  left: false },
                ].map(col => (
                  <th key={col.h} className={clsx('px-4 py-2.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider', col.left ? 'text-left' : 'text-right')}>
                    {col.h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CARRY_PAIRS.map(([base, quote]) => {
                const b = rateMap[base];
                const q = rateMap[quote];
                if (!b || !q) return null;
                const spread = parseFloat((b.rate - q.rate).toFixed(2));
                const biasColor = spread > 0.5 ? 'text-pnl-positive' : spread < -0.5 ? 'text-pnl-negative' : 'text-text-muted';
                const biasLabel = spread > 0.5 ? `${base} bevorzugt` : spread < -0.5 ? `${quote} bevorzugt` : 'Neutral';
                return (
                  <tr key={`${base}/${quote}`} className="border-b border-border/50 hover:bg-background-elevated/50 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-text-primary">{base}/{quote}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">{b.rate.toFixed(2)} %</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">{q.rate.toFixed(2)} %</td>
                    <td className={clsx('px-4 py-2.5 text-right tabular-nums font-semibold', spread > 0 ? 'text-pnl-positive' : spread < 0 ? 'text-pnl-negative' : 'text-text-muted')}>
                      {spread > 0 ? '+' : ''}{spread.toFixed(2)} %
                    </td>
                    <td className={clsx('px-4 py-2.5 text-right font-medium', biasColor)}>{biasLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-text-muted">
          Spread &gt; +0,5 %: Basis-Währung hat Carry-Vorteil · Spread &lt; –0,5 %: Quote-Währung bevorzugt
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'global' | 'news' | 'cot' | 'zinsen';

const TABS: { id: TabId; label: string; icon: React.ReactNode; sub: string }[] = [
  { id: 'global', label: 'Global', icon: <Globe2    size={15} />, sub: 'Makroübersicht'   },
  { id: 'news',   label: 'News',   icon: <Newspaper size={15} />, sub: 'Kalender & Feeds' },
  { id: 'cot',    label: 'COT',    icon: <Database  size={15} />, sub: 'Smart Money'      },
  { id: 'zinsen', label: 'Zinsen', icon: <Percent   size={15} />, sub: 'Zentralbankraten' },
];

export function Fundamentals() {
  const [active, setActive] = useState<TabId>('global');

  return (
    <PageTransition>
      <div className="flex flex-col h-full overflow-hidden">

        {/* Header + tab bar */}
        <div className="flex-shrink-0 px-6 pt-6 pb-0">
          <div className="flex items-baseline gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Globe2 size={20} className="text-accent-primary" />
              <h1 className="text-xl font-bold text-text-primary">Fundamentals</h1>
            </div>
            <span className="text-sm text-text-muted">Makroökonomische Marktanalyse</span>
          </div>

          <div className="flex gap-0.5 bg-background-elevated border border-border rounded-xl p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  active === tab.id
                    ? 'bg-background-surface-solid text-text-primary shadow-sm border border-border/80'
                    : 'text-text-muted hover:text-text-secondary hover:bg-background-surface/40',
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className={clsx('text-[10px] hidden lg:inline', active === tab.id ? 'text-text-muted' : 'text-text-muted/40')}>
                  {tab.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {active === 'global' && <GlobalTab />}
              {active === 'news'   && <NewsTab   />}
              {active === 'cot'    && <CotTab    />}
              {active === 'zinsen' && <ZinsenTab />}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </PageTransition>
  );
}
