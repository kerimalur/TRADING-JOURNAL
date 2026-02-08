/* ====================================================================== */
/* SIDEBAR NAVIGATION COMPONENT                                           */
/* Wiederverwendbare Sidebar für alle Seiten                              */
/* ====================================================================== */

/**
 * Erstellt die Sidebar HTML-Struktur
 * @param {string} activePage - Der aktive Seitenname (z.B. 'kalender', 'dashboard')
 */
function createSidebar(activePage = '') {
    const sidebarHTML = `
    <aside class="sidebar" id="sidebar">
        <button class="sidebar-toggle" id="sidebar-toggle" title="Sidebar ein-/ausklappen">
            <i class="fas fa-chevron-left"></i>
        </button>
        
        <div class="sidebar-header">
            <a href="startseite.html" style="text-decoration: none; display: flex; align-items: center; gap: 12px;">
                <div class="logo-icon">TJ</div>
                <h2>Trading Journal</h2>
            </a>
        </div>

        <nav class="sidebar-nav">
            <div class="nav-group">
                <div class="nav-group-title">Trading</div>
                <a href="funded_journal.html" ${activePage === 'funded' ? 'class="active-link"' : ''}>
                    <i class="fas fa-money-bill-wave"></i><span class="nav-text">Funded</span>
                </a>
                <a href="ek_journal.html" ${activePage === 'ek' ? 'class="active-link"' : ''}>
                    <i class="fas fa-wallet"></i><span class="nav-text">Eigenkapital</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">Analyse</div>
                <a href="uebersicht.html" ${activePage === 'dashboard' ? 'class="active-link"' : ''}>
                    <i class="fas fa-chart-pie"></i><span class="nav-text">Dashboard</span>
                </a>
                <a href="equity_curve.html" ${activePage === 'equity' ? 'class="active-link"' : ''}>
                    <i class="fas fa-chart-area"></i><span class="nav-text">Equity Curve</span>
                </a>
                <a href="waehrungsanalyse.html" ${activePage === 'waehrungen' ? 'class="active-link"' : ''}>
                    <i class="fas fa-chart-bar"></i><span class="nav-text">Währungen</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">Tools</div>
                <a href="cot_daten.html" ${activePage === 'cot' ? 'class="active-link"' : ''}>
                    <i class="fas fa-database"></i><span class="nav-text">COT Daten</span>
                </a>
                <a href="kalender.html" ${activePage === 'kalender' ? 'class="active-link"' : ''}>
                    <i class="fas fa-calendar-alt"></i><span class="nav-text">Kalender</span>
                </a>
                <a href="simulation.html" ${activePage === 'simulation' ? 'class="active-link"' : ''}>
                    <i class="fas fa-calculator"></i><span class="nav-text">Simulation</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">System</div>
                <a href="kontoeinstellungen.html" ${activePage === 'settings' ? 'class="active-link"' : ''}>
                    <i class="fas fa-cog"></i><span class="nav-text">Einstellungen</span>
                </a>
                <a href="startseite.html" ${activePage === 'home' ? 'class="active-link"' : ''}>
                    <i class="fas fa-home"></i><span class="nav-text">Startseite</span>
                </a>
            </div>
        </nav>

        <div class="sidebar-footer">
            <button class="theme-toggle" id="theme-toggle-sidebar">
                <i class="fas fa-sun"></i>
                <span>Theme wechseln</span>
            </button>
        </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;
    
    return sidebarHTML;
}

/**
 * Initialisiert die Sidebar-Funktionalität
 */
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (!sidebar) return;
    
    // Load saved collapsed state
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        mainContent?.classList.add('sidebar-collapsed');
    }
    
    // Sidebar Toggle Click
    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent?.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
    
    // Mobile Menu Toggle
    mobileMenuToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
    });
    
    // Close sidebar on overlay click (mobile)
    sidebarOverlay?.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
    });

    // Theme Toggle in Sidebar
    const themeToggleSidebar = document.getElementById('theme-toggle-sidebar');
    themeToggleSidebar?.addEventListener('click', () => {
        if (typeof toggleTheme === 'function') {
            toggleTheme();
        }
    });
    
    // Update theme toggle icon based on current theme
    updateSidebarThemeIcon();
}

/**
 * Aktualisiert das Theme-Icon in der Sidebar
 */
function updateSidebarThemeIcon() {
    const themeToggle = document.getElementById('theme-toggle-sidebar');
    if (!themeToggle) return;
    
    const currentTheme = localStorage.getItem(STORAGE_KEYS?.THEME || 'tradingJournalTheme') || 'dark';
    const icon = themeToggle.querySelector('i');
    const text = themeToggle.querySelector('span');
    
    if (icon) {
        icon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    if (text) {
        text.textContent = currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
}

/**
 * Erstellt die Top-Bar HTML-Struktur
 * @param {string} title - Der Seitentitel
 * @param {string} icon - Das Font Awesome Icon (z.B. 'fa-calendar-alt')
 * @param {string} actionsHTML - Optionaler HTML für Aktions-Buttons
 */
function createTopBar(title, icon = '', actionsHTML = '') {
    return `
    <div class="top-bar">
        <button class="mobile-menu-toggle" id="mobile-menu-toggle">
            <i class="fas fa-bars"></i>
        </button>
        <h1>${icon ? `<i class="fas ${icon}"></i> ` : ''}${title}</h1>
        <div class="top-bar-actions">
            ${actionsHTML}
        </div>
    </div>
    `;
}

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
});
