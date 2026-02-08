/**
 * ========================================================================
 * Trading Journal - Strategy Builder
 * ========================================================================
 * 
 * Eigene Trading-Strategien entwickeln und dokumentieren:
 * - Strategie-Definition (Regeln, Entry, Exit)
 * - Checklisten für Setups
 * - Backtesting-Notizen
 * - Performance-Tracking
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
  Zap
} from 'lucide-react';
import { clsx } from 'clsx';

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
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

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

export function StrategyBuilder() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    entry: true,
    exit: true,
    filter: true,
    risk: true,
  });

  // Form state
  const [formData, setFormData] = useState<Partial<Strategy>>({
    name: '',
    description: '',
    timeframes: [],
    pairs: [],
    direction: 'both',
    rules: [],
    notes: '',
    isActive: true,
  });

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = () => {
    const saved = localStorage.getItem('tradingStrategies');
    if (saved) {
      const parsed = JSON.parse(saved);
      setStrategies(parsed);
      if (parsed.length > 0 && !selectedStrategy) {
        setSelectedStrategy(parsed[0]);
      }
    }
  };

  const saveStrategies = (newStrategies: Strategy[]) => {
    localStorage.setItem('tradingStrategies', JSON.stringify(newStrategies));
    setStrategies(newStrategies);
  };

  const createStrategy = () => {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };

    const updated = [...strategies, newStrategy];
    saveStrategies(updated);
    setSelectedStrategy(newStrategy);
    setShowNewModal(false);
    resetForm();
  };

  const updateStrategy = () => {
    if (!selectedStrategy || !formData.name) return;

    const updated = strategies.map(s => 
      s.id === selectedStrategy.id 
        ? { ...s, ...formData, updatedAt: new Date().toISOString() }
        : s
    );
    saveStrategies(updated);
    setSelectedStrategy({ ...selectedStrategy, ...formData, updatedAt: new Date().toISOString() } as Strategy);
    setIsEditing(false);
  };

  const deleteStrategy = (id: string) => {
    const updated = strategies.filter(s => s.id !== id);
    saveStrategies(updated);
    if (selectedStrategy?.id === id) {
      setSelectedStrategy(updated[0] || null);
    }
  };

  const duplicateStrategy = (strategy: Strategy) => {
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
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      timeframes: [],
      pairs: [],
      direction: 'both',
      rules: [],
      notes: '',
      isActive: true,
    });
  };

  const startEditing = () => {
    if (selectedStrategy) {
      setFormData(selectedStrategy);
      setIsEditing(true);
    }
  };

  const addRule = (type: StrategyRule['type'], text: string) => {
    const newRule: StrategyRule = {
      id: Date.now().toString(),
      text,
      type,
      required: true,
    };
    setFormData(prev => ({
      ...prev,
      rules: [...(prev.rules || []), newRule],
    }));
  };

  const removeRule = (ruleId: string) => {
    setFormData(prev => ({
      ...prev,
      rules: (prev.rules || []).filter(r => r.id !== ruleId),
    }));
  };

  const toggleRuleRequired = (ruleId: string) => {
    setFormData(prev => ({
      ...prev,
      rules: (prev.rules || []).map(r => 
        r.id === ruleId ? { ...r, required: !r.required } : r
      ),
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
      case 'entry': return 'Entry-Regeln';
      case 'exit': return 'Exit-Regeln';
      case 'filter': return 'Filter';
      case 'risk': return 'Risikomanagement';
    }
  };

  const getRuleTypeIcon = (type: StrategyRule['type']) => {
    switch (type) {
      case 'entry': return <Target size={16} className="text-pnl-positive" />;
      case 'exit': return <TrendingDown size={16} className="text-pnl-negative" />;
      case 'filter': return <AlertTriangle size={16} className="text-yellow-500" />;
      case 'risk': return <Zap size={16} className="text-accent-primary" />;
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <Lightbulb className="text-accent-primary" />
          Strategie-Entwicklung
        </h1>
        
        <button
          onClick={() => { resetForm(); setShowNewModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Neue Strategie
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Strategy List */}
        <div className="col-span-1 space-y-3">
          <div className="text-sm text-text-muted mb-2">Deine Strategien</div>
          
          {strategies.length === 0 ? (
            <div className="card text-center py-8">
              <Lightbulb size={40} className="mx-auto mb-3 text-text-muted opacity-50" />
              <p className="text-text-muted text-sm">Noch keine Strategien erstellt</p>
              <button
                onClick={() => { resetForm(); setShowNewModal(true); }}
                className="mt-3 text-accent-primary hover:underline text-sm"
              >
                Erste Strategie erstellen
              </button>
            </div>
          ) : (
            strategies.map(strategy => (
              <button
                key={strategy.id}
                onClick={() => { setSelectedStrategy(strategy); setIsEditing(false); }}
                className={clsx(
                  'w-full text-left p-4 rounded-lg transition-all',
                  'bg-glass-white hover:bg-glass-white',
                  selectedStrategy?.id === strategy.id && 'ring-2 ring-accent-primary'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold truncate">{strategy.name}</span>
                  {strategy.isActive && (
                    <div className="w-2 h-2 rounded-full bg-pnl-positive" />
                  )}
                </div>
                <div className="text-xs text-text-muted truncate">
                  {strategy.timeframes.join(', ') || 'Keine Zeiteinheiten'}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  {strategy.rules.length} Regeln
                </div>
              </button>
            ))
          )}
        </div>

        {/* Strategy Detail */}
        <div className="col-span-3">
          {selectedStrategy ? (
            <div className="card">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field text-xl font-bold bg-transparent border-none p-0"
                    placeholder="Strategiename"
                  />
                ) : (
                  <div>
                    <h2 className="text-xl font-bold">{selectedStrategy.name}</h2>
                    <p className="text-sm text-text-muted">{selectedStrategy.description || 'Keine Beschreibung'}</p>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button onClick={() => setIsEditing(false)} className="btn-icon">
                        <X size={18} />
                      </button>
                      <button onClick={updateStrategy} className="btn-primary flex items-center gap-2">
                        <Save size={18} />
                        Speichern
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => duplicateStrategy(selectedStrategy)} className="btn-icon" title="Duplizieren">
                        <Copy size={18} />
                      </button>
                      <button onClick={startEditing} className="btn-icon" title="Bearbeiten">
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => deleteStrategy(selectedStrategy.id)} 
                        className="btn-icon text-pnl-negative"
                        title="Löschen"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Description (Edit Mode) */}
              {isEditing && (
                <div className="mb-6">
                  <label className="block text-sm text-text-muted mb-2">Beschreibung</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="input-field w-full h-20 resize-none"
                    placeholder="Kurze Beschreibung der Strategie..."
                  />
                </div>
              )}

              {/* Settings Row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Timeframes */}
                <div>
                  <label className="block text-sm text-text-muted mb-2">
                    <Clock size={14} className="inline mr-1" />
                    Zeiteinheiten
                  </label>
                  {isEditing ? (
                    <div className="flex flex-wrap gap-1">
                      {TIMEFRAMES.map(tf => (
                        <button
                          key={tf}
                          onClick={() => {
                            const current = formData.timeframes || [];
                            setFormData(prev => ({
                              ...prev,
                              timeframes: current.includes(tf) 
                                ? current.filter(t => t !== tf)
                                : [...current, tf]
                            }));
                          }}
                          className={clsx(
                            'px-2 py-1 text-xs rounded transition-all',
                            (formData.timeframes || []).includes(tf)
                              ? 'bg-accent-primary text-white'
                              : 'bg-background-surface text-text-muted hover:bg-background-surface-hover'
                          )}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {selectedStrategy.timeframes.map(tf => (
                        <span key={tf} className="px-2 py-1 text-xs rounded bg-accent-primary/20 text-accent-primary">
                          {tf}
                        </span>
                      ))}
                      {selectedStrategy.timeframes.length === 0 && (
                        <span className="text-xs text-text-muted">Keine definiert</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Direction */}
                <div>
                  <label className="block text-sm text-text-muted mb-2">
                    <BarChart3 size={14} className="inline mr-1" />
                    Richtung
                  </label>
                  {isEditing ? (
                    <div className="flex gap-1">
                      {(['long', 'short', 'both'] as const).map(dir => (
                        <button
                          key={dir}
                          onClick={() => setFormData(prev => ({ ...prev, direction: dir }))}
                          className={clsx(
                            'px-3 py-1.5 text-xs rounded transition-all flex items-center gap-1',
                            formData.direction === dir
                              ? dir === 'long' ? 'bg-pnl-positive text-white' :
                                dir === 'short' ? 'bg-pnl-negative text-white' :
                                'bg-accent-primary text-white'
                              : 'bg-background-surface text-text-muted hover:bg-background-surface-hover'
                          )}
                        >
                          {dir === 'long' && <TrendingUp size={12} />}
                          {dir === 'short' && <TrendingDown size={12} />}
                          {dir === 'both' && '↕'}
                          {dir === 'both' ? 'Beide' : dir.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={clsx(
                      'px-3 py-1.5 text-xs rounded inline-flex items-center gap-1',
                      selectedStrategy.direction === 'long' && 'bg-pnl-positive/20 text-pnl-positive',
                      selectedStrategy.direction === 'short' && 'bg-pnl-negative/20 text-pnl-negative',
                      selectedStrategy.direction === 'both' && 'bg-accent-primary/20 text-accent-primary'
                    )}>
                      {selectedStrategy.direction === 'long' && <TrendingUp size={12} />}
                      {selectedStrategy.direction === 'short' && <TrendingDown size={12} />}
                      {selectedStrategy.direction === 'both' ? 'Long & Short' : selectedStrategy.direction.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm text-text-muted mb-2">Status</label>
                  {isEditing ? (
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                      className={clsx(
                        'px-3 py-1.5 text-xs rounded transition-all',
                        formData.isActive 
                          ? 'bg-pnl-positive/20 text-pnl-positive'
                          : 'bg-gray-500/20 text-gray-400'
                      )}
                    >
                      {formData.isActive ? 'Aktiv' : 'Inaktiv'}
                    </button>
                  ) : (
                    <span className={clsx(
                      'px-3 py-1.5 text-xs rounded',
                      selectedStrategy.isActive 
                        ? 'bg-pnl-positive/20 text-pnl-positive'
                        : 'bg-gray-500/20 text-gray-400'
                    )}>
                      {selectedStrategy.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  )}
                </div>
              </div>

              {/* Rules Sections */}
              <div className="space-y-4">
                {(['entry', 'exit', 'filter', 'risk'] as const).map(type => (
                  <div key={type} className="rounded-lg bg-background-surface overflow-hidden">
                    <button
                      onClick={() => toggleSection(type)}
                      className="w-full p-3 flex items-center justify-between hover:bg-background-surface-hover transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {getRuleTypeIcon(type)}
                        <span className="font-semibold">{getRuleTypeLabel(type)}</span>
                        <span className="text-xs text-text-muted">({getRulesForType(type).length})</span>
                      </div>
                      {expandedSections[type] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    
                    {expandedSections[type] && (
                      <div className="p-3 pt-0 space-y-2">
                        {getRulesForType(type).map(rule => (
                          <div 
                            key={rule.id}
                            className="flex items-center gap-3 p-2 rounded bg-background hover:bg-background-surface-hover transition-colors"
                          >
                            <button
                              onClick={() => isEditing && toggleRuleRequired(rule.id)}
                              disabled={!isEditing}
                              className={clsx(
                                'transition-colors',
                                rule.required ? 'text-pnl-positive' : 'text-text-muted'
                              )}
                            >
                              {rule.required ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                            <span className={clsx(
                              'flex-1 text-sm',
                              !rule.required && 'text-text-muted'
                            )}>
                              {rule.text}
                            </span>
                            {isEditing && (
                              <button
                                onClick={() => removeRule(rule.id)}
                                className="text-pnl-negative hover:bg-pnl-negative/20 p-1 rounded"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                        
                        {getRulesForType(type).length === 0 && !isEditing && (
                          <p className="text-sm text-text-muted py-2">Keine Regeln definiert</p>
                        )}

                        {isEditing && (
                          <div className="pt-2">
                            <div className="text-xs text-text-muted mb-2">Vorlagen hinzufügen:</div>
                            <div className="flex flex-wrap gap-1">
                              {RULE_TEMPLATES[type].slice(0, 4).map((template, i) => (
                                <button
                                  key={i}
                                  onClick={() => addRule(type, template)}
                                  className="px-2 py-1 text-xs rounded bg-background text-text-muted hover:bg-background-surface-hover hover:text-text-primary transition-colors"
                                >
                                  + {template.slice(0, 30)}...
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              placeholder="Eigene Regel hinzufügen..."
                              className="input-field w-full mt-2 text-sm"
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
                ))}
              </div>

              {/* Notes */}
              <div className="mt-6">
                <label className="block text-sm text-text-muted mb-2">Notizen & Beobachtungen</label>
                {isEditing ? (
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="input-field w-full h-32 resize-none"
                    placeholder="Notizen zur Strategie, Backtesting-Ergebnisse, Beobachtungen..."
                  />
                ) : (
                  <div className="p-4 rounded-lg bg-background-surface text-sm whitespace-pre-wrap">
                    {selectedStrategy.notes || 'Keine Notizen'}
                  </div>
                )}
              </div>

              {/* Meta Info */}
              <div className="mt-4 pt-4 border-t border-border flex justify-between text-xs text-text-muted">
                <span>Erstellt: {new Date(selectedStrategy.createdAt).toLocaleDateString('de-DE')}</span>
                <span>Aktualisiert: {new Date(selectedStrategy.updatedAt).toLocaleDateString('de-DE')}</span>
              </div>
            </div>
          ) : (
            <div className="card text-center py-16">
              <Lightbulb size={64} className="mx-auto mb-4 text-text-muted opacity-30" />
              <h3 className="text-lg font-semibold mb-2">Keine Strategie ausgewählt</h3>
              <p className="text-text-muted mb-4">Wähle eine Strategie aus oder erstelle eine neue</p>
              <button
                onClick={() => { resetForm(); setShowNewModal(true); }}
                className="btn-primary"
              >
                <Plus size={18} className="inline mr-2" />
                Neue Strategie erstellen
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
            className="card w-full max-w-lg animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Neue Strategie erstellen</h3>
              <button onClick={() => setShowNewModal(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field w-full"
                  placeholder="z.B. ICT Silver Bullet"
                />
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-2">Beschreibung</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input-field w-full h-20 resize-none"
                  placeholder="Kurze Beschreibung..."
                />
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-2">Zeiteinheiten</label>
                <div className="flex flex-wrap gap-1">
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf}
                      onClick={() => {
                        const current = formData.timeframes || [];
                        setFormData(prev => ({
                          ...prev,
                          timeframes: current.includes(tf) 
                            ? current.filter(t => t !== tf)
                            : [...current, tf]
                        }));
                      }}
                      className={clsx(
                        'px-3 py-1.5 text-sm rounded transition-all',
                        (formData.timeframes || []).includes(tf)
                          ? 'bg-accent-primary text-white'
                          : 'bg-background-surface text-text-muted hover:bg-background-surface-hover'
                      )}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-2">Richtung</label>
                <div className="flex gap-2">
                  {(['long', 'short', 'both'] as const).map(dir => (
                    <button
                      key={dir}
                      onClick={() => setFormData(prev => ({ ...prev, direction: dir }))}
                      className={clsx(
                        'px-4 py-2 rounded transition-all flex items-center gap-2',
                        formData.direction === dir
                          ? dir === 'long' ? 'bg-pnl-positive text-white' :
                            dir === 'short' ? 'bg-pnl-negative text-white' :
                            'bg-accent-primary text-white'
                          : 'bg-background-surface text-text-muted hover:bg-background-surface-hover'
                      )}
                    >
                      {dir === 'long' && <TrendingUp size={16} />}
                      {dir === 'short' && <TrendingDown size={16} />}
                      {dir === 'both' ? 'Long & Short' : dir.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <button onClick={() => setShowNewModal(false)} className="btn-secondary">
                Abbrechen
              </button>
              <button 
                onClick={createStrategy}
                disabled={!formData.name}
                className="btn-primary"
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
