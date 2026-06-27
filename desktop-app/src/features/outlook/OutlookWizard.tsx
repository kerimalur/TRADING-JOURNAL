/**
 * OutlookWizard — Step-by-Step Popup für neue Outlooks
 * Design matched TradeForm (max-w-3xl, gleicher Style)
 */

import { useState, useMemo } from 'react';
import {
  X, ChevronRight, ChevronLeft, Check, Star,
  TrendingUp, TrendingDown, AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { getConfluences, type StrategyChecklistItem } from '@/shared/types';

interface Strategy {
  id: string;
  name: string;
  description: string;
  direction: 'long' | 'short' | 'both';
  rules: { id: string; text: string; type: 'entry' | 'exit' | 'filter' | 'risk'; required: boolean }[];
  isActive: boolean;
}

interface WizardData {
  symbol: string;
  setupId: string;
  direction: 'long' | 'short';
  confluences: string[];
  fundamentalOutlook: string;
  strategyChecklist: StrategyChecklistItem[];
  thesis: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  targetEntry?: number;
  targetSL?: number;
  targetTP?: number;
  isStarred: boolean;
}

interface OutlookWizardProps {
  symbol: string;
  existingOutlook?: any;
  onSave: (data: WizardData) => void;
  onClose: () => void;
}

const STEPS = ['Setup', 'Richtung', 'Confluences', 'Fundamental', 'Checkliste', 'Details'];

function loadStrategies(): Strategy[] {
  try {
    const raw = localStorage.getItem('tradingStrategies');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function OutlookWizard({ symbol, existingOutlook, onSave, onClose }: OutlookWizardProps) {
  const strategies = useMemo(() => loadStrategies().filter(s => s.isActive), []);
  const allConfluences = useMemo(() => getConfluences(), []);

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => ({
    symbol,
    setupId: existingOutlook?.setupId || '',
    direction: existingOutlook?.direction || 'long',
    confluences: existingOutlook?.tags || [],
    fundamentalOutlook: existingOutlook?.fundamentalOutlook || '',
    strategyChecklist: existingOutlook?.strategyChecklist || [],
    thesis: existingOutlook?.thesis || '',
    confidence: existingOutlook?.confidence || 3,
    targetEntry: existingOutlook?.targetEntry,
    targetSL: existingOutlook?.targetSL,
    targetTP: existingOutlook?.targetTP,
    isStarred: existingOutlook?.isStarred || false,
  }));

  const selectedStrategy = strategies.find(s => s.id === data.setupId);

  const handleSetupSelect = (id: string) => {
    const strategy = strategies.find(s => s.id === id);
    setData(prev => ({
      ...prev,
      setupId: id,
      strategyChecklist: strategy
        ? strategy.rules.map(r => ({ ruleId: r.id, text: r.text, type: r.type, checked: false }))
        : [],
    }));
  };

  const toggleChecklist = (ruleId: string) => {
    setData(prev => ({
      ...prev,
      strategyChecklist: prev.strategyChecklist.map(item =>
        item.ruleId === ruleId ? { ...item, checked: !item.checked } : item
      ),
    }));
  };

  const canAdvance = () => {
    if (step === 0) return true;
    if (step === 1) return true;
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onSave(data);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-background-surface border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-text-primary">{symbol}</span>
            <button
              onClick={() => setData(prev => ({ ...prev, isStarred: !prev.isStarred }))}
              className="p-1 rounded hover:bg-black/[0.06]"
            >
              <Star size={14} className={data.isStarred ? 'text-accent-gold fill-accent-gold' : 'text-text-muted'} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Step Indicators */}
            <div className="flex items-center gap-1">
              {STEPS.map((_s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors',
                    i < step ? 'bg-pnl-positive text-white' :
                    i === step ? 'bg-accent-primary text-white' :
                    'bg-black/[0.06] text-text-muted'
                  )}>
                    {i < step ? <Check size={10} /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 && <div className={clsx('w-3 h-px', i < step ? 'bg-pnl-positive' : 'bg-black/[0.08]')} />}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/[0.06] text-text-muted">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >

              {/* Step 0: Setup */}
              {step === 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">Setup auswählen</h3>
                  <p className="text-[10px] text-text-muted mb-4">Welche Strategie liegt diesem Trade zugrunde?</p>

                  {strategies.length === 0 ? (
                    <div className="p-4 bg-black/[0.02] rounded-lg border border-black/[0.06] text-center">
                      <AlertCircle size={20} className="text-text-muted mx-auto mb-2" />
                      <p className="text-xs text-text-muted">Keine Strategien erstellt.</p>
                      <p className="text-[10px] text-text-muted mt-1">Erstelle Strategien unter "Strategie" in der Sidebar.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {strategies.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleSetupSelect(s.id)}
                          className={clsx(
                            'text-left p-3 rounded-lg border transition-colors',
                            data.setupId === s.id
                              ? 'border-accent-primary bg-accent-primary/10'
                              : 'border-black/[0.06] bg-black/[0.02] hover:bg-black/[0.04]'
                          )}
                        >
                          <div className="text-xs font-semibold text-text-primary">{s.name}</div>
                          <div className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{s.description || 'Keine Beschreibung'}</div>
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[8px] uppercase bg-black/[0.06] px-1 py-0.5 rounded text-text-muted">
                              {s.rules.length} Regeln
                            </span>
                            <span className="text-[8px] uppercase bg-black/[0.06] px-1 py-0.5 rounded text-text-muted">
                              {s.direction}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => { setData(prev => ({ ...prev, setupId: '' })); setStep(1); }}
                    className="mt-3 text-[10px] text-text-muted hover:text-text-primary"
                  >
                    Ohne Setup fortfahren →
                  </button>
                </div>
              )}

              {/* Step 1: Direction */}
              {step === 1 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">Richtung</h3>
                  <p className="text-[10px] text-text-muted mb-4">Long oder Short?</p>

                  <div className="flex gap-4">
                    {(['long', 'short'] as const).map(dir => (
                      <button
                        key={dir}
                        onClick={() => setData(prev => ({ ...prev, direction: dir }))}
                        className={clsx(
                          'flex-1 py-8 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                          data.direction === dir
                            ? dir === 'long'
                              ? 'border-pnl-positive bg-pnl-positive/10'
                              : 'border-pnl-negative bg-pnl-negative/10'
                            : 'border-black/[0.06] hover:border-black/[0.15]'
                        )}
                      >
                        {dir === 'long' ? <TrendingUp size={32} className="text-pnl-positive" /> : <TrendingDown size={32} className="text-pnl-negative" />}
                        <span className={clsx('text-lg font-bold', dir === 'long' ? 'text-pnl-positive' : 'text-pnl-negative')}>
                          {dir.toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Confluences */}
              {step === 2 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">Confluences</h3>
                  <p className="text-[10px] text-text-muted mb-4">Welche Faktoren unterstützen diesen Trade?</p>

                  <div className="flex flex-wrap gap-2">
                    {allConfluences.map(c => (
                      <button
                        key={c}
                        onClick={() => setData(prev => ({
                          ...prev,
                          confluences: prev.confluences.includes(c)
                            ? prev.confluences.filter(x => x !== c)
                            : [...prev.confluences, c]
                        }))}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                          data.confluences.includes(c)
                            ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
                            : 'border-black/[0.06] text-text-muted hover:text-text-primary hover:bg-black/[0.04]'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  {data.confluences.length > 0 && (
                    <div className="mt-3 text-[10px] text-text-muted">
                      {data.confluences.length} ausgewählt: {data.confluences.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Fundamental */}
              {step === 3 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">Fundamentale Einschätzung</h3>
                  <p className="text-[10px] text-text-muted mb-4">Wie sieht es fundamental aus?</p>

                  <textarea
                    value={data.fundamentalOutlook}
                    onChange={e => setData(prev => ({ ...prev, fundamentalOutlook: e.target.value }))}
                    placeholder="Währungsstärke, Zinsentscheid, News-Events, Saisonalität..."
                    className="input min-h-[120px] text-sm"
                    rows={5}
                  />
                </div>
              )}

              {/* Step 4: Strategy Checklist */}
              {step === 4 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">Strategie-Checkliste</h3>
                  <p className="text-[10px] text-text-muted mb-4">
                    {selectedStrategy ? `${selectedStrategy.name} — alle Regeln eingehalten?` : 'Kein Setup ausgewählt'}
                  </p>

                  {data.strategyChecklist.length === 0 ? (
                    <div className="p-4 bg-black/[0.02] rounded-lg border border-black/[0.06] text-center">
                      <p className="text-xs text-text-muted">Keine Regeln vorhanden. Überspringe diesen Schritt.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {['entry', 'filter', 'exit', 'risk'].map(type => {
                        const items = data.strategyChecklist.filter(i => i.type === type);
                        if (items.length === 0) return null;
                        return (
                          <div key={type}>
                            <div className="text-[9px] uppercase tracking-[0.1em] text-text-muted font-semibold mb-1.5">
                              {type === 'entry' ? 'Entry-Regeln' : type === 'filter' ? 'Filter' : type === 'exit' ? 'Exit-Regeln' : 'Risiko'}
                            </div>
                            <div className="space-y-1">
                              {items.map(item => (
                                <label
                                  key={item.ruleId}
                                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/[0.03] cursor-pointer"
                                >
                                  <div
                                    onClick={() => toggleChecklist(item.ruleId)}
                                    className={clsx(
                                      'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors',
                                      item.checked ? 'bg-pnl-positive' : 'bg-black/[0.06] border border-black/[0.1]'
                                    )}
                                  >
                                    {item.checked && <Check size={12} className="text-white" />}
                                  </div>
                                  <span className={clsx('text-xs', item.checked ? 'text-text-primary' : 'text-text-muted')}>
                                    {item.text}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Summary */}
                      <div className="mt-2 pt-2 border-t border-black/[0.04] text-[10px] text-text-muted">
                        {data.strategyChecklist.filter(i => i.checked).length} / {data.strategyChecklist.length} Regeln erfüllt
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Details (These, Confidence, Targets) */}
              {step === 5 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-4">Details & Abschluss</h3>

                  <div className="space-y-4">
                    {/* Thesis */}
                    <div>
                      <label className="input-label">Trading-These</label>
                      <textarea
                        value={data.thesis}
                        onChange={e => setData(prev => ({ ...prev, thesis: e.target.value }))}
                        placeholder="Warum willst du diesen Trade nehmen?"
                        className="input min-h-[80px] text-sm"
                        rows={3}
                      />
                    </div>

                    {/* Confidence */}
                    <div>
                      <label className="input-label">Konfidenz</label>
                      <div className="flex items-center gap-1">
                        {([1, 2, 3, 4, 5] as const).map(level => (
                          <button
                            key={level}
                            onClick={() => setData(prev => ({ ...prev, confidence: level }))}
                            className={clsx(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors',
                              level <= data.confidence ? 'bg-accent-primary text-white' : 'bg-black/[0.06] text-text-muted'
                            )}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price Targets */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="input-label">Entry</label>
                        <input
                          type="number"
                          step="0.00001"
                          value={data.targetEntry ?? ''}
                          onChange={e => setData(prev => ({ ...prev, targetEntry: e.target.value ? Number(e.target.value) : undefined }))}
                          className="input text-sm font-mono"
                          placeholder="1.08500"
                        />
                      </div>
                      <div>
                        <label className="input-label">Stop Loss</label>
                        <input
                          type="number"
                          step="0.00001"
                          value={data.targetSL ?? ''}
                          onChange={e => setData(prev => ({ ...prev, targetSL: e.target.value ? Number(e.target.value) : undefined }))}
                          className="input text-sm font-mono"
                          placeholder="1.08200"
                        />
                      </div>
                      <div>
                        <label className="input-label">Take Profit</label>
                        <input
                          type="number"
                          step="0.00001"
                          value={data.targetTP ?? ''}
                          onChange={e => setData(prev => ({ ...prev, targetTP: e.target.value ? Number(e.target.value) : undefined }))}
                          className="input text-sm font-mono"
                          placeholder="1.09200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border">
          <div className="text-[10px] text-text-muted">
            Schritt {step + 1} von {STEPS.length}: <span className="text-text-secondary font-semibold">{STEPS[step]}</span>
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={handleBack} className="btn-secondary flex items-center gap-1.5">
                <ChevronLeft size={14} /> Zurück
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className="btn-primary flex items-center gap-1.5"
            >
              {step === STEPS.length - 1 ? (
                <>
                  <Check size={14} /> {existingOutlook ? 'Aktualisieren' : 'Outlook erstellen'}
                </>
              ) : (
                <>
                  Weiter <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
