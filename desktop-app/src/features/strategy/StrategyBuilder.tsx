/**
 * Strategy Builder - Kanban-style with visual rule chips
 */

import { useState, useEffect } from 'react';
import {
  Lightbulb,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Save,
  X,
  Copy,
  BarChart3,
  Clock,
  Zap,
  Image as ImageIcon
} from 'lucide-react';
import { clsx } from 'clsx';
import { PageTransition } from '@/shared/ui/PageTransition';
import {
  loadStrategies as svcLoadStrategies,
  saveStrategy as svcSaveStrategy,
  removeStrategy as svcRemoveStrategy,
  type StrategyRecord,
} from '@/shared/services/strategyService';

interface StrategyRule {
  id: string;
  text: string;
  type: 'entry' | 'exit' | 'filter' | 'risk';
  required: boolean;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  timeframes: string[];
  pairs: string[];
  direction: 'long' | 'short' | 'both';
  rules: StrategyRule[];
  notes: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

/** Verkleinert ein Bild (DataURL) für kompakte Speicherung. */
function downscaleImage(src: string, maxPx = 1100, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(src); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve(canvas.toDataURL('image/jpeg', quality)); } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

// Mapping StrategyBuilder.Strategy <-> strategyService.StrategyRecord (Supabase)
function recordToStrategy(r: any): Strategy {
  return {
    id: r.id,
    name: r.name || '',
    description: r.description || '',
    timeframes: Array.isArray(r.timeframes) ? r.timeframes : [],
    pairs: Array.isArray(r.pairs) ? r.pairs : [],
    direction: r.direction || 'both',
    rules: Array.isArray(r.rules) ? r.rules : [],
    notes: r.notes || '',
    images: Array.isArray(r.images) ? r.images : [],
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt || new Date().toISOString(),
    isActive: r.isActive ?? true,
  };
}
function strategyToRecord(s: Strategy): StrategyRecord {
  return {
    id: isUuid(s.id) ? s.id : undefined,
    name: s.name,
    description: s.description,
    timeframes: s.timeframes,
    pairs: s.pairs,
    direction: s.direction,
    rules: s.rules,
    notes: s.notes,
    images: s.images,
    isActive: s.isActive,
  };
}
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

const RULE_TEMPLATES = {
  entry: [
    'Preis bricht über/unter wichtige Struktur',
    'Bestätigung durch höhere Zeiteinheit',
    'Klar erkennbarer Trend vorhanden',
    'Liquidity Sweep abgeschlossen',
    'Fair Value Gap als Entry-Zone',
    'Order Block Reaktion',
    'Divergenz im RSI/MACD',
    'Volumen bestätigt Bewegung',
  ],
  exit: [
    'Take Profit bei nächstem Widerstand/Unterstützung',
    'Trailing Stop aktivieren nach +1R',
    'Exit bei Gegensignal',
    'Zeit-basierter Exit (z.B. vor News)',
    'Partial Close bei +2R',
  ],
  filter: [
    'Kein Trading vor High-Impact News',
    'Nur während London/NY Session',
    'Mindestens 2 Zeiteinheiten stimmen überein',
    'Kein Trading am Freitag Nachmittag',
    'DXY Richtung bestätigt Trade',
  ],
  risk: [
    'Maximales Risiko: 1% pro Trade',
    'Maximaler Drawdown: 3% täglich',
    'Stop Loss hinter Struktur',
    'Mindest-RR: 1:2',
    'Maximal 2 offene Positionen',
  ],
};

const RULE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  entry: { bg: 'bg-pnl-positive/10', text: 'text-pnl-positive', dot: 'bg-pnl-positive' },
  exit: { bg: 'bg-pnl-negative/10', text: 'text-pnl-negative', dot: 'bg-pnl-negative' },
  filter: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', dot: 'bg-yellow-500' },
  risk: { bg: 'bg-accent-primary/10', text: 'text-accent-primary', dot: 'bg-accent-primary' },
};

export function StrategyBuilder() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    entry: true, exit: true, filter: true, risk: true,
  });
  const [formData, setFormData] = useState<Partial<Strategy>>({
    name: '', description: '', timeframes: [], pairs: [],
    direction: 'both', rules: [], notes: '', images: [], isActive: true,
  });

  useEffect(() => { loadStrategies(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Hybrid: localStorage als Mirror, Supabase als Quelle der Wahrheit (eingeloggt).
  const loadStrategies = async () => {
    let local: Strategy[] = [];
    try { const s = localStorage.getItem('tradingStrategies'); if (s) local = JSON.parse(s); } catch { /* ignore */ }

    try {
      const remote = await svcLoadStrategies();
      if (remote.length > 0) {
        const mapped = remote.map(recordToStrategy);
        saveStrategies(mapped);
        if (!selectedStrategy) setSelectedStrategy(mapped[0]);
        return;
      }
      // Supabase leer + lokale vorhanden → einmalige Migration hoch
      if (local.length > 0) {
        for (const s of local) {
          try { await svcSaveStrategy(strategyToRecord({ ...s, id: '' } as Strategy)); } catch { /* skip */ }
        }
        const after = await svcLoadStrategies();
        const mapped = after.length ? after.map(recordToStrategy) : local;
        saveStrategies(mapped);
        if (!selectedStrategy && mapped.length) setSelectedStrategy(mapped[0]);
        return;
      }
    } catch { /* offline / nicht eingeloggt → lokal */ }

    setStrategies(local);
    if (local.length > 0 && !selectedStrategy) setSelectedStrategy(local[0]);
  };

  // localStorage-Mirror + State
  const saveStrategies = (newStrategies: Strategy[]) => {
    localStorage.setItem('tradingStrategies', JSON.stringify(newStrategies));
    setStrategies(newStrategies);
  };

  const createStrategy = async () => {
    if (!formData.name) return;
    const newStrategy: Strategy = {
      id: Date.now().toString(),
      name: formData.name || 'Neue Strategie',
      description: formData.description || '',
      timeframes: formData.timeframes || [],
      pairs: formData.pairs || [],
      direction: formData.direction || 'both',
      rules: formData.rules || [],
      notes: formData.notes || '',
      images: formData.images || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };
    const updated = [...strategies, newStrategy];
    saveStrategies(updated);
    setSelectedStrategy(newStrategy);
    setShowNewModal(false);
    resetForm();
    try {
      const saved = await svcSaveStrategy(strategyToRecord(newStrategy));
      if (saved?.id) {
        const withId = recordToStrategy(saved);
        saveStrategies(updated.map(s => s.id === newStrategy.id ? withId : s));
        setSelectedStrategy(withId);
      }
    } catch { /* offline → bleibt lokal */ }
  };

  const updateStrategy = async () => {
    if (!selectedStrategy || !formData.name) return;
    const merged = { ...selectedStrategy, ...formData, updatedAt: new Date().toISOString() } as Strategy;
    saveStrategies(strategies.map(s => s.id === selectedStrategy.id ? merged : s));
    setSelectedStrategy(merged);
    setIsEditing(false);
    try { await svcSaveStrategy(strategyToRecord(merged)); } catch { /* offline */ }
  };

  const deleteStrategy = async (id: string) => {
    const updated = strategies.filter(s => s.id !== id);
    saveStrategies(updated);
    if (selectedStrategy?.id === id) setSelectedStrategy(updated[0] || null);
    try { if (isUuid(id)) await svcRemoveStrategy(id); } catch { /* offline */ }
  };

  const duplicateStrategy = async (strategy: Strategy) => {
    const newStrategy: Strategy = {
      ...strategy,
      id: Date.now().toString(),
      name: `${strategy.name} (Kopie)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...strategies, newStrategy];
    saveStrategies(updated);
    setSelectedStrategy(newStrategy);
    try {
      const saved = await svcSaveStrategy(strategyToRecord(newStrategy));
      if (saved?.id) {
        const withId = recordToStrategy(saved);
        saveStrategies(updated.map(s => s.id === newStrategy.id ? withId : s));
        setSelectedStrategy(withId);
      }
    } catch { /* offline */ }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', timeframes: [], pairs: [], direction: 'both', rules: [], notes: '', images: [], isActive: true });
  };

  // Bild hinzufügen (Upload oder Strg+V) + entfernen
  const addImage = async (dataUrl: string) => {
    const small = await downscaleImage(dataUrl);
    setFormData(prev => ({ ...prev, images: [...(prev.images || []), small] }));
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => addImage(reader.result as string);
    reader.readAsDataURL(file);
  };
  const removeImage = (idx: number) => {
    setFormData(prev => ({ ...prev, images: (prev.images || []).filter((_, i) => i !== idx) }));
  };

  const startEditing = () => {
    if (selectedStrategy) { setFormData(selectedStrategy); setIsEditing(true); }
  };

  const addRule = (type: StrategyRule['type'], text: string) => {
    setFormData(prev => ({
      ...prev,
      rules: [...(prev.rules || []), { id: Date.now().toString(), text, type, required: true }],
    }));
  };

  const removeRule = (ruleId: string) => {
    setFormData(prev => ({ ...prev, rules: (prev.rules || []).filter(r => r.id !== ruleId) }));
  };

  const toggleRuleRequired = (ruleId: string) => {
    setFormData(prev => ({
      ...prev,
      rules: (prev.rules || []).map(r => r.id === ruleId ? { ...r, required: !r.required } : r),
    }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getRulesForType = (type: StrategyRule['type']) => {
    return (isEditing ? formData.rules : selectedStrategy?.rules)?.filter(r => r.type === type) || [];
  };

  const getRuleTypeLabel = (type: StrategyRule['type']) => {
    switch (type) {
      case 'entry': return 'Entry';
      case 'exit': return 'Exit';
      case 'filter': return 'Filter';
      case 'risk': return 'Risk';
    }
  };

  const getRuleTypeIcon = (type: StrategyRule['type']) => {
    switch (type) {
      case 'entry': return <Target size={14} className="text-pnl-positive" />;
      case 'exit': return <TrendingDown size={14} className="text-pnl-negative" />;
      case 'filter': return <AlertTriangle size={14} className="text-yellow-500" />;
      case 'risk': return <Zap size={14} className="text-accent-primary" />;
    }
  };

  // Group strategies by status for kanban view
  const activeStrategies = strategies.filter(s => s.isActive);
  const inactiveStrategies = strategies.filter(s => !s.isActive);

  return (
    <PageTransition>
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Lightbulb size={20} className="text-accent-primary" />
          <h1 className="text-xl font-bold text-text-primary">Strategien</h1>
          <span className="text-xs text-text-muted">{strategies.length} gesamt</span>
        </div>
        <button
          onClick={() => { resetForm(); setShowNewModal(true); }}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={15} />
          Neue Strategie
        </button>
      </div>

      {/* Kanban-style columns */}
      <div className="grid grid-cols-12 gap-5">
        {/* Strategy Cards - Left Panel */}
        <div className="col-span-4 space-y-4">
          {/* Active Column */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-pnl-positive" />
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Aktiv ({activeStrategies.length})
              </span>
            </div>
            <div className="space-y-2">
              {activeStrategies.map(strategy => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  isSelected={selectedStrategy?.id === strategy.id}
                  onClick={() => { setSelectedStrategy(strategy); setIsEditing(false); }}
                />
              ))}
            </div>
          </div>

          {/* Inactive Column */}
          {inactiveStrategies.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-text-muted/40" />
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Inaktiv ({inactiveStrategies.length})
                </span>
              </div>
              <div className="space-y-2">
                {inactiveStrategies.map(strategy => (
                  <StrategyCard
                    key={strategy.id}
                    strategy={strategy}
                    isSelected={selectedStrategy?.id === strategy.id}
                    onClick={() => { setSelectedStrategy(strategy); setIsEditing(false); }}
                  />
                ))}
              </div>
            </div>
          )}

          {strategies.length === 0 && (
            <div className="rounded-xl bg-background-surface border border-border text-center py-10">
              <Lightbulb size={32} className="mx-auto mb-2 text-text-muted/30" />
              <p className="text-sm text-text-muted">Noch keine Strategien</p>
              <button
                onClick={() => { resetForm(); setShowNewModal(true); }}
                className="mt-2 text-accent-primary hover:underline text-xs"
              >
                Erste erstellen
              </button>
            </div>
          )}
        </div>

        {/* Strategy Detail - Right Panel */}
        <div className="col-span-8">
          {selectedStrategy ? (
            <div className="rounded-xl bg-background-surface border border-border p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="text-lg font-bold bg-transparent border-b border-accent-primary/50 outline-none text-text-primary pb-0.5"
                    placeholder="Strategiename"
                  />
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">{selectedStrategy.name}</h2>
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        selectedStrategy.isActive ? 'bg-pnl-positive/15 text-pnl-positive' : 'bg-white/[0.05] text-text-muted'
                      )}>
                        {selectedStrategy.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    {selectedStrategy.description && (
                      <p className="text-xs text-text-muted mt-0.5">{selectedStrategy.description}</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <button onClick={() => setIsEditing(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted">
                        <X size={16} />
                      </button>
                      <button onClick={updateStrategy} className="btn-primary flex items-center gap-1.5 text-sm">
                        <Save size={14} />
                        Speichern
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => duplicateStrategy(selectedStrategy)} className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted" title="Duplizieren">
                        <Copy size={15} />
                      </button>
                      <button onClick={startEditing} className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted" title="Bearbeiten">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => deleteStrategy(selectedStrategy.id)} className="p-1.5 rounded-lg hover:bg-white/5 text-pnl-negative" title="Löschen">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Description edit */}
              {isEditing && (
                <div className="mb-4">
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="input w-full h-16 resize-none text-sm"
                    placeholder="Beschreibung..."
                  />
                </div>
              )}

              {/* Settings chips row */}
              <div className="flex items-center gap-4 mb-5 pb-4 border-b border-border/50">
                {/* Timeframes */}
                <div className="flex-1">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock size={10} /> Zeiteinheiten
                  </div>
                  {isEditing ? (
                    <div className="flex flex-wrap gap-1">
                      {TIMEFRAMES.map(tf => (
                        <button
                          key={tf}
                          onClick={() => {
                            const current = formData.timeframes || [];
                            setFormData(prev => ({
                              ...prev,
                              timeframes: current.includes(tf) ? current.filter(t => t !== tf) : [...current, tf]
                            }));
                          }}
                          className={clsx(
                            'px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors',
                            (formData.timeframes || []).includes(tf)
                              ? 'bg-accent-primary text-white'
                              : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
                          )}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {selectedStrategy.timeframes.length > 0 ? selectedStrategy.timeframes.map(tf => (
                        <span key={tf} className="px-2 py-0.5 text-[10px] rounded-md bg-accent-primary/15 text-accent-primary font-medium">
                          {tf}
                        </span>
                      )) : (
                        <span className="text-[10px] text-text-muted">-</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Direction */}
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <BarChart3 size={10} /> Richtung
                  </div>
                  {isEditing ? (
                    <div className="flex gap-1">
                      {(['long', 'short', 'both'] as const).map(dir => (
                        <button
                          key={dir}
                          onClick={() => setFormData(prev => ({ ...prev, direction: dir }))}
                          className={clsx(
                            'px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors flex items-center gap-1',
                            formData.direction === dir
                              ? dir === 'long' ? 'bg-pnl-positive text-white' :
                                dir === 'short' ? 'bg-pnl-negative text-white' :
                                'bg-accent-primary text-white'
                              : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
                          )}
                        >
                          {dir === 'long' && <TrendingUp size={10} />}
                          {dir === 'short' && <TrendingDown size={10} />}
                          {dir === 'both' ? 'Beide' : dir.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={clsx(
                      'px-2 py-0.5 text-[10px] rounded-md font-medium inline-flex items-center gap-1',
                      selectedStrategy.direction === 'long' && 'bg-pnl-positive/15 text-pnl-positive',
                      selectedStrategy.direction === 'short' && 'bg-pnl-negative/15 text-pnl-negative',
                      selectedStrategy.direction === 'both' && 'bg-accent-primary/15 text-accent-primary'
                    )}>
                      {selectedStrategy.direction === 'long' && <TrendingUp size={10} />}
                      {selectedStrategy.direction === 'short' && <TrendingDown size={10} />}
                      {selectedStrategy.direction === 'both' ? 'Long & Short' : selectedStrategy.direction.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Status toggle (edit mode) */}
                {isEditing && (
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Status</div>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                      className={clsx(
                        'px-2 py-0.5 text-[10px] rounded-md font-medium transition-colors',
                        formData.isActive ? 'bg-pnl-positive/15 text-pnl-positive' : 'bg-white/[0.04] text-text-muted'
                      )}
                    >
                      {formData.isActive ? 'Aktiv' : 'Inaktiv'}
                    </button>
                  </div>
                )}
              </div>

              {/* Rules as 2x2 grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {(['entry', 'exit', 'filter', 'risk'] as const).map(type => {
                  const rules = getRulesForType(type);
                  const colors = RULE_COLORS[type];

                  return (
                    <div key={type} className="rounded-lg bg-white/[0.02] border border-white/[0.04] overflow-hidden">
                      <button
                        onClick={() => toggleSection(type)}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {getRuleTypeIcon(type)}
                          <span className="text-xs font-semibold">{getRuleTypeLabel(type)}</span>
                          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full', colors.bg, colors.text)}>
                            {rules.length}
                          </span>
                        </div>
                        {expandedSections[type] ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                      </button>

                      {expandedSections[type] && (
                        <div className="px-3 pb-3 space-y-1.5">
                          {rules.map(rule => (
                            <div key={rule.id} className="flex items-center gap-2 group">
                              <button
                                onClick={() => isEditing && toggleRuleRequired(rule.id)}
                                disabled={!isEditing}
                                className={clsx('flex-shrink-0', rule.required ? colors.text : 'text-text-muted/40')}
                              >
                                {rule.required ? <CheckSquare size={14} /> : <Square size={14} />}
                              </button>
                              <span className={clsx(
                                'flex-1 text-xs',
                                !rule.required && 'text-text-muted line-through'
                              )}>
                                {rule.text}
                              </span>
                              {isEditing && (
                                <button
                                  onClick={() => removeRule(rule.id)}
                                  className="opacity-0 group-hover:opacity-100 text-pnl-negative p-0.5"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          ))}

                          {rules.length === 0 && !isEditing && (
                            <p className="text-[10px] text-text-muted py-1">Keine Regeln</p>
                          )}

                          {isEditing && (
                            <div className="pt-1.5 mt-1 border-t border-white/[0.04]">
                              <div className="flex flex-wrap gap-1 mb-1.5">
                                {RULE_TEMPLATES[type].slice(0, 3).map((template, i) => (
                                  <button
                                    key={i}
                                    onClick={() => addRule(type, template)}
                                    className="px-1.5 py-0.5 text-[9px] rounded bg-white/[0.03] text-text-muted hover:bg-white/[0.06] hover:text-text-primary transition-colors truncate max-w-[140px]"
                                    title={template}
                                  >
                                    + {template.slice(0, 25)}...
                                  </button>
                                ))}
                              </div>
                              <input
                                type="text"
                                placeholder="Eigene Regel..."
                                className="input w-full text-xs py-1.5"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.currentTarget.value) {
                                    addRule(type, e.currentTarget.value);
                                    e.currentTarget.value = '';
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Notes */}
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Notizen</div>
                {isEditing ? (
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="input w-full h-24 resize-none text-sm"
                    placeholder="Backtesting-Ergebnisse, Beobachtungen..."
                  />
                ) : (
                  <div className="p-3 rounded-lg bg-white/[0.02] text-xs text-text-secondary whitespace-pre-wrap min-h-[60px]">
                    {selectedStrategy.notes || <span className="text-text-muted">Keine Notizen</span>}
                  </div>
                )}
              </div>

              {/* Bilder */}
              <div className="mt-4">
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Bilder</div>
                {isEditing ? (
                  <div
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      for (const it of items || []) {
                        if (it.type.startsWith('image/')) {
                          const f = it.getAsFile();
                          if (f) { const r = new FileReader(); r.onloadend = () => addImage(r.result as string); r.readAsDataURL(f); }
                        }
                      }
                    }}
                  >
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(formData.images || []).map((img, i) => (
                        <div key={i} className="relative">
                          <img src={img} alt="" className="h-20 w-28 object-cover rounded border border-border" />
                          <button type="button" onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 p-0.5 bg-pnl-negative rounded-full text-white">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <label className="btn-secondary text-xs cursor-pointer inline-flex items-center">
                      <ImageIcon size={13} className="inline mr-1" /> Bild hinzufügen (oder Strg+V)
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                ) : (
                  (selectedStrategy.images && selectedStrategy.images.length > 0) ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedStrategy.images.map((img, i) => (
                        <img key={i} src={img} alt="" className="h-24 w-32 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                          onClick={() => window.open(img, '_blank')} />
                      ))}
                    </div>
                  ) : <span className="text-xs text-text-muted">Keine Bilder</span>
                )}
              </div>

              {/* Meta */}
              <div className="mt-3 pt-3 border-t border-border/30 flex justify-between text-[10px] text-text-muted">
                <span>Erstellt: {new Date(selectedStrategy.createdAt).toLocaleDateString('de-DE')}</span>
                <span>Aktualisiert: {new Date(selectedStrategy.updatedAt).toLocaleDateString('de-DE')}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-background-surface border border-border text-center py-20">
              <Lightbulb size={48} className="mx-auto mb-3 text-text-muted/20" />
              <h3 className="text-sm font-semibold mb-1">Keine Strategie ausgewählt</h3>
              <p className="text-xs text-text-muted mb-4">Wähle links eine aus oder erstelle eine neue</p>
              <button
                onClick={() => { resetForm(); setShowNewModal(true); }}
                className="btn-primary text-sm"
              >
                <Plus size={14} className="inline mr-1.5" />
                Neue Strategie
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Strategy Modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-background-surface border border-border p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold">Neue Strategie</h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 rounded-lg hover:bg-white/5 text-text-muted">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full"
                  placeholder="z.B. ICT Silver Bullet"
                />
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Beschreibung</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full h-16 resize-none text-sm"
                  placeholder="Kurze Beschreibung..."
                />
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Zeiteinheiten</label>
                <div className="flex flex-wrap gap-1">
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf}
                      onClick={() => {
                        const current = formData.timeframes || [];
                        setFormData(prev => ({
                          ...prev,
                          timeframes: current.includes(tf) ? current.filter(t => t !== tf) : [...current, tf]
                        }));
                      }}
                      className={clsx(
                        'px-2.5 py-1 text-xs rounded-md transition-colors',
                        (formData.timeframes || []).includes(tf)
                          ? 'bg-accent-primary text-white'
                          : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
                      )}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Richtung</label>
                <div className="flex gap-1.5">
                  {(['long', 'short', 'both'] as const).map(dir => (
                    <button
                      key={dir}
                      onClick={() => setFormData(prev => ({ ...prev, direction: dir }))}
                      className={clsx(
                        'px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5',
                        formData.direction === dir
                          ? dir === 'long' ? 'bg-pnl-positive text-white' :
                            dir === 'short' ? 'bg-pnl-negative text-white' :
                            'bg-accent-primary text-white'
                          : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
                      )}
                    >
                      {dir === 'long' && <TrendingUp size={13} />}
                      {dir === 'short' && <TrendingDown size={13} />}
                      {dir === 'both' ? 'Long & Short' : dir.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border/50">
              <button onClick={() => setShowNewModal(false)} className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary">
                Abbrechen
              </button>
              <button
                onClick={createStrategy}
                disabled={!formData.name}
                className="btn-primary text-sm"
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}

/** Compact strategy card for the sidebar */
function StrategyCard({ strategy, isSelected, onClick }: {
  strategy: Strategy;
  isSelected: boolean;
  onClick: () => void;
}) {
  const ruleCount = strategy.rules.length;
  const typeBreakdown = {
    entry: strategy.rules.filter(r => r.type === 'entry').length,
    exit: strategy.rules.filter(r => r.type === 'exit').length,
    filter: strategy.rules.filter(r => r.type === 'filter').length,
    risk: strategy.rules.filter(r => r.type === 'risk').length,
  };

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left p-3 rounded-lg transition-all border',
        isSelected
          ? 'bg-accent-primary/5 border-accent-primary/30'
          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold truncate">{strategy.name}</span>
        {strategy.direction !== 'both' && (
          <span className={clsx(
            'text-[9px] px-1.5 py-0.5 rounded font-medium',
            strategy.direction === 'long' ? 'bg-pnl-positive/15 text-pnl-positive' : 'bg-pnl-negative/15 text-pnl-negative'
          )}>
            {strategy.direction.toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-text-muted">
        <span>{strategy.timeframes.join(' ') || 'Keine TF'}</span>
        <span>·</span>
        <span>{ruleCount} Regeln</span>
      </div>
      {/* Rule type dots */}
      <div className="flex items-center gap-1 mt-1.5">
        {Object.entries(typeBreakdown).map(([type, count]) => (
          count > 0 && (
            <div key={type} className="flex items-center gap-0.5">
              <div className={clsx('w-1.5 h-1.5 rounded-full', RULE_COLORS[type].dot)} />
              <span className="text-[9px] text-text-muted">{count}</span>
            </div>
          )
        ))}
      </div>
    </button>
  );
}
