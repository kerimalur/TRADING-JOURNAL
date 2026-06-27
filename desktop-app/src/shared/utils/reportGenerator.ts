/**
 * ========================================================================
 * Trading Journal - PDF Report Generator
 * ========================================================================
 * 
 * Generiert PDF-Reports für Trading Performance
 */

import type { Trade } from '@/shared/types';
import type { PerformanceStats } from '@/shared/stores/analyticsStore';

interface ReportData {
  title: string;
  dateRange: { start: string; end: string };
  accountType: string;
  stats: PerformanceStats & { currentBalance?: number };
  trades: Trade[];
  equityCurve: { date: string; balance: number; r: number }[];
  monthlyReturns: { month: string; r: number; trades: number; winRate: number }[];
}

/**
 * Generiert HTML für den PDF-Report
 */
export function generateReportHTML(data: ReportData): string {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatR = (r: number) => {
    return `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`;
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      background: #fff;
      color: #1a1a1a;
      padding: 40px;
      font-size: 12px;
      line-height: 1.5;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e5e5;
    }
    
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #8B5CF6;
    }
    
    .logo span {
      color: #1a1a1a;
    }
    
    .report-info {
      text-align: right;
    }
    
    .report-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .report-date {
      color: #6b7280;
      font-size: 11px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-title::before {
      content: '';
      width: 4px;
      height: 20px;
      background: #8B5CF6;
      border-radius: 2px;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    
    .stat-card {
      background: #f9fafb;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 15px;
    }
    
    .stat-label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    
    .stat-value {
      font-size: 18px;
      font-weight: 700;
    }
    
    .stat-value.positive { color: #22C55E; }
    .stat-value.negative { color: #EF4444; }
    .stat-value.neutral { color: #1a1a1a; }
    
    .monthly-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .monthly-table th,
    .monthly-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    
    .monthly-table th {
      background: #f9fafb;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
    }
    
    .trades-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    
    .trades-table th,
    .trades-table td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    
    .trades-table th {
      background: #f9fafb;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
    }
    
    .result-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    
    .result-win { background: #dcfce7; color: #166534; }
    .result-loss { background: #fee2e2; color: #991b1b; }
    .result-be { background: #f3f4f6; color: #374151; }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      text-align: center;
      color: #9ca3af;
      font-size: 10px;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    @media print {
      body { padding: 20px; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="logo">Trading<span>Journal</span></div>
    <div class="report-info">
      <div class="report-title">${data.title}</div>
      <div class="report-date">${formatDate(data.dateRange.start)} - ${formatDate(data.dateRange.end)}</div>
      <div class="report-date">${data.accountType} Konto</div>
    </div>
  </div>
  
  <!-- Summary Stats -->
  <div class="section">
    <div class="section-title">Performance Übersicht</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Trades</div>
        <div class="stat-value neutral">${data.stats.totalTrades}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Win Rate</div>
        <div class="stat-value neutral">${data.stats.winRate.toFixed(1)}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total R</div>
        <div class="stat-value ${data.stats.totalR >= 0 ? 'positive' : 'negative'}">
          ${formatR(data.stats.totalR)}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Profit Factor</div>
        <div class="stat-value neutral">
          ${data.stats.profitFactor === Infinity ? '∞' : data.stats.profitFactor.toFixed(2)}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Win</div>
        <div class="stat-value positive">${formatR(data.stats.avgWin)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Loss</div>
        <div class="stat-value negative">-${data.stats.avgLoss.toFixed(2)}R</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Max Drawdown</div>
        <div class="stat-value negative">${data.stats.maxDrawdown.toFixed(2)}R</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expectancy</div>
        <div class="stat-value ${data.stats.expectancy >= 0 ? 'positive' : 'negative'}">
          ${data.stats.expectancy.toFixed(3)}
        </div>
      </div>
    </div>
  </div>
  
  <!-- Monthly Returns -->
  ${data.monthlyReturns.length > 0 ? `
  <div class="section">
    <div class="section-title">Monatliche Returns</div>
    <table class="monthly-table">
      <thead>
        <tr>
          <th>Monat</th>
          <th>Trades</th>
          <th>Win Rate</th>
          <th>R-Multiple</th>
        </tr>
      </thead>
      <tbody>
        ${data.monthlyReturns.map(m => `
          <tr>
            <td>${new Date(m.month + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</td>
            <td>${m.trades}</td>
            <td>${m.winRate}%</td>
            <td style="color: ${m.r >= 0 ? '#22C55E' : '#EF4444'}; font-weight: 600;">
              ${formatR(m.r)}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}
  
  <!-- Trade List -->
  <div class="section page-break">
    <div class="section-title">Trade Liste (${data.trades.length} Trades)</div>
    <table class="trades-table">
      <thead>
        <tr>
          <th>Datum</th>
          <th>Pair</th>
          <th>Richtung</th>
          <th>Ergebnis</th>
          <th>R-Multiple</th>
          <th>Risiko %</th>
        </tr>
      </thead>
      <tbody>
        ${data.trades.slice(0, 100).map(t => `
          <tr>
            <td>${formatDate(t.date)}</td>
            <td><strong>${t.pair}</strong></td>
            <td style="color: ${t.direction === 'long' ? '#22C55E' : '#EF4444'};">
              ${t.direction.toUpperCase()}
            </td>
            <td>
              <span class="result-badge result-${t.result === 'win' ? 'win' : t.result === 'loss' ? 'loss' : 'be'}">
                ${t.result === 'win' ? 'WIN' : t.result === 'loss' ? 'LOSS' : 'BE'}
              </span>
            </td>
            <td style="color: ${t.rMultiple >= 0 ? '#22C55E' : '#EF4444'}; font-weight: 600;">
              ${formatR(t.rMultiple)}
            </td>
            <td>${t.riskPercent || '-'}%</td>
          </tr>
        `).join('')}
        ${data.trades.length > 100 ? `
          <tr>
            <td colspan="6" style="text-align: center; color: #6b7280;">
              ... und ${data.trades.length - 100} weitere Trades
            </td>
          </tr>
        ` : ''}
      </tbody>
    </table>
  </div>
  
  <!-- Footer -->
  <div class="footer">
    <p>Generiert am ${new Date().toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</p>
    <p>Trading Journal Desktop v1.2.0</p>
  </div>
</body>
</html>
  `;
}

/**
 * Öffnet Druckdialog für den Report
 */
export function printReport(html: string): void {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Warte bis Styles geladen sind
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

/**
 * Speichert Report als HTML-Datei
 */
export async function saveReportAsHTML(html: string, filename: string): Promise<void> {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
