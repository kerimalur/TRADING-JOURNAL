/**
 * Backtest – Session-Erstellungs-Wizard. Fragt Pair, Strategie, RR, Risiko,
 * Account und (neu) ein optionales Startdatum ab und erzeugt die Session.
 */

import { useEffect, useState } from 'react';
import { FlaskConical, Play, X } from 'lucide-react';
import { PAIR_LIST } from '@/shared/types';
import { loadStrategies, type StrategyRecord } from '@/shared/services/strategyService';
import { newId } from './types';
import type { BacktestSession } from './types';

interface Props {
  onClose: () => void;
  onCreate: (session: BacktestSession) => void;
}

const today = () => new Date().toISOString().split('T')[0];

export function BacktestWizard({ onClose, onCreate }: Props) {
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [data, setData] = useState({
    pair: 'EURUSD',
    strategyId: '',
    defaultRR: 2,
    riskPercent: 1,
    accountSize: 10000,
    startDate: today(),
  });

  useEffect(() => {
    loadStrategies().then(setStrategies).catch(() => { /* offline / nicht eingeloggt */ });
  }, []);

  const create = () => {
    const stratName = strategies.find(s => s.id === data.strategyId)?.name;
    const stratLabel = stratName ? ` · ${stratName}` : '';
    const session: BacktestSession = {
      id: newId(),
      name: `${data.pair}${stratLabel} · ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}`,
      createdAt: Date.now(), updatedAt: Date.now(), trades: [], isPaused: false, elapsedMs: 0,
      pair: data.pair,
      strategyId: data.strategyId || undefined,
      strategy: stratName || undefined,
      defaultRR: data.defaultRR,
      riskPercent: data.riskPercent,
      accountSize: data.accountSize,
      startDate: data.startDate || today(),
    };
    onCreate(session);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-background-surface border border-border rounded-xl shadow-card-hover p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><FlaskConical size={18} className="text-accent-primary" /> Neue Backtest-Session</h3>
          <button onClick={onClose} className="p-1 hover:bg-black/[0.06] rounded"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="input-label">Währungspaar</label>
            <select className="input select" value={data.pair} onChange={e => setData(p => ({ ...p, pair: e.target.value }))}>
              {PAIR_LIST.map(pair => <option key={pair} value={pair}>{pair}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Strategie</label>
            <select className="input select" value={data.strategyId} onChange={e => setData(p => ({ ...p, strategyId: e.target.value }))}>
              <option value="">— keine —</option>
              {strategies.map(s => <option key={s.id || s.name} value={s.id || ''}>{s.name}</option>)}
            </select>
            {strategies.length === 0 && <p className="text-[11px] text-text-muted mt-1">Keine eigenen Strategien gefunden — im Strategie-Bereich anlegen, oder „keine" wählen.</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="input-label">Standard-RR (1:x)</label>
              <input type="number" step="0.5" min="0.5" className="input" value={data.defaultRR} onChange={e => setData(p => ({ ...p, defaultRR: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="input-label">Risiko/Trade (%)</label>
              <input type="number" step="0.1" min="0" className="input" value={data.riskPercent} onChange={e => setData(p => ({ ...p, riskPercent: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="input-label">Account (€)</label>
              <input type="number" step="100" min="0" className="input" value={data.accountSize} onChange={e => setData(p => ({ ...p, accountSize: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div>
            <label className="input-label">Startdatum (Backtest)</label>
            <input type="date" className="input" value={data.startDate} onChange={e => setData(p => ({ ...p, startDate: e.target.value }))} />
            <p className="text-[11px] text-text-muted mt-1">Für Backtests in der Vergangenheit — das Eingabe-Datum startet hier und bleibt dort.</p>
          </div>
          {data.accountSize > 0 && data.riskPercent > 0 && (
            <p className="text-[11px] text-text-muted">
              Risiko/Trade = <span className="text-text-secondary font-medium">{((data.accountSize * data.riskPercent) / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</span>.
              P&amp;L pro Trade = R-Multiple × dieser Betrag.
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="btn btn-secondary flex-1">Abbrechen</button>
          <button onClick={create} disabled={!data.pair} className="btn btn-primary flex-1"><Play size={16} /> Session starten</button>
        </div>
      </div>
    </div>
  );
}
