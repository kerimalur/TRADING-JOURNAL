/**
 * ========================================================================
 * Trading Journal – Fundamentals / Global
 * ========================================================================
 * Makroübersicht je Währung (BIP, CPI, Arbeitslosigkeit, CB-Stance)
 * ========================================================================
 */

import { useState } from 'react';
import {
  Globe2,
  TrendingUp, TrendingDown, Minus,
  ArrowUpRight, ArrowDownRight,
  Calendar, Info,
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/ui/PageTransition';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type PolicyStance = 'hawkish' | 'neutral' | 'dovish';
type Trend        = 'up' | 'down' | 'flat';

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
  economicScore:       number;
  keyNote:             string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER DATA
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

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG MAPS
// ─────────────────────────────────────────────────────────────────────────────

const POLICY_CFG: Record<PolicyStance, { label: string; color: string; bg: string }> = {
  hawkish: { label: 'Hawkish', color: 'text-pnl-positive', bg: 'bg-pnl-positive/10 border border-pnl-positive/25' },
  neutral: { label: 'Neutral', color: 'text-accent-gold',  bg: 'bg-accent-gold/10 border border-accent-gold/25'   },
  dovish:  { label: 'Dovish',  color: 'text-pnl-negative', bg: 'bg-pnl-negative/10 border border-pnl-negative/25' },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function TrendIcon({ t, size = 12 }: { t: Trend; size?: number }) {
  if (t === 'up')   return <TrendingUp   size={size} className="text-pnl-positive" />;
  if (t === 'down') return <TrendingDown size={size} className="text-pnl-negative" />;
  return <Minus size={size} className="text-text-muted" />;
}

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
// GLOBAL TAB
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
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function Fundamentals() {
  return (
    <PageTransition>
      <div className="flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-0 mb-2">
          <div className="flex items-baseline gap-3">
            <div className="flex items-center gap-2">
              <Globe2 size={20} className="text-accent-primary" />
              <h1 className="text-xl font-bold text-text-primary">Global</h1>
            </div>
            <span className="text-sm text-text-muted">Makroökonomische Marktübersicht</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <GlobalTab />
        </div>

      </div>
    </PageTransition>
  );
}