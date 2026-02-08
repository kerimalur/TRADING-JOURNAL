 // auth_guard.js
// ======================================
// SPERRBILDSHIRM-LOGIK
// ======================================

(function() {
    const SESSION_KEY = 'tradingJournalSessionActive';
    const PASSWORD_HASH_KEY = 'tradingJournalPasswordHash';

    // 1. Prüfen, ob die aktuelle Seite die Login-Seite oder die Einstellungsseite ist.
    // Diese Seiten dürfen immer geladen werden.
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'login.html' || currentPage === 'kontoeinstellungen.html') {
        return; // Zugriff erlauben
    }

    // 2. Prüfen, ob ein Passwort im System gesetzt ist.
    const passwordIsSet = !!localStorage.getItem(PASSWORD_HASH_KEY);

    if (!passwordIsSet) {
        // Wenn kein Passwort gesetzt ist, leitet zur Einstellungsseite um, 
        // damit der Nutzer eines erstellen kann.
        alert("Willkommen! Bitte lege zuerst ein Passwort in den Kontoeinstellungen fest.");
        window.location.href = 'kontoeinstellungen.html';
        return;
    }

    // 3. Prüfen, ob eine aktive Session vorhanden ist.
    const sessionActive = sessionStorage.getItem(SESSION_KEY) === 'true';

    if (!sessionActive) {
        // Wenn ein Passwort gesetzt ist, aber die Session nicht aktiv ist -> ZUM LOGIN
        window.location.href = 'login.html';
    }
    
    // 4. Wenn Session aktiv ist -> Zugriff erlaubt, nichts tun.

})();