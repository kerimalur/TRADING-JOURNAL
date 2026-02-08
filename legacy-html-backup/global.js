/* Trading Journal/global.js */
// ======================================
// GLOBALES SCRIPT (Alle Seiten)
// ======================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- SCROLL-TO-TOP BUTTON ---
    setupScrollToTop();
    
    // --- APP-LAYOUT (SIDEBAR) LOGIK ---
    setupSidebarToggle();

    // --- STICKY HEADER FÜR TABELLEN ---
    updateStickyHeaderTop();
    window.addEventListener('resize', updateStickyHeaderTop);
    
});

/**
 * 1. Logik für den Scroll-to-Top Button
 */
function setupScrollToTop() {
    const scrollToTopBtn = document.querySelector('.scroll-to-top-btn');
    if (!scrollToTopBtn) return;
    
    // Nimm das `main`-Element für App-Layout, sonst `window`
    const scrollContainer = document.querySelector('body.app-layout main') || window;
    const scrollElement = document.querySelector('body.app-layout main') || document.documentElement;

    scrollContainer.addEventListener('scroll', () => {
        if (scrollElement.scrollTop > 100) {
            scrollToTopBtn.style.display = 'block';
            scrollToTopBtn.style.opacity = '1';
        } else {
            scrollToTopBtn.style.opacity = '0';
            setTimeout(() => { 
                if (scrollElement.scrollTop < 100) {
                    scrollToTopBtn.style.display = 'none';
                }
            }, 300);
        }
    });
    
    scrollToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        scrollElement.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

/**
 * 2. NEU: Logik für Sidebar-Toggle
 */
function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const body = document.body;

    if (toggleBtn) {
        // Lade gespeicherten Zustand
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            body.classList.add('sidebar-collapsed');
        }

        toggleBtn.addEventListener('click', () => {
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // Auf Mobilgeräten: "Off-Canvas"
                body.classList.toggle('sidebar-open-mobile');
                body.classList.remove('sidebar-collapsed'); // Sicherstellen, dass Desktop-Klasse weg ist
            } else {
                // Auf Desktop: "Collapsed"
                body.classList.toggle('sidebar-collapsed');
                body.classList.remove('sidebar-open-mobile');
                // Zustand speichern
                localStorage.setItem('sidebarCollapsed', body.classList.contains('sidebar-collapsed'));
            }
            
            // Wichtig: Sticky Header neu berechnen nach Animation
            setTimeout(updateStickyHeaderTop, 300);
        });
    }
    
    // Schließe Mobile-Sidebar, wenn auf einen Link geklickt wird
    document.querySelectorAll('#sidebar nav a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                body.classList.remove('sidebar-open-mobile');
            }
        });
    });
}

/**
 * 3. Logik für Sticky Tabellen-Header
 * (Angepasst für das neue App-Layout)
 */
function updateStickyHeaderTop() {
    const header = document.getElementById('header');
    const main = document.querySelector('main');
    
    if (!header || !main) return;

    // Nur auf App-Seiten (nicht Startseite)
    if (document.body.classList.contains('app-layout')) {
        // Auf App-Seiten ist der Header fixiert.
        // `main` hat einen margin-top, um ihn freizuhalten.
        const headerHeight = header.offsetHeight; 
        main.style.marginTop = `${headerHeight}px`;

        // Die Tabellen-Header müssen an der Decke von `main` kleben (top: 0)
        // Aber `global.js` wird VOR `journal.js` geladen.
        // Die `thead th` Stile sind in `styles.css` (top: 0),
        // ABER das `table-responsive` braucht einen `max-height`.
        // Wir setzen die max-height des Tabellen-Containers dynamisch.
        const tableResponsive = main.querySelector('.table-responsive');
        if (tableResponsive) {
            // Höhe des Containers = Höhe von `main` - Höhe der Filter-Sektion (falls vorhanden) - Puffer
            const filterSection = main.querySelector('.filter-section');
            const filterHeight = filterSection ? filterSection.offsetHeight : 0;
            const h2 = tableResponsive.previousElementSibling; // z.B. <h2>...Historie</h2>
            const h2Height = h2 ? h2.offsetHeight : 0;
            
            const mainHeight = main.clientHeight; // Höhe des sichtbaren Bereichs von main
            const availableHeight = mainHeight - filterHeight - h2Height - 100; // 100px Puffer
            
            tableResponsive.style.maxHeight = `${availableHeight}px`;
        }
        
    } else {
        // Logik für die Startseite (Glassmorphism-Header)
        const headerHeight = header.offsetHeight; 
        main.style.paddingTop = `${headerHeight + 20}px`;
    }
}