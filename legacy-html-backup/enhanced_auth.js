/* ====================================================================== */
/* ENHANCED AUTH SYSTEM - Verbesserte Sicherheit & Session-Management    */
/* PBKDF2, Session-Timeout, Brute-Force Schutz, Encryption               */
/* ====================================================================== */

const EnhancedAuth = (function() {
    'use strict';

    // =====================================================================
    // KONFIGURATION
    // =====================================================================
    const CONFIG = {
        PBKDF2_ITERATIONS: 100000,
        SALT_LENGTH: 16,
        SESSION_TIMEOUT: 30 * 60 * 1000, // 30 Minuten
        MAX_LOGIN_ATTEMPTS: 5,
        LOCKOUT_DURATION: 15 * 60 * 1000, // 15 Minuten
        STORAGE_KEYS: {
            PASSWORD_HASH: 'tradingJournalPasswordHash_v2',
            SALT: 'tradingJournalSalt',
            SESSION: 'tradingJournalSessionActive',
            SESSION_START: 'tradingJournalSessionStart',
            LAST_ACTIVITY: 'tradingJournalLastActivity',
            LOGIN_ATTEMPTS: 'tradingJournalLoginAttempts',
            LOCKOUT_UNTIL: 'tradingJournalLockoutUntil',
            ENCRYPTION_KEY: 'tradingJournalEncryptionKey'
        }
    };

    let sessionCheckInterval = null;

    // =====================================================================
    // PBKDF2 PASSWORD HASHING
    // =====================================================================
    
    /**
     * Generiert einen zufälligen Salt
     */
    function generateSalt() {
        const array = new Uint8Array(CONFIG.SALT_LENGTH);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Hasht Passwort mit PBKDF2
     */
    async function hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const saltBuffer = encoder.encode(salt);
        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: CONFIG.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        
        const hashArray = Array.from(new Uint8Array(derivedBits));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Erstellt neues Passwort
     */
    async function createPassword(password) {
        if (!password || password.length < 6) {
            throw new Error('Passwort muss mindestens 6 Zeichen lang sein');
        }
        
        const salt = generateSalt();
        const hash = await hashPassword(password, salt);
        
        localStorage.setItem(CONFIG.STORAGE_KEYS.SALT, salt);
        localStorage.setItem(CONFIG.STORAGE_KEYS.PASSWORD_HASH, hash);
        
        console.log('✅ Passwort erstellt');
        return true;
    }
    
    /**
     * Verifiziert Passwort
     */
    async function verifyPassword(password) {
        const storedHash = localStorage.getItem(CONFIG.STORAGE_KEYS.PASSWORD_HASH);
        const salt = localStorage.getItem(CONFIG.STORAGE_KEYS.SALT);
        
        if (!storedHash || !salt) {
            throw new Error('Kein Passwort gesetzt');
        }
        
        const hash = await hashPassword(password, salt);
        return hash === storedHash;
    }

    // =====================================================================
    // BRUTE-FORCE PROTECTION
    // =====================================================================
    
    /**
     * Prüft ob Account gesperrt ist
     */
    function isAccountLocked() {
        const lockoutUntil = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.LOCKOUT_UNTIL) || '0');
        
        if (lockoutUntil > Date.now()) {
            const remainingMinutes = Math.ceil((lockoutUntil - Date.now()) / 60000);
            return {
                locked: true,
                remainingMinutes: remainingMinutes
            };
        }
        
        // Lockout abgelaufen, reset
        localStorage.removeItem(CONFIG.STORAGE_KEYS.LOCKOUT_UNTIL);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.LOGIN_ATTEMPTS);
        
        return { locked: false };
    }
    
    /**
     * Erhöht Login-Versuche
     */
    function incrementLoginAttempts() {
        const attempts = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.LOGIN_ATTEMPTS) || '0') + 1;
        localStorage.setItem(CONFIG.STORAGE_KEYS.LOGIN_ATTEMPTS, attempts.toString());
        
        if (attempts >= CONFIG.MAX_LOGIN_ATTEMPTS) {
            const lockoutUntil = Date.now() + CONFIG.LOCKOUT_DURATION;
            localStorage.setItem(CONFIG.STORAGE_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
            
            console.warn('🔒 Account locked due to too many failed attempts');
            return {
                locked: true,
                remainingMinutes: CONFIG.LOCKOUT_DURATION / 60000
            };
        }
        
        return {
            locked: false,
            attemptsRemaining: CONFIG.MAX_LOGIN_ATTEMPTS - attempts
        };
    }
    
    /**
     * Reset Login-Versuche
     */
    function resetLoginAttempts() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.LOGIN_ATTEMPTS);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.LOCKOUT_UNTIL);
    }

    // =====================================================================
    // SESSION MANAGEMENT
    // =====================================================================
    
    /**
     * Startet neue Session
     */
    function startSession() {
        const now = Date.now();
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, 'true');
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_START, now.toString());
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ACTIVITY, now.toString());
        
        resetLoginAttempts();
        startSessionCheck();
        
        console.log('✅ Session started');
    }
    
    /**
     * Beendet Session
     */
    function endSession() {
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION_START);
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.LAST_ACTIVITY);
        
        stopSessionCheck();
        
        console.log('🔓 Session ended');
    }
    
    /**
     * Prüft ob Session aktiv ist
     */
    function isSessionActive() {
        const sessionActive = sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION) === 'true';
        
        if (!sessionActive) {
            return false;
        }
        
        // Prüfe Timeout
        const lastActivity = parseInt(sessionStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ACTIVITY) || '0');
        const now = Date.now();
        
        if (now - lastActivity > CONFIG.SESSION_TIMEOUT) {
            console.warn('⏱️ Session timeout');
            endSession();
            return false;
        }
        
        return true;
    }
    
    /**
     * Aktualisiert letzte Aktivität
     */
    function updateActivity() {
        if (isSessionActive()) {
            sessionStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
        }
    }
    
    /**
     * Startet Session-Check Timer
     */
    function startSessionCheck() {
        stopSessionCheck(); // Cleanup existing
        
        // Prüfe alle 60 Sekunden
        sessionCheckInterval = setInterval(() => {
            if (!isSessionActive()) {
                console.warn('Session expired, redirecting to login...');
                window.location.href = 'login.html';
            }
        }, 60000);
        
        // Activity Tracker
        ['click', 'keydown', 'scroll', 'mousemove'].forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true, once: false });
        });
    }
    
    /**
     * Stoppt Session-Check Timer
     */
    function stopSessionCheck() {
        if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval);
            sessionCheckInterval = null;
        }
    }
    
    /**
     * Gibt Session-Info zurück
     */
    function getSessionInfo() {
        if (!isSessionActive()) {
            return null;
        }
        
        const sessionStart = parseInt(sessionStorage.getItem(CONFIG.STORAGE_KEYS.SESSION_START) || '0');
        const lastActivity = parseInt(sessionStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ACTIVITY) || '0');
        const now = Date.now();
        
        return {
            active: true,
            duration: now - sessionStart,
            timeSinceActivity: now - lastActivity,
            expiresIn: CONFIG.SESSION_TIMEOUT - (now - lastActivity)
        };
    }

    // =====================================================================
    // LOGIN/LOGOUT
    // =====================================================================
    
    /**
     * Login-Prozess
     */
    async function login(password) {
        // Prüfe Lockout
        const lockStatus = isAccountLocked();
        if (lockStatus.locked) {
            throw new Error(`Account gesperrt. Versuche es in ${lockStatus.remainingMinutes} Minuten erneut.`);
        }
        
        // Verifiziere Passwort
        const isValid = await verifyPassword(password);
        
        if (!isValid) {
            const attemptStatus = incrementLoginAttempts();
            
            if (attemptStatus.locked) {
                throw new Error(`Zu viele fehlgeschlagene Versuche. Account für ${attemptStatus.remainingMinutes} Minuten gesperrt.`);
            }
            
            throw new Error(`Falsches Passwort. ${attemptStatus.attemptsRemaining} Versuche verbleibend.`);
        }
        
        // Login erfolgreich
        startSession();
        return true;
    }
    
    /**
     * Logout-Prozess
     */
    function logout() {
        endSession();
        window.location.href = 'login.html';
    }
    
    /**
     * Ändert Passwort
     */
    async function changePassword(oldPassword, newPassword) {
        // Verifiziere altes Passwort
        const isValid = await verifyPassword(oldPassword);
        
        if (!isValid) {
            throw new Error('Altes Passwort ist falsch');
        }
        
        // Setze neues Passwort
        await createPassword(newPassword);
        
        console.log('✅ Passwort geändert');
        return true;
    }

    // =====================================================================
    // DATA ENCRYPTION (Optional)
    // =====================================================================
    
    /**
     * Generiert Encryption Key
     */
    async function generateEncryptionKey() {
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        
        const exported = await crypto.subtle.exportKey('jwk', key);
        localStorage.setItem(CONFIG.STORAGE_KEYS.ENCRYPTION_KEY, JSON.stringify(exported));
        
        return key;
    }
    
    /**
     * Holt Encryption Key
     */
    async function getEncryptionKey() {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.ENCRYPTION_KEY);
        
        if (!stored) {
            return await generateEncryptionKey();
        }
        
        const keyData = JSON.parse(stored);
        return await crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
    }
    
    /**
     * Verschlüsselt Daten
     */
    async function encryptData(data) {
        try {
            const key = await getEncryptionKey();
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                dataBuffer
            );
            
            return {
                encrypted: Array.from(new Uint8Array(encrypted)),
                iv: Array.from(iv)
            };
        } catch (error) {
            console.error('Encryption failed:', error);
            throw error;
        }
    }
    
    /**
     * Entschlüsselt Daten
     */
    async function decryptData(encryptedData) {
        try {
            const key = await getEncryptionKey();
            
            const encrypted = new Uint8Array(encryptedData.encrypted);
            const iv = new Uint8Array(encryptedData.iv);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            return JSON.parse(decoder.decode(decrypted));
        } catch (error) {
            console.error('Decryption failed:', error);
            throw error;
        }
    }

    // =====================================================================
    // MIGRATION VON ALTEM AUTH-SYSTEM
    // =====================================================================
    
    /**
     * Migriert vom SHA-256 zum PBKDF2 System
     */
    async function migrateFromOldAuth() {
        const oldHash = localStorage.getItem('tradingJournalPasswordHash');
        const newHash = localStorage.getItem(CONFIG.STORAGE_KEYS.PASSWORD_HASH);
        
        // Wenn altes System aber kein neues
        if (oldHash && !newHash) {
            console.warn('⚠️ Old auth system detected. Migration required on next login.');
            return true; // Migration benötigt
        }
        
        return false; // Keine Migration nötig
    }
    
    /**
     * Führt Migration durch (wird beim Login aufgerufen)
     */
    async function performMigration(password) {
        console.log('🔄 Migrating to enhanced auth system...');
        
        // Erstelle neues Passwort mit PBKDF2
        await createPassword(password);
        
        // Lösche altes Hash
        localStorage.removeItem('tradingJournalPasswordHash');
        
        console.log('✅ Migration complete');
    }

    // =====================================================================
    // PUBLIC API
    // =====================================================================
    return {
        // Password Management
        createPassword,
        verifyPassword,
        changePassword,
        
        // Login/Logout
        login,
        logout,
        
        // Session
        isSessionActive,
        startSession,
        endSession,
        getSessionInfo,
        updateActivity,
        
        // Brute-Force Protection
        isAccountLocked,
        resetLoginAttempts,
        
        // Encryption
        encryptData,
        decryptData,
        
        // Migration
        migrateFromOldAuth,
        performMigration,
        
        // Config
        CONFIG
    };
})();

// Globaler Export
window.EnhancedAuth = EnhancedAuth;

// Auto-Init: Session-Check starten wenn Session aktiv
document.addEventListener('DOMContentLoaded', () => {
    if (EnhancedAuth.isSessionActive()) {
        EnhancedAuth.startSession();
    }
    
    // Migration-Check
    EnhancedAuth.migrateFromOldAuth();
});
