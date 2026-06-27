/**
 * ========================================================================
 * Trading Journal - TradingView Integration
 * ========================================================================
 * 
 * Nahtlose Integration mit TradingView:
 * 1. Bookmarklet für Chart-Daten Export
 * 2. Webhook-Empfang für automatische Trade-Erfassung
 * 3. Deep-Link Support
 * 4. Paste-Event Handler für JSON-Daten
 */

// ============================================================
// TYPES
// ============================================================

export interface TradingViewData {
  pair: string;
  price?: number;
  date?: string;
  direction?: 'long' | 'short';
  source: string;
  timestamp: string;
  // Optional fields from advanced export
  stopLoss?: number;
  takeProfit?: number;
  timeframe?: string;
  notes?: string;
}

export interface WebhookPayload {
  action: 'new_trade' | 'close_trade' | 'alert';
  symbol: string;
  price: number;
  direction?: 'long' | 'short';
  timestamp: string;
  message?: string;
}

// ============================================================
// BOOKMARKLET CODE
// ============================================================

/**
 * Webhook Template für TradingView Alerts
 */
export const WEBHOOK_TEMPLATE = {
  action: "new_trade",
  symbol: "{{ticker}}",
  price: "{{close}}",
  direction: "{{strategy.order.action}}",
  timestamp: "{{time}}",
  message: "{{strategy.order.comment}}"
};

/**
 * Generiert den Bookmarklet-Code für TradingView
 * Dieser Code wird als URL in einem Browser-Lesezeichen gespeichert
 */
export const BOOKMARKLET_CODE = `javascript:(function(){try{const e=document.querySelector('[data-name="legend-source-title"]')||document.querySelector('.chart-markup-table .symbolName-container')||document.querySelector('[class*="symbol"]'),t=e?e.textContent.trim():"",o=document.querySelector('[data-name="legend-source-item"][data-title="close"]')||document.querySelector('.valueValue-pricescale');let r=o?o.textContent.trim():"";r=r.replace(/[^0-9.]/g,"");const n=document.querySelector('[data-name="legend-date-title"]')||document.querySelector('.dateValue');let a=n?n.textContent.trim():"";a||(a=(new Date).toISOString().split("T")[0]);const c={pair:t.replace(/\\//,"").toUpperCase(),price:parseFloat(r),date:a,source:"TradingView",timestamp:(new Date).toISOString()},l=JSON.stringify(c,null,2);navigator.clipboard.writeText(l).then(()=>{const e=document.createElement("div");e.style.cssText="position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); color: white; padding: 15px 25px; border-radius: 12px; box-shadow: 0 8px 32px rgba(139,92,246,0.4); z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600;",e.innerHTML=\`✅ Kopiert!<br><small style="font-weight: normal; opacity: 0.9;">\${c.pair} @ \${c.price}</small>\`,document.body.appendChild(e),setTimeout(()=>e.remove(),3e3)}).catch(e=>{alert("Fehler: "+e.message)})}catch(e){alert("Fehler: "+e.message)}})();`;

/**
 * Generiert eine lesbare Version des Bookmarklet-Codes
 */
export function getBookmarkletReadable(): string {
  return `
javascript:(function(){
  try {
    // Symbol extrahieren
    const symbolEl = document.querySelector('[data-name="legend-source-title"]') ||
                     document.querySelector('.chart-markup-table .symbolName-container') ||
                     document.querySelector('[class*="symbol"]');
    const symbol = symbolEl ? symbolEl.textContent.trim() : '';
    
    // Preis extrahieren
    const priceEl = document.querySelector('[data-name="legend-source-item"][data-title="close"]') ||
                    document.querySelector('.valueValue-pricescale');
    let price = priceEl ? priceEl.textContent.trim() : '';
    price = price.replace(/[^0-9.]/g, '');
    
    // Datum extrahieren
    const dateEl = document.querySelector('[data-name="legend-date-title"]') ||
                   document.querySelector('.dateValue');
    let date = dateEl ? dateEl.textContent.trim() : '';
    if (!date) date = new Date().toISOString().split('T')[0];
    
    // JSON erstellen
    const data = {
      pair: symbol.replace(/\\//, '').toUpperCase(),
      price: parseFloat(price),
      date: date,
      source: 'TradingView',
      timestamp: new Date().toISOString()
    };
    
    // In Zwischenablage kopieren
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      .then(() => {
        // Erfolgs-Notification anzeigen
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); color: white; padding: 15px 25px; border-radius: 12px; box-shadow: 0 8px 32px rgba(139,92,246,0.4); z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; font-weight: 600;';
        notification.innerHTML = \`✅ Kopiert!<br><small style="font-weight: normal; opacity: 0.9;">\${data.pair} @ \${data.price}</small>\`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
      })
      .catch(err => alert('Fehler: ' + err.message));
      
  } catch (error) {
    alert('Fehler beim Extrahieren: ' + error.message);
  }
})();
  `.trim();
}

// ============================================================
// PASTE EVENT HANDLER
// ============================================================

/**
 * Prüft ob der eingefügte Text TradingView JSON-Daten enthält
 */
export function parseTradingViewData(text: string): TradingViewData | null {
  try {
    const trimmed = text.trim();
    
    // Prüfe ob es JSON ist
    if (!trimmed.startsWith('{')) return null;
    
    const data = JSON.parse(trimmed);
    
    // Prüfe ob es TradingView-Daten sind
    if (data.source === 'TradingView' && data.pair) {
      return {
        pair: data.pair.toUpperCase().replace('/', ''),
        price: data.price,
        date: data.date || new Date().toISOString().split('T')[0],
        direction: data.direction,
        source: 'TradingView',
        timestamp: data.timestamp || new Date().toISOString(),
        stopLoss: data.stopLoss,
        takeProfit: data.takeProfit,
        timeframe: data.timeframe,
        notes: data.notes,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Setup Paste-Event Listener für TradingView Daten
 */
export function setupTradingViewPasteListener(
  onData: (data: TradingViewData) => void
): () => void {
  const handler = (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData('text');
    if (!text) return;
    
    const tvData = parseTradingViewData(text);
    if (tvData) {
      event.preventDefault();
      onData(tvData);
    }
  };
  
  document.addEventListener('paste', handler);
  
  // Cleanup function
  return () => document.removeEventListener('paste', handler);
}

// ============================================================
// WEBHOOK SUPPORT
// ============================================================

/**
 * Pine Script Template für TradingView Alerts
 * Kann in TradingView als Alert-Message verwendet werden
 */
export const PINE_SCRIPT_ALERT_TEMPLATE = `
// TradingView Alert Message Template
// Kopiere dies in die "Message" Box deines Alerts

{
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "price": {{close}},
  "direction": "{{strategy.order.action}}",
  "timestamp": "{{timenow}}",
  "message": "{{strategy.order.comment}}"
}
`.trim();

/**
 * Webhook URL für TradingView Alerts
 * Diese URL muss in einem lokalen Server laufen der die Daten empfängt
 */
export function getWebhookEndpoint(port: number = 3847): string {
  return `http://localhost:${port}/tradingview/webhook`;
}

/**
 * Parse Webhook Payload
 */
export function parseWebhookPayload(body: string): WebhookPayload | null {
  try {
    const data = JSON.parse(body);
    
    if (data.symbol) {
      return {
        action: data.action || 'alert',
        symbol: data.symbol.toUpperCase(),
        price: parseFloat(data.price) || 0,
        direction: data.direction?.toLowerCase() === 'sell' ? 'short' : 
                   data.direction?.toLowerCase() === 'buy' ? 'long' : undefined,
        timestamp: data.timestamp || new Date().toISOString(),
        message: data.message,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// DEEP LINK SUPPORT
// ============================================================

/**
 * Parse URL Parameter für Deep Links
 * Beispiel: tradingjournal://add-trade?pair=EURUSD&direction=long
 */
export function parseDeepLinkParams(url: string): Partial<TradingViewData> | null {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    const pair = params.get('pair');
    if (!pair) return null;
    
    return {
      pair: pair.toUpperCase(),
      price: params.get('price') ? parseFloat(params.get('price')!) : undefined,
      date: params.get('date') || new Date().toISOString().split('T')[0],
      direction: params.get('direction') as 'long' | 'short' | undefined,
      stopLoss: params.get('sl') ? parseFloat(params.get('sl')!) : undefined,
      takeProfit: params.get('tp') ? parseFloat(params.get('tp')!) : undefined,
      source: 'DeepLink',
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Generiert einen Deep-Link für einen Trade
 */
export function generateDeepLink(data: Partial<TradingViewData>): string {
  const params = new URLSearchParams();
  
  if (data.pair) params.set('pair', data.pair);
  if (data.price) params.set('price', data.price.toString());
  if (data.date) params.set('date', data.date);
  if (data.direction) params.set('direction', data.direction);
  if (data.stopLoss) params.set('sl', data.stopLoss.toString());
  if (data.takeProfit) params.set('tp', data.takeProfit.toString());
  
  return `tradingjournal://add-trade?${params.toString()}`;
}

// ============================================================
// INSTALLATION INSTRUCTIONS
// ============================================================

export const INSTALLATION_GUIDE = `
# TradingView Integration - Installationsanleitung

## 1. Bookmarklet (Empfohlen - Einfachste Methode)

### Installation:
1. Rechtsklick auf Lesezeichen-Leiste → "Neues Lesezeichen"
2. Name: "TJ Export" 
3. URL: Kopiere den Bookmarklet-Code
4. Speichern

### Verwendung:
1. Öffne Chart in TradingView
2. Klicke auf "TJ Export" Bookmarklet
3. Wechsle zu Trading Journal
4. Drücke Strg+V → Daten werden automatisch ins Formular eingefügt

---

## 2. Webhook Integration (Für automatische Alerts)

### Setup:
1. Trading Journal → Einstellungen → TradingView
2. Aktiviere "Webhook Server"
3. Kopiere die Webhook-URL

### In TradingView:
1. Erstelle Alert auf deinen Indikator/Strategie
2. Unter "Notifications" → "Webhook URL" aktivieren
3. Füge die kopierte URL ein
4. Message-Format: Kopiere das Pine Script Template

---

## 3. Pine Script Export

Füge diesen Code zu deiner Strategie hinzu:

\`\`\`pine
//@version=5
// TradingView Alert für Trading Journal

alertMessage = '{"action":"' + str.tostring(strategy.order.action) + 
               '","symbol":"' + syminfo.ticker + 
               '","price":' + str.tostring(close) + 
               ',"direction":"' + (strategy.position_size > 0 ? "long" : "short") + 
               '","timestamp":"' + str.tostring(timenow) + '"}'

if (ta.change(strategy.position_size) != 0)
    alert(alertMessage, alert.freq_once_per_bar)
\`\`\`

---

## 4. Tastenkürzel

| Kürzel | Aktion |
|--------|--------|
| Strg+V | TradingView-Daten einfügen |
| Strg+Shift+V | Screenshot einfügen |
| L | Long auswählen (im Formular) |
| S | Short auswählen (im Formular) |

---

## Tipps:

- Das Bookmarklet funktioniert am besten wenn du den Chart im Fokus hast
- Screenshots können direkt aus TradingView kopiert werden (Windows+Shift+S)
- Für automatische Trade-Erfassung nutze Webhooks mit deiner Strategie
`;
