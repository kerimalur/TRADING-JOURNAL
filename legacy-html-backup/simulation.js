// ======================================
// SCRIPT FÜR simulation.html
// ======================================

let simulationChart = null; // chart reference used across functions

// Popup helpers (stats remain inline)
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

// Scroll helper
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Expose functions globally for onclick handlers in HTML
window.openPopup = openPopup;
window.closePopup = closePopup;
window.scrollToSection = scrollToSection;

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

document.addEventListener('DOMContentLoaded', () => {
    const runButton = document.getElementById('run-simulation');
    if (runButton) {
        runButton.addEventListener('click', runMonteCarloSimulation);
    }
});

/**
 * Kopie der Metrik-Berechnung aus uebersicht.js
 * Berechnet die Basis-Statistiken für die Simulation.
 */
function calculateBaseMetrics(trades) {
    const totalTrades = trades.length;
    let wins = 0;
    let losses = 0;
    let totalWinR = 0;
    let totalLossR = 0;

    if (totalTrades === 0) {
        return { error: "Keine Trades gefunden, um Statistik zu berechnen." };
    }

    trades.forEach(trade => {
        const r = parseFloat(trade.rMultiple) || 0;
        if (r > 0) {
            wins++;
            totalWinR += r;
        } else if (r < 0) {
            losses++;
            totalLossR += Math.abs(r); // Verluste als positiver Wert
        }
    });

    const winRate = (wins / totalTrades); // Als 0.x, nicht %
    const avgWinR = (wins > 0) ? (totalWinR / wins) : 0;
    const avgLossR = (losses > 0) ? (totalLossR / losses) : 0; // Positiver Wert

    if (winRate === 0 || avgWinR === 0 || avgLossR === 0) {
        return { error: "Statistik unvollständig (WinRate, Ø Win oder Ø Loss ist 0)." };
    }

    return {
        winRate,
        avgWinR,
        avgLossR: -Math.abs(avgLossR) // Als negativen Wert für die Simulation speichern
    };
}

/**
 * Führt die Simulation durch und zeichnet das Diagramm
 */
function runMonteCarloSimulation() {
    const runButton = document.getElementById('run-simulation');
    runButton.disabled = true;
    runButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Berechne...';

    // 1. Parameter auslesen
    const account = document.getElementById('sim-account').value;
    const numPaths = parseInt(document.getElementById('sim-paths').value) || 100;
    const numTrades = parseInt(document.getElementById('sim-trades').value) || 200;
    
    // 2. Datenbasis laden
    if (typeof loadTrades !== 'function') {
        alert("Fehler: data_manager.js nicht geladen.");
        runButton.disabled = false;
        runButton.innerHTML = '<i class="fas fa-play"></i> Simulation starten';
        return;
    }
    const allTrades = loadTrades();
    let tradesToAnalyze = allTrades;
    if (account !== 'all') {
        tradesToAnalyze = allTrades.filter(trade => trade.type === account);
    }

    // 3. Basis-Statistik berechnen
    const stats = calculateBaseMetrics(tradesToAnalyze);
    const statsOutput = document.getElementById('stats-output');
    const statsContainer = document.getElementById('sim-stats');

    if (stats.error) {
        statsContainer.style.display = 'block';
        statsOutput.textContent = `Fehler: ${stats.error} (Konto: ${account}, Trades: ${tradesToAnalyze.length})`;
        statsOutput.style.color = 'var(--color-pnl-negative)';
        runButton.disabled = false;
        runButton.innerHTML = '<i class="fas fa-play"></i> Simulation starten';
        return;
    }
    
    statsContainer.style.display = 'block';
    statsOutput.style.color = 'var(--color-text-light)';
    statsOutput.textContent = `
        Konto: ${account} | 
        Trades: ${tradesToAnalyze.length} | 
        WinRate: ${(stats.winRate * 100).toFixed(1)}% | 
        Ø Win: ${stats.avgWinR.toFixed(2)}R | 
        Ø Loss: ${stats.avgLossR.toFixed(2)}R
    `;

    // 4. Simulation durchführen
    const datasets = [];
    const labels = Array.from({ length: numTrades + 1 }, (_, i) => i); // Labels 0 bis numTrades
    let averagePath = new Array(numTrades + 1).fill(0);

    for (let i = 0; i < numPaths; i++) {
        const pathData = [0]; // Start bei 0 R
        let currentR = 0;
        
        for (let j = 0; j < numTrades; j++) {
            // Simuliere einen Trade
            const tradeResultR = Math.random() < stats.winRate ? stats.avgWinR : stats.avgLossR;
            currentR += tradeResultR;
            pathData.push(currentR);
            
            averagePath[j+1] += currentR; // Summiere für Durchschnitt
        }
        
        // Füge diesen Simulationspfad zum Chart-Dataset hinzu
        datasets.push({
            label: `Pfad ${i + 1}`,
            data: pathData,
            borderColor: 'rgba(0, 123, 255, 0.1)', // Blauer Pfad, sehr transparent
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            tension: 0.1
        });
    }
    
    // 5. Durchschnitts-Pfad berechnen und hinzufügen
    averagePath = averagePath.map(sum => sum / numPaths);
    datasets.push({
        label: `Durchschnitt aller Pfade`,
        data: averagePath,
        borderColor: 'var(--color-pnl-positive)', // Grüner Durchschnitt
        borderWidth: 3,
        pointRadius: 0,
        fill: false,
        tension: 0.1
    });
    
    // 6. Chart rendern
    renderSimulationChart(labels, datasets);
    
    runButton.disabled = false;
    runButton.innerHTML = '<i class="fas fa-play"></i> Simulation starten';
}


/**
 * Zeichnet das Chart mit den Simulationsdaten
 */
function renderSimulationChart(labels, datasets) {
    const ctx = document.getElementById('simulation-chart').getContext('2d');
    
    if (simulationChart) {
        simulationChart.destroy();
    }
    
    simulationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Deaktiviere Animation für schnelle Darstellung
            },
            plugins: {
                legend: {
                    display: false // Legende ausblenden (zu viele Pfade)
                },
                tooltip: {
                    enabled: false // Tooltips auch aus
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        color: 'var(--color-text-subtle)',
                        callback: function(value) {
                            return value.toLocaleString('de-DE') + ' R';
                        }
                    },
                    grid: {
                        color: 'rgba(58, 64, 74, 0.5)'
                    }
                },
                x: {
                    ticks: {
                        color: 'var(--color-text-subtle)',
                    },
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Anzahl Trades',
                        color: 'var(--color-text-subtle)'
                    }
                }
            }
        }
    });
}