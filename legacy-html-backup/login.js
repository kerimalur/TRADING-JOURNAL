// login.js
// ======================================
// SCRIPT FÜR login.html
// ======================================

// Schlüssel für das Passwort-Hash im localStorage
const PASSWORD_HASH_KEY = 'tradingJournalPasswordHash';
// Schlüssel für die Session
const SESSION_KEY = 'tradingJournalSessionActive';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('login-error-msg');

    // 1. Prüfen, ob überhaupt ein Passwort gesetzt ist
    const storedHash = localStorage.getItem(PASSWORD_HASH_KEY);
    if (!storedHash) {
        errorMsg.textContent = 'Kein Passwort gesetzt. Bitte besuche die Einstellungsseite, um eines zu erstellen.';
    }

    // 2. Login-Versuch abhandeln
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';
        
        const password = e.target.elements.password.value;
        if (!password) {
            errorMsg.textContent = 'Bitte Passwort eingeben.';
            return;
        }

        const storedHash = localStorage.getItem(PASSWORD_HASH_KEY);
        if (!storedHash) {
            errorMsg.textContent = 'Fehler: Es ist kein Passwort im System gespeichert.';
            return;
        }

        // 3. Eingegebenes Passwort hashen
        const enteredHash = await hashPassword(password);
        
        // 4. Hashes vergleichen
        if (enteredHash === storedHash) {
            // ERFOLG!
            // Setze einen Session-Marker (dieser wird gelöscht, wenn der Browser geschlossen wird)
            sessionStorage.setItem(SESSION_KEY, 'true');
            
            // Leite zur Startseite weiter
            window.location.href = 'startseite.html';
        } else {
            // FEHLER
            errorMsg.textContent = 'Falsches Passwort.';
        }
    });
});

/**
 * Hash-Funktion (SHA-256)
 * Konvertiert einen String in einen hexadezimalen Hash-String.
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Konvertiere Buffer zu Hex-String
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}