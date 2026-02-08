/**
 * ========================================================================
 * Trading Journal - Trade Form Component
 * ========================================================================
 * 
 * Optimiert mit onChange-Handler statt useEffect für Berechnungen.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Save, Camera, Trash2, Calculator, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { clsx } from '@/utils';
import type { Trade, AccountConfig } from '@/types';
import { PAIR_LIST, SETUP_DEFINITIONS } from '@/types';
import { useAccountStore } from '@/stores/accountStore';
import { calculateRiskAmount, calculateProfitAmount } from '@/utils/calculations';
import { getApi } from '@/services/webApi';

interface TradeFormProps {
  trade?: Trade;
  accountType: 'funded' | 'ek';
  onSave: (trade: Omit<Trade, 'id'> & { id?: string }) => Promise<void>;
  onClose: () => void;
}

export function TradeForm({ trade, accountType, onSave, onClose }: TradeFormProps) {
  const isEditing = !!trade;
  
  // Account Store für Kontogröße
  const { configs, loadConfigs } = useAccountStore();
  const accountConfig: AccountConfig | null = configs?.[accountType] || null;
  
  // Check for prefill data from Outlook (sessionStorage)
  const getPrefillData = () => {
    try {
      const prefillStr = sessionStorage.getItem('tradePrefill');
      if (prefillStr) {
        sessionStorage.removeItem('tradePrefill'); // Clear after reading
        return JSON.parse(prefillStr);
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  };
  
  const [formData, setFormData] = useState<Partial<Trade>>(() => {
    const defaultRiskPercent = accountType === 'funded' ? 0.5 : 1;
    const initialRiskAmount = trade?.riskAmount || 0;
    
    // Get prefill data from Outlook if available
    const prefill = getPrefillData();
    
    return {
      date: new Date().toISOString().split('T')[0],
      pair: prefill?.pair || 'EUR/USD',
      direction: prefill?.direction || 'long',
      type: accountType,
      sessionType: 'live',
      result: 'win',
      rMultiple: 0,
      riskPercent: defaultRiskPercent,
      riskAmount: initialRiskAmount,
      profitAmount: 0,
      htfBias: false,
      d1Zone: false,
      d1Fib: false,
      h4Zone: false,
      m15Entry: false,
      notes: prefill?.notes || '',
      ...trade
    };
  });
  
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load account config on mount
  useEffect(() => {
    if (!configs) {
      loadConfigs();
    }
  }, [configs, loadConfigs]);
  
  // Update risk amount when config loads (only once, nicht als Abhängigkeit)
  useEffect(() => {
    if (accountConfig?.currentBalance && formData.riskPercent && !trade?.riskAmount) {
      const newRiskAmount = calculateRiskAmount(accountConfig.currentBalance, formData.riskPercent);
      if (newRiskAmount !== formData.riskAmount) {
        setFormData(prev => ({ ...prev, riskAmount: newRiskAmount }));
      }
    }
  }, [accountConfig?.currentBalance]); // Nur wenn Config lädt

  // Berechnung des Profits basierend auf R-Multiple und Risikobetrag
  const calculatedProfit = useMemo(() => {
    const riskAmount = formData.riskAmount || 0;
    const rMultiple = formData.rMultiple || 0;
    const result = formData.result || 'win';
    
    return calculateProfitAmount(rMultiple, riskAmount, result);
  }, [formData.riskAmount, formData.rMultiple, formData.result]);

  // Load screenshot if editing
  useEffect(() => {
    if (trade?.id) {
      const api = getApi();
      api.loadScreenshot(trade.id).then(data => {
        if (data) setScreenshot(data);
      });
    }
  }, [trade?.id]);

  // Optimierter handleChange mit integrierten Berechnungen
  const handleChange = useCallback((field: keyof Trade, value: unknown) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Bei Änderung von riskPercent -> automatisch riskAmount berechnen
      if (field === 'riskPercent' && accountConfig?.currentBalance) {
        const newRiskAmount = calculateRiskAmount(accountConfig.currentBalance, value as number);
        updated.riskAmount = newRiskAmount;
      }
      
      return updated;
    });
    
    // Clear error when field is changed
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [accountConfig?.currentBalance, errors]);

  const handleSetupToggle = (setup: string) => {
    setFormData(prev => ({
      ...prev,
      [setup]: !prev[setup as keyof Trade]
    }));
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setScreenshot(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScreenshotPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (e) => {
              setScreenshot(e.target?.result as string);
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.date) newErrors.date = 'Datum erforderlich';
    if (!formData.pair) newErrors.pair = 'Währungspaar erforderlich';
    if (formData.rMultiple === undefined || formData.rMultiple === 0) newErrors.rMultiple = 'R-Multiple erforderlich';
    if (!formData.riskPercent || formData.riskPercent <= 0) newErrors.riskPercent = 'Risiko % erforderlich';
    if (!formData.riskAmount || formData.riskAmount <= 0) newErrors.riskAmount = 'Risikobetrag erforderlich';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSaving(true);
    try {
      // Calculate profit based on result
      let rMultiple = formData.rMultiple || 0;
      if (formData.result === 'loss' && rMultiple > 0) {
        rMultiple = -Math.abs(rMultiple);
      } else if (formData.result === 'win' && rMultiple < 0) {
        rMultiple = Math.abs(rMultiple);
      } else if (formData.result === 'breakeven') {
        rMultiple = 0;
      }

      // Berechne den finalen Profit
      const finalProfitAmount = (formData.riskAmount || 0) * rMultiple;

      const tradeData = {
        ...formData,
        id: trade?.id,
        rMultiple,
        riskAmount: formData.riskAmount,
        profitAmount: Math.round(finalProfitAmount * 100) / 100,
        type: accountType,
        createdAt: trade?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Omit<Trade, 'id'> & { id?: string };

      await onSave(tradeData);

      // Save screenshot if present
      if (screenshot && tradeData.id) {
        const api = getApi();
        await api.saveScreenshot(tradeData.id, screenshot);
      }

      onClose();
    } catch (error) {
      console.error('Error saving trade:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div 
        className="bg-background-surface border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onPaste={handleScreenshotPaste}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background-surface z-10">
          <h2 className="text-xl font-bold text-text-primary">
            {isEditing ? 'Trade bearbeiten' : 'Neuer Trade'}
            <span className={`ml-3 badge ${accountType === 'funded' ? 'badge-accent' : 'badge-neutral'}`}>
              {accountType === 'funded' ? 'Funded' : 'Eigenkapital'}
            </span>
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-glass-white text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info Row */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="input-label">Datum *</label>
              <input
                type="date"
                className={clsx('input', errors.date && 'border-pnl-negative')}
                value={formData.date || ''}
                onChange={(e) => handleChange('date', e.target.value)}
              />
              {errors.date && <p className="text-xs text-pnl-negative mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="input-label">Währungspaar *</label>
              <select
                className={clsx('select', errors.pair && 'border-pnl-negative')}
                value={formData.pair || ''}
                onChange={(e) => handleChange('pair', e.target.value)}
              >
                {PAIR_LIST.map(pair => (
                  <option key={pair} value={pair}>{pair}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label">Richtung *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleChange('direction', 'long')}
                  className={clsx(
                    'flex-1 py-2 rounded-lg font-medium transition-all',
                    formData.direction === 'long'
                      ? 'bg-pnl-positive/20 text-pnl-positive border-2 border-pnl-positive'
                      : 'bg-background-surface-dark text-text-muted border border-border hover:border-pnl-positive/50'
                  )}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('direction', 'short')}
                  className={clsx(
                    'flex-1 py-2 rounded-lg font-medium transition-all',
                    formData.direction === 'short'
                      ? 'bg-pnl-negative/20 text-pnl-negative border-2 border-pnl-negative'
                      : 'bg-background-surface-dark text-text-muted border border-border hover:border-pnl-negative/50'
                  )}
                >
                  SHORT
                </button>
              </div>
            </div>

          </div>

          {/* Result Row */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="input-label">Ergebnis *</label>
              <div className="flex gap-2">
                {(['win', 'loss', 'breakeven'] as const).map((result) => (
                  <button
                    key={result}
                    type="button"
                    onClick={() => handleChange('result', result)}
                    className={clsx(
                      'flex-1 py-2 rounded-lg font-medium text-sm transition-all',
                      formData.result === result
                        ? result === 'win'
                          ? 'bg-pnl-positive/20 text-pnl-positive border-2 border-pnl-positive'
                          : result === 'loss'
                            ? 'bg-pnl-negative/20 text-pnl-negative border-2 border-pnl-negative'
                            : 'bg-text-muted/20 text-text-primary border-2 border-text-muted'
                        : 'bg-background-surface-dark text-text-muted border border-border hover:text-text-primary'
                    )}
                  >
                    {result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'BE'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="input-label">R-Multiple *</label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                className={clsx('input', errors.rMultiple && 'border-pnl-negative')}
                value={formData.rMultiple ?? ''}
                onChange={(e) => handleChange('rMultiple', parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => {
                  // Erlaube: Ziffern, Backspace, Delete, Tab, Escape, Enter, Dezimalpunkt
                  if (!/[\d.\-]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    // Nur blockieren wenn es keine Steuerungstaste ist
                    if (!e.ctrlKey && !e.metaKey) {
                      // Erlaube trotzdem - Browser handhabt Validierung
                    }
                  }
                }}
                placeholder="z.B. 2.5"
              />
              {errors.rMultiple && <p className="text-xs text-pnl-negative mt-1">{errors.rMultiple}</p>}
            </div>

            <div>
              <label className="input-label">Risiko % *</label>
              <input
                type="number"
                step="any"
                min="0"
                max="100"
                inputMode="decimal"
                className={clsx('input', errors.riskPercent && 'border-pnl-negative')}
                value={formData.riskPercent ?? ''}
                onChange={(e) => handleChange('riskPercent', parseFloat(e.target.value) || 0)}
                placeholder="z.B. 0.5"
              />
              {errors.riskPercent && <p className="text-xs text-pnl-negative mt-1">{errors.riskPercent}</p>}
            </div>

            <div>
              <label className="input-label">Risikobetrag ({accountConfig?.currency || 'USD'}) *</label>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                className={clsx('input', errors.riskAmount && 'border-pnl-negative')}
                value={formData.riskAmount || ''}
                onChange={(e) => handleChange('riskAmount', parseFloat(e.target.value) || 0)}
                placeholder="z.B. 100"
              />
              {errors.riskAmount && <p className="text-xs text-pnl-negative mt-1">{errors.riskAmount}</p>}
            </div>
          </div>

          {/* Profit/Verlust Vorschau Box */}
          <div className={clsx(
            'p-4 rounded-xl border-2',
            calculatedProfit > 0 
              ? 'bg-pnl-positive/10 border-pnl-positive/50' 
              : calculatedProfit < 0 
                ? 'bg-pnl-negative/10 border-pnl-negative/50'
                : 'bg-background-surface-dark border-border'
          )}>
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={18} className="text-text-muted" />
              <span className="text-sm font-medium text-text-secondary">Trade-Berechnung</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {/* Kontostand Info */}
              <div className="text-center p-3 bg-background-surface rounded-lg">
                <p className="text-xs text-text-muted mb-1">Kontostand</p>
                <p className="text-lg font-bold text-text-primary">
                  {accountConfig?.currentBalance?.toLocaleString('de-CH') || '—'} {accountConfig?.currency || 'USD'}
                </p>
              </div>
              
              {/* Risiko Info */}
              <div className="text-center p-3 bg-background-surface rounded-lg">
                <p className="text-xs text-text-muted mb-1">Risiko ({formData.riskPercent || 0}%)</p>
                <p className="text-lg font-bold text-accent-gold">
                  {(formData.riskAmount || 0).toLocaleString('de-CH')} {accountConfig?.currency || 'USD'}
                </p>
              </div>
              
              {/* Profit/Verlust */}
              <div className="text-center p-3 bg-background-surface rounded-lg">
                <p className="text-xs text-text-muted mb-1">
                  {formData.result === 'win' ? 'Gewinn' : formData.result === 'loss' ? 'Verlust' : 'Ergebnis'} ({formData.rMultiple || 0}R)
                </p>
                <div className="flex items-center justify-center gap-2">
                  {calculatedProfit > 0 ? (
                    <TrendingUp size={20} className="text-pnl-positive" />
                  ) : calculatedProfit < 0 ? (
                    <TrendingDown size={20} className="text-pnl-negative" />
                  ) : null}
                  <p className={clsx(
                    'text-xl font-bold',
                    calculatedProfit > 0 ? 'text-pnl-positive' : calculatedProfit < 0 ? 'text-pnl-negative' : 'text-text-muted'
                  )}>
                    {calculatedProfit > 0 ? '+' : ''}{calculatedProfit.toLocaleString('de-CH')} {accountConfig?.currency || 'USD'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Beispiel-Erklärung */}
            <div className="mt-3 p-2 bg-background-surface rounded-lg flex items-start gap-2">
              <AlertCircle size={14} className="text-accent-gold mt-0.5 flex-shrink-0" />
              <p className="text-xs text-text-muted">
                Bei {formData.riskPercent || 0}% Risiko ({(formData.riskAmount || 0).toLocaleString('de-CH')} {accountConfig?.currency || 'USD'}) und {Math.abs(formData.rMultiple || 0)}R 
                {formData.result === 'win' ? ' Gewinn' : formData.result === 'loss' ? ' Verlust' : ''}: 
                <span className={clsx(
                  'font-semibold ml-1',
                  calculatedProfit > 0 ? 'text-pnl-positive' : calculatedProfit < 0 ? 'text-pnl-negative' : ''
                )}>
                  {calculatedProfit > 0 ? '+' : ''}{calculatedProfit.toLocaleString('de-CH')} {accountConfig?.currency || 'USD'}
                </span>
              </p>
            </div>
          </div>

          {/* Setups & Confluence */}
          <div>
            <label className="input-label mb-3">Setups & Confluence</label>
            <div className="space-y-2">
              {Object.entries(SETUP_DEFINITIONS).map(([key, setup]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSetupToggle(key)}
                  className={clsx(
                    'w-full flex items-center justify-between px-4 py-3 rounded-lg font-medium text-sm transition-all text-left',
                    formData[key as keyof Trade]
                      ? 'border-2'
                      : 'bg-background-surface-dark border border-border text-text-muted hover:text-text-primary'
                  )}
                  style={formData[key as keyof Trade] ? {
                    backgroundColor: `${setup.color}20`,
                    borderColor: setup.color,
                    color: setup.color
                  } : undefined}
                >
                  <div>
                    <span className="font-semibold">{setup.label}</span>
                    <span className="text-xs opacity-70 ml-2">({setup.short})</span>
                  </div>
                  <span className="text-xs opacity-60">{setup.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Levels (optional) */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="input-label">Entry Preis</label>
              <input
                type="number"
                step="0.00001"
                className="input"
                value={formData.entryPrice || ''}
                onChange={(e) => handleChange('entryPrice', parseFloat(e.target.value) || undefined)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="input-label">Stop Loss</label>
              <input
                type="number"
                step="0.00001"
                className="input"
                value={formData.stopLoss || ''}
                onChange={(e) => handleChange('stopLoss', parseFloat(e.target.value) || undefined)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="input-label">Take Profit</label>
              <input
                type="number"
                step="0.00001"
                className="input"
                value={formData.takeProfit || ''}
                onChange={(e) => handleChange('takeProfit', parseFloat(e.target.value) || undefined)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="input-label">Kommentar / Notizen</label>
            <textarea
              className="input min-h-[100px] resize-y"
              value={formData.comment || ''}
              onChange={(e) => handleChange('comment', e.target.value)}
              placeholder="Trade-Notizen, Lernpunkte, Emotionen..."
            />
          </div>

          {/* Screenshot */}
          <div>
            <label className="input-label mb-3">Screenshot (Strg+V zum Einfügen)</label>
            
            {screenshot ? (
              <div className="relative">
                <img 
                  src={screenshot} 
                  alt="Trade Screenshot" 
                  className="w-full max-h-64 object-contain rounded-lg border border-border bg-background-surface-dark"
                />
                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="absolute top-2 right-2 p-2 bg-pnl-negative/90 text-white rounded-lg hover:bg-pnl-negative transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent-gold/50 transition-colors bg-background-surface-dark">
                <Camera size={32} className="text-text-muted mb-2" />
                <span className="text-text-muted text-sm">Klicken oder Strg+V zum Einfügen</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              <Save size={18} />
              {isSaving ? 'Speichern...' : isEditing ? 'Aktualisieren' : 'Trade speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
