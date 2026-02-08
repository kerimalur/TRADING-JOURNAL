/* ====================================================================== */
/* SERVICE WORKER REGISTRATION - Initialisiert Offline-Fähigkeit         */
/* ====================================================================== */

// Prüfe ob Service Worker unterstützt wird
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Registriere Service Worker
            const registration = await navigator.serviceWorker.register('./service-worker.js', {
                scope: './'
            });
            
            console.log('✅ Service Worker registered:', registration.scope);
            
            // Update-Check
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('🔄 Service Worker update found...');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Neuer Service Worker verfügbar
                        showUpdateNotification(registration);
                    }
                });
            });
            
            // Prüfe auf Updates alle 60 Sekunden
            setInterval(() => {
                registration.update();
            }, 60000);
            
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    });
}

/**
 * Zeigt Update-Benachrichtigung
 */
function showUpdateNotification(registration) {
    if (typeof UIFeedback !== 'undefined') {
        const notification = UIFeedback.toast.show(
            'Eine neue Version ist verfügbar!',
            'info',
            0 // Kein Auto-Hide
        );
        
        // Füge Update-Button hinzu
        const toastElement = document.querySelector(`[data-id="${notification}"]`);
        if (toastElement) {
            const updateBtn = document.createElement('button');
            updateBtn.className = 'btn btn-sm primary';
            updateBtn.textContent = 'Aktualisieren';
            updateBtn.style.marginLeft = '12px';
            updateBtn.onclick = () => {
                // Aktiviere neuen Service Worker
                if (registration.waiting) {
                    registration.waiting.postMessage({ action: 'SKIP_WAITING' });
                }
                window.location.reload();
            };
            
            toastElement.querySelector('.toast-content').appendChild(updateBtn);
        }
    } else {
        if (confirm('Eine neue Version ist verfügbar. Jetzt aktualisieren?')) {
            if (registration.waiting) {
                registration.waiting.postMessage({ action: 'SKIP_WAITING' });
            }
            window.location.reload();
        }
    }
}

/**
 * Zeigt Online/Offline Status
 */
window.addEventListener('online', () => {
    if (typeof UIFeedback !== 'undefined') {
        UIFeedback.toast.success('Verbindung wiederhergestellt');
    }
    console.log('🌐 Online');
});

window.addEventListener('offline', () => {
    if (typeof UIFeedback !== 'undefined') {
        UIFeedback.toast.warning('Offline-Modus aktiviert');
    }
    console.log('📡 Offline');
});

/**
 * Installationsaufforderung für PWA
 */
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Verhindere automatische Anzeige
    e.preventDefault();
    deferredPrompt = e;
    
    // Zeige Install-Button (falls vorhanden)
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
        installBtn.style.display = 'block';
        
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            console.log(`PWA install ${outcome}`);
            deferredPrompt = null;
            installBtn.style.display = 'none';
        });
    }
});

window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed successfully');
    deferredPrompt = null;
    
    if (typeof UIFeedback !== 'undefined') {
        UIFeedback.toast.success('App erfolgreich installiert!');
    }
});
