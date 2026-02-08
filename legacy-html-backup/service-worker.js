/* ====================================================================== */
/* SERVICE WORKER - Offline-Fähigkeit & Performance Caching              */
/* Macht die App offline-fähig und beschleunigt Ladezeiten               */
/* ====================================================================== */

const CACHE_VERSION = 'trading-journal-v2.0.0';
const CACHE_NAMES = {
    STATIC: `${CACHE_VERSION}-static`,
    DYNAMIC: `${CACHE_VERSION}-dynamic`,
    CDN: `${CACHE_VERSION}-cdn`
};

// Dateien die sofort gecacht werden sollen
const STATIC_ASSETS = [
    './',
    './startseite.html',
    './login.html',
    './kontoeinstellungen.html',
    './EK_journal.html',
    './funded_journal.html',
    './equity_curve.html',
    './uebersicht.html',
    './kalender.html',
    './cot_daten.html',
    './waehrungsanalyse.html',
    './simulation.html',
    './machine_learning.html',
    './styles.css',
    './print.css',
    './config.js',
    './global.js',
    './data_manager.js',
    './auth_guard.js',
    './api_data_service.js',
    './backup_manager.js',
    './sidebar.js',
    './journal.js',
    './equity_curve.js',
    './uebersicht.js',
    './kalender.js',
    './cot_daten.js',
    './waehrungsanalyse.js',
    './simulation.js',
    './machine_learning.js',
    './login.js',
    './kontoeinstellungen.js'
];

// CDN-Ressourcen die gecacht werden sollen
const CDN_URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/tsparticles@2.0.6/tsparticles.bundle.min.js'
];

// =====================================================================
// INSTALLATION
// =====================================================================

self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache statische Assets
            caches.open(CACHE_NAMES.STATIC).then((cache) => {
                console.log('📦 Caching static assets...');
                return cache.addAll(STATIC_ASSETS.filter(url => {
                    // Überspringe falls Datei nicht existiert
                    return true; // In Produktion würde man hier prüfen
                })).catch((error) => {
                    console.warn('⚠️ Some static assets failed to cache:', error);
                    // Versuche einzeln zu cachen
                    return Promise.allSettled(
                        STATIC_ASSETS.map(url => cache.add(url).catch(e => {
                            console.warn(`Failed to cache ${url}:`, e.message);
                        }))
                    );
                });
            }),
            
            // Cache CDN-Ressourcen
            caches.open(CACHE_NAMES.CDN).then((cache) => {
                console.log('📦 Caching CDN resources...');
                return Promise.allSettled(
                    CDN_URLS.map(url => 
                        cache.add(url).catch(e => {
                            console.warn(`Failed to cache CDN ${url}:`, e.message);
                        })
                    )
                );
            })
        ]).then(() => {
            console.log('✅ Service Worker: Installation complete');
            return self.skipWaiting(); // Aktiviere sofort
        })
    );
});

// =====================================================================
// AKTIVIERUNG
// =====================================================================

self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activating...');
    
    event.waitUntil(
        Promise.all([
            // Lösche alte Caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name.startsWith('trading-journal-') && 
                                   !Object.values(CACHE_NAMES).includes(name);
                        })
                        .map((name) => {
                            console.log('🗑️ Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            }),
            
            // Übernehme sofort die Kontrolle
            self.clients.claim()
        ]).then(() => {
            console.log('✅ Service Worker: Activated');
        })
    );
});

// =====================================================================
// FETCH - NETZWERK-ANFRAGEN ABFANGEN
// =====================================================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignoriere Chrome-Extension und nicht-GET Requests
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return;
    }
    
    if (request.method !== 'GET') {
        return;
    }
    
    // API-Calls: Network-First (mit Fallback auf Cache)
    if (isApiRequest(url)) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }
    
    // CDN-Ressourcen: Cache-First (mit Fallback auf Netzwerk)
    if (isCdnRequest(url)) {
        event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.CDN));
        return;
    }
    
    // Statische Assets: Cache-First
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.STATIC));
        return;
    }
    
    // Alles andere: Network-First mit Cache-Fallback
    event.respondWith(networkFirstStrategy(request));
});

// =====================================================================
// CACHING-STRATEGIEN
// =====================================================================

/**
 * Cache-First: Versuche aus Cache, dann Netzwerk
 */
async function cacheFirstStrategy(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            // Im Hintergrund aktualisieren
            updateCache(request, cacheName);
            return cachedResponse;
        }
        
        // Nicht im Cache, hole aus Netzwerk
        const networkResponse = await fetch(request);
        
        // Cache nur erfolgreiche Antworten
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('❌ Cache-First strategy failed:', error);
        
        // Versuche aus anderem Cache
        const fallbackResponse = await caches.match(request);
        if (fallbackResponse) {
            return fallbackResponse;
        }
        
        // Offline-Fallback
        return createOfflineFallback(request);
    }
}

/**
 * Network-First: Versuche Netzwerk, dann Cache
 */
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request, {
            timeout: 5000 // 5 Sekunden Timeout
        });
        
        // Cache erfolgreiche Antworten
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAMES.DYNAMIC);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.warn('⚠️ Network request failed, trying cache:', request.url);
        
        // Versuche aus Cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Offline-Fallback
        return createOfflineFallback(request);
    }
}

/**
 * Aktualisiert Cache im Hintergrund
 */
async function updateCache(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(cacheName);
            await cache.put(request, networkResponse);
        }
    } catch (error) {
        // Stilles Update, Fehler ignorieren
    }
}

// =====================================================================
// HELPER FUNKTIONEN
// =====================================================================

/**
 * Prüft ob Request eine API-Anfrage ist
 */
function isApiRequest(url) {
    return url.hostname !== self.location.hostname &&
           (url.hostname.includes('cftc.gov') ||
            url.hostname.includes('faireconomy.media') ||
            url.hostname.includes('corsproxy.io') ||
            url.hostname.includes('allorigins.win') ||
            url.hostname.includes('nasdaq.com'));
}

/**
 * Prüft ob Request eine CDN-Ressource ist
 */
function isCdnRequest(url) {
    return url.hostname.includes('cdnjs.cloudflare.com') ||
           url.hostname.includes('cdn.jsdelivr.net') ||
           url.hostname.includes('unpkg.com');
}

/**
 * Prüft ob Request ein statisches Asset ist
 */
function isStaticAsset(url) {
    return url.hostname === self.location.hostname &&
           (url.pathname.endsWith('.html') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.jpg') ||
            url.pathname.endsWith('.svg') ||
            url.pathname === '/' ||
            url.pathname === '');
}

/**
 * Erstellt eine Offline-Fallback-Antwort
 */
function createOfflineFallback(request) {
    const url = new URL(request.url);
    
    // HTML: Zeige Offline-Nachricht
    if (request.destination === 'document' || url.pathname.endsWith('.html')) {
        return new Response(`
            <!DOCTYPE html>
            <html lang="de">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - Trading Journal</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        background: #1A1D20;
                        color: #F8F9FA;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 20px;
                    }
                    .container {
                        text-align: center;
                        max-width: 500px;
                    }
                    h1 { color: #00FFD1; margin-bottom: 20px; }
                    p { color: #9EA0A8; line-height: 1.6; }
                    .icon { font-size: 64px; margin-bottom: 20px; }
                    button {
                        background: #00FFD1;
                        color: #1A1D20;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-top: 20px;
                    }
                    button:hover { background: #00E6BB; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">📡</div>
                    <h1>Du bist offline</h1>
                    <p>Diese Seite ist nicht verfügbar ohne Internetverbindung. 
                       Bitte überprüfe deine Netzwerkverbindung und versuche es erneut.</p>
                    <button onclick="window.location.reload()">Erneut versuchen</button>
                </div>
            </body>
            </html>
        `, {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/html' }
        });
    }
    
    // JSON: Leere Antwort
    if (request.destination === 'json' || url.pathname.endsWith('.json')) {
        return new Response(JSON.stringify({ 
            error: 'Offline', 
            message: 'No network connection' 
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Andere: 503 Response
    return new Response('Service Unavailable - Offline', {
        status: 503,
        statusText: 'Service Unavailable'
    });
}

// =====================================================================
// MESSAGES - KOMMUNIKATION MIT CLIENT
// =====================================================================

self.addEventListener('message', (event) => {
    const { action, data } = event.data;
    
    switch (action) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CLEAR_CACHE':
            clearAllCaches().then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;
            
        case 'GET_CACHE_SIZE':
            getCacheSize().then((size) => {
                event.ports[0].postMessage({ size });
            });
            break;
            
        default:
            console.warn('Unknown message action:', action);
    }
});

/**
 * Löscht alle Caches
 */
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    return Promise.all(
        cacheNames
            .filter(name => name.startsWith('trading-journal-'))
            .map(name => caches.delete(name))
    );
}

/**
 * Berechnet Cache-Größe
 */
async function getCacheSize() {
    let totalSize = 0;
    
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        totalSize = estimate.usage || 0;
    }
    
    return {
        bytes: totalSize,
        megabytes: (totalSize / (1024 * 1024)).toFixed(2)
    };
}

console.log('✅ Service Worker script loaded');
