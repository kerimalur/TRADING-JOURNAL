// ======================================
// SCRIPT FÜR kalender.html
// ======================================

document.addEventListener('DOMContentLoaded', () => {
    // Globale Variable für das aktuell angezeigte Datum
    let currentDate = new Date();
    
    // Daten-Container
    let tradeDataByDay = {};

    // Popup-Helfer für Monats-Details
    function openPopup(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closePopup(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('popup-overlay')) {
            e.target.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.popup-overlay.active').forEach(el => el.classList.remove('active'));
            document.body.style.overflow = '';
        }
    });

    // Globale Verfügbarkeit für HTML-Handler
    window.openPopup = openPopup;
    window.closePopup = closePopup;

    /**
     * Verarbeitet alle Trades und bündelt sie nach Tag (Netto-R)
     */
    function processTradeData() {
        if (typeof loadTrades !== 'function') {
            console.error("data_manager.js nicht geladen.");
            return;
        }
        const trades = loadTrades();
        tradeDataByDay = {}; // Reset

        trades.forEach(trade => {
            const date = trade.date; // YYYY-MM-DD
            if (!date) return;
            
            const r = parseFloat(trade.rMultiple) || 0;
            
            if (!tradeDataByDay[date]) {
                tradeDataByDay[date] = {
                    netR: 0,
                    trades: 0
                };
            }
            
            tradeDataByDay[date].netR += r;
            tradeDataByDay[date].trades++;
        });
    }

    /**
     * Zeichnet den Kalender für den gegebenen Monat und das Jahr
     */
    function renderCalendar(year, month) {
        const grid = document.getElementById('calendar-grid');
        const monthYearDisplay = document.getElementById('month-year-display');
        
        grid.innerHTML = '';
        monthYearDisplay.textContent = `${new Date(year, month).toLocaleString('de-DE', { month: 'long' })} ${year}`;
        
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        // Wochentag des ersten Tages (0=So, 1=Mo, ...)
        // Wir passen an, dass Montag = 0 ist
        let startDayOfWeek = firstDayOfMonth.getDay(); // 0=So, 1=Mo
        if (startDayOfWeek === 0) startDayOfWeek = 6; // Sonntag auf 6
        else startDayOfWeek -= 1; // Montag (1) auf 0
        
        // 1. Leere Zellen für Tage vor dem 1. des Monats
        for (let i = 0; i < startDayOfWeek; i++) {
            grid.appendChild(createEmptyDayCell());
        }
        
        // 2. Zellen für jeden Tag des Monats
        for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
            const date = new Date(year, month, day);
            grid.appendChild(createDayCell(date));
        }
        
        // 3. Leere Zellen nach dem letzten Tag (bis 42 Zellen voll sind)
        const totalCells = startDayOfWeek + lastDayOfMonth.getDate();
        const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
        for (let i = 0; i < remainingCells; i++) {
            grid.appendChild(createEmptyDayCell());
        }
    }
    
    function createEmptyDayCell() {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell empty';
        return cell;
    }

    function createDayCell(date) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell';
        
        const dateString = date.toISOString().split('T')[0];
        const dayNumber = date.getDate();
        
        cell.innerHTML = `<div class="day-number">${dayNumber}</div>`;
        
        const data = tradeDataByDay[dateString];
        
        if (data) {
            const netR = data.netR;
            const tradesCount = data.trades;
            
            let pnlClass = 'pnl-neutral-day';
            if (netR > 0) pnlClass = 'pnl-positive-day';
            else if (netR < 0) pnlClass = 'pnl-negative-day';
            
            cell.classList.add(pnlClass);
            
            cell.innerHTML += `
                <div class="day-info">
                    <span class="day-r-value">${netR.toFixed(1)} R</span>
                    <span class="day-trades-count">${tradesCount} Trade${tradesCount > 1 ? 's' : ''}</span>
                </div>
            `;
            
            // Tooltip
            cell.title = `${dateString}\nNetto R: ${netR.toFixed(1)}\nTrades: ${tradesCount}`;
        }

        // Heutigen Tag markieren
        const today = new Date().toISOString().split('T')[0];
        if (dateString === today) {
            cell.classList.add('today');
        }
        
        return cell;
    }

    /**
     * Aktualisiert die Quick-Stats für den aktuellen Monat
     */
    function updateQuickStats(year, month) {
        const tradingDaysEl = document.getElementById('trading-days-count');
        const winrateEl = document.getElementById('month-winrate');
        const totalREl = document.getElementById('month-total-r');
        const popupMonth = document.getElementById('popup-month-display');
        const popupTradingDays = document.getElementById('popup-trading-days');
        const popupWinrate = document.getElementById('popup-winrate');
        const popupTotalR = document.getElementById('popup-total-r');
        
        let tradingDays = 0;
        let winDays = 0;
        let totalR = 0;
        
        // Alle Tage des Monats durchgehen
        Object.keys(tradeDataByDay).forEach(dateString => {
            const date = new Date(dateString);
            if (date.getFullYear() === year && date.getMonth() === month) {
                const data = tradeDataByDay[dateString];
                tradingDays++;
                totalR += data.netR;
                if (data.netR > 0) winDays++;
            }
        });
        
        const winrate = tradingDays > 0 ? ((winDays / tradingDays) * 100).toFixed(0) : 0;
        
        tradingDaysEl.textContent = tradingDays;
        winrateEl.textContent = winrate + '%';
        winrateEl.className = 'value ' + (winrate >= 50 ? 'positive' : 'negative');
        totalREl.textContent = (totalR >= 0 ? '+' : '') + totalR.toFixed(1) + ' R';
        totalREl.className = 'value ' + (totalR >= 0 ? 'positive' : 'negative');

        // Popup-Werte synchronisieren
        if (popupMonth) popupMonth.textContent = `${new Date(year, month).toLocaleString('de-DE', { month: 'long' })} ${year}`;
        if (popupTradingDays) popupTradingDays.textContent = tradingDays;
        if (popupWinrate) popupWinrate.textContent = winrate + '%';
        if (popupTotalR) popupTotalR.textContent = (totalR >= 0 ? '+' : '') + totalR.toFixed(1) + ' R';

    }

    // Event Listeners für Buttons
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        updateQuickStats(currentDate.getFullYear(), currentDate.getMonth());
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        updateQuickStats(currentDate.getFullYear(), currentDate.getMonth());
    });

    // Initialisierung
    processTradeData();
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    updateQuickStats(currentDate.getFullYear(), currentDate.getMonth());
});