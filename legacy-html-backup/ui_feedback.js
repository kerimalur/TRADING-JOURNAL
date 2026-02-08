/* ====================================================================== */
/* UI FEEDBACK SYSTEM - Loading States, Notifications, Modals            */
/* Skeleton Screens, Progress Indicators, Toast Messages, Alerts         */
/* ====================================================================== */

const UIFeedback = (function() {
    'use strict';

    // =====================================================================
    // TOAST NOTIFICATIONS
    // =====================================================================
    
    class ToastManager {
        constructor() {
            this.container = null;
            this.toasts = [];
            this.maxToasts = 5;
            this.init();
        }
        
        init() {
            if (!document.getElementById('toast-container')) {
                this.container = document.createElement('div');
                this.container.id = 'toast-container';
                this.container.className = 'toast-container';
                document.body.appendChild(this.container);
            } else {
                this.container = document.getElementById('toast-container');
            }
        }
        
        show(message, type = 'info', duration = 3000) {
            const id = Date.now() + Math.random();
            
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.dataset.id = id;
            
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-times-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };
            
            toast.innerHTML = `
                <div class="toast-icon">
                    <i class="fas ${icons[type]}"></i>
                </div>
                <div class="toast-content">
                    <p>${message}</p>
                </div>
                <button class="toast-close" onclick="this.closest('.toast').remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            this.container.appendChild(toast);
            this.toasts.push({ id, element: toast });
            
            // Limitiere Anzahl
            if (this.toasts.length > this.maxToasts) {
                const oldest = this.toasts.shift();
                oldest.element.remove();
            }
            
            // Animation einblenden
            requestAnimationFrame(() => {
                toast.classList.add('toast-show');
            });
            
            // Auto-Hide
            if (duration > 0) {
                setTimeout(() => this.hide(id), duration);
            }
            
            return id;
        }
        
        hide(id) {
            const toast = this.toasts.find(t => t.id === id);
            if (!toast) return;
            
            toast.element.classList.remove('toast-show');
            setTimeout(() => {
                toast.element.remove();
                this.toasts = this.toasts.filter(t => t.id !== id);
            }, 300);
        }
        
        clear() {
            this.toasts.forEach(toast => toast.element.remove());
            this.toasts = [];
        }
    }

    // =====================================================================
    // LOADING INDICATORS
    // =====================================================================
    
    class LoadingIndicator {
        constructor() {
            this.overlay = null;
            this.activeLoaders = new Set();
        }
        
        show(message = 'Lädt...', options = {}) {
            const id = Date.now() + Math.random();
            this.activeLoaders.add(id);
            
            if (!this.overlay) {
                this.createOverlay();
            }
            
            this.updateMessage(message);
            this.overlay.classList.add('active');
            
            // Optionaler Timeout
            if (options.timeout) {
                setTimeout(() => this.hide(id), options.timeout);
            }
            
            return id;
        }
        
        hide(id) {
            if (id) {
                this.activeLoaders.delete(id);
            }
            
            // Verstecke nur wenn keine aktiven Loader mehr
            if (this.activeLoaders.size === 0 && this.overlay) {
                this.overlay.classList.remove('active');
            }
        }
        
        createOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.className = 'loading-overlay';
            this.overlay.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p class="loading-message">Lädt...</p>
                </div>
            `;
            document.body.appendChild(this.overlay);
        }
        
        updateMessage(message) {
            if (this.overlay) {
                const messageEl = this.overlay.querySelector('.loading-message');
                if (messageEl) {
                    messageEl.textContent = message;
                }
            }
        }
    }

    // =====================================================================
    // PROGRESS BAR
    // =====================================================================
    
    class ProgressBar {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            this.progressBar = null;
            this.progressText = null;
            this.init();
        }
        
        init() {
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.className = 'progress-container';
                document.body.appendChild(this.container);
            }
            
            this.container.innerHTML = `
                <div class="progress-bar-wrapper">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">0%</div>
                </div>
            `;
            
            this.progressBar = this.container.querySelector('.progress-fill');
            this.progressText = this.container.querySelector('.progress-text');
        }
        
        setProgress(percent, text = null) {
            percent = Math.max(0, Math.min(100, percent));
            
            if (this.progressBar) {
                this.progressBar.style.width = `${percent}%`;
            }
            
            if (this.progressText) {
                this.progressText.textContent = text || `${Math.round(percent)}%`;
            }
        }
        
        show() {
            if (this.container) {
                this.container.style.display = 'block';
            }
        }
        
        hide() {
            if (this.container) {
                this.container.style.display = 'none';
            }
        }
        
        reset() {
            this.setProgress(0);
        }
    }

    // =====================================================================
    // SKELETON SCREENS
    // =====================================================================
    
    class SkeletonLoader {
        static createSkeleton(type, count = 1) {
            const templates = {
                card: `
                    <div class="skeleton-card">
                        <div class="skeleton-header"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                `,
                table: `
                    <div class="skeleton-table">
                        <div class="skeleton-row"></div>
                        <div class="skeleton-row"></div>
                        <div class="skeleton-row"></div>
                    </div>
                `,
                chart: `
                    <div class="skeleton-chart">
                        <div class="skeleton-bars">
                            <div class="skeleton-bar"></div>
                            <div class="skeleton-bar"></div>
                            <div class="skeleton-bar"></div>
                            <div class="skeleton-bar"></div>
                        </div>
                    </div>
                `,
                text: `
                    <div class="skeleton-text">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                `
            };
            
            const template = templates[type] || templates.card;
            return template.repeat(count);
        }
        
        static show(containerId, type = 'card', count = 3) {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            container.innerHTML = this.createSkeleton(type, count);
            container.classList.add('skeleton-loading');
        }
        
        static hide(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            container.classList.remove('skeleton-loading');
        }
    }

    // =====================================================================
    // MODAL DIALOGS
    // =====================================================================
    
    class ModalManager {
        static show(options = {}) {
            const {
                title = 'Modal',
                content = '',
                type = 'info', // info, warning, danger, success
                buttons = [
                    { text: 'OK', className: 'primary', onClick: null }
                ],
                closeOnOverlay = true,
                onClose = null
            } = options;
            
            const modal = document.createElement('div');
            modal.className = `modal-overlay modal-${type} active`;
            
            const buttonsHTML = buttons.map(btn => `
                <button class="btn ${btn.className || 'secondary'}" data-action="${btn.action || 'custom'}">
                    ${btn.text}
                </button>
            `).join('');
            
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    <div class="modal-footer">
                        ${buttonsHTML}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Event-Handler
            const closeModal = () => {
                modal.classList.remove('active');
                setTimeout(() => modal.remove(), 300);
                if (onClose) onClose();
            };
            
            modal.querySelector('.modal-close').addEventListener('click', closeModal);
            
            if (closeOnOverlay) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        closeModal();
                    }
                });
            }
            
            // Button-Handler
            buttons.forEach((btn, index) => {
                const btnEl = modal.querySelectorAll('.modal-footer button')[index];
                btnEl.addEventListener('click', () => {
                    if (btn.onClick) {
                        const result = btn.onClick();
                        if (result !== false) {
                            closeModal();
                        }
                    } else {
                        closeModal();
                    }
                });
            });
            
            return {
                element: modal,
                close: closeModal
            };
        }
        
        static confirm(message, title = 'Bestätigung') {
            return new Promise((resolve) => {
                this.show({
                    title: title,
                    content: `<p>${message}</p>`,
                    type: 'warning',
                    buttons: [
                        {
                            text: 'Abbrechen',
                            className: 'secondary',
                            onClick: () => resolve(false)
                        },
                        {
                            text: 'Bestätigen',
                            className: 'primary',
                            onClick: () => resolve(true)
                        }
                    ]
                });
            });
        }
        
        static alert(message, title = 'Hinweis', type = 'info') {
            return new Promise((resolve) => {
                this.show({
                    title: title,
                    content: `<p>${message}</p>`,
                    type: type,
                    buttons: [
                        {
                            text: 'OK',
                            className: 'primary',
                            onClick: () => resolve(true)
                        }
                    ]
                });
            });
        }
    }

    // =====================================================================
    // FORM VALIDATION FEEDBACK
    // =====================================================================
    
    class FormValidator {
        static showError(inputElement, message) {
            inputElement.classList.add('input-error');
            
            // Entferne alte Fehlermeldung
            const existingError = inputElement.parentElement.querySelector('.error-message');
            if (existingError) {
                existingError.remove();
            }
            
            // Füge neue Fehlermeldung hinzu
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            inputElement.parentElement.appendChild(errorDiv);
        }
        
        static clearError(inputElement) {
            inputElement.classList.remove('input-error');
            
            const errorDiv = inputElement.parentElement.querySelector('.error-message');
            if (errorDiv) {
                errorDiv.remove();
            }
        }
        
        static showSuccess(inputElement) {
            inputElement.classList.remove('input-error');
            inputElement.classList.add('input-success');
            
            const errorDiv = inputElement.parentElement.querySelector('.error-message');
            if (errorDiv) {
                errorDiv.remove();
            }
        }
    }

    // =====================================================================
    // EMPTY STATE
    // =====================================================================
    
    class EmptyState {
        static show(containerId, options = {}) {
            const {
                icon = 'fa-inbox',
                title = 'Keine Daten',
                message = 'Es sind noch keine Einträge vorhanden.',
                actionText = null,
                actionCallback = null
            } = options;
            
            const container = document.getElementById(containerId);
            if (!container) return;
            
            const actionHTML = actionText ? `
                <button class="btn primary empty-state-action">
                    ${actionText}
                </button>
            ` : '';
            
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <h3>${title}</h3>
                    <p>${message}</p>
                    ${actionHTML}
                </div>
            `;
            
            if (actionCallback) {
                const actionBtn = container.querySelector('.empty-state-action');
                if (actionBtn) {
                    actionBtn.addEventListener('click', actionCallback);
                }
            }
        }
    }

    // =====================================================================
    // INITIALIZATION
    // =====================================================================
    
    const toastManager = new ToastManager();
    const loadingIndicator = new LoadingIndicator();

    // =====================================================================
    // PUBLIC API
    // =====================================================================
    return {
        // Toast
        toast: {
            show: (msg, type, duration) => toastManager.show(msg, type, duration),
            success: (msg) => toastManager.show(msg, 'success'),
            error: (msg) => toastManager.show(msg, 'error'),
            warning: (msg) => toastManager.show(msg, 'warning'),
            info: (msg) => toastManager.show(msg, 'info'),
            hide: (id) => toastManager.hide(id),
            clear: () => toastManager.clear()
        },
        
        // Loading
        loading: {
            show: (msg, opts) => loadingIndicator.show(msg, opts),
            hide: (id) => loadingIndicator.hide(id),
            update: (msg) => loadingIndicator.updateMessage(msg)
        },
        
        // Progress
        ProgressBar,
        
        // Skeleton
        skeleton: SkeletonLoader,
        
        // Modal
        modal: ModalManager,
        
        // Form Validation
        form: FormValidator,
        
        // Empty State
        empty: EmptyState
    };
})();

// Globaler Export
window.UIFeedback = UIFeedback;

// Füge CSS für UI-Komponenten hinzu
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('ui-feedback-styles')) {
        const style = document.createElement('style');
        style.id = 'ui-feedback-styles';
        style.textContent = `
            /* Toast Container */
            .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            
            .toast {
                display: flex;
                align-items: center;
                gap: 12px;
                background: var(--color-surface, #24282F);
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                min-width: 300px;
                max-width: 500px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                pointer-events: auto;
            }
            
            .toast-show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .toast-success { border-left: 4px solid #00FFD1; }
            .toast-error { border-left: 4px solid #FF4757; }
            .toast-warning { border-left: 4px solid #FFA502; }
            .toast-info { border-left: 4px solid #00C8FF; }
            
            .toast-icon { font-size: 24px; }
            .toast-success .toast-icon { color: #00FFD1; }
            .toast-error .toast-icon { color: #FF4757; }
            .toast-warning .toast-icon { color: #FFA502; }
            .toast-info .toast-icon { color: #00C8FF; }
            
            .toast-content { flex: 1; }
            .toast-content p { margin: 0; color: var(--color-text-light, #F8F9FA); }
            
            .toast-close {
                background: none;
                border: none;
                color: var(--color-text-subtle, #9EA0A8);
                cursor: pointer;
                padding: 4px;
            }
            
            /* Loading Overlay */
            .loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            
            .loading-overlay.active {
                display: flex;
            }
            
            .loading-spinner {
                text-align: center;
            }
            
            .spinner {
                width: 50px;
                height: 50px;
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-top-color: #00FFD1;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .loading-message {
                color: white;
                font-size: 16px;
                margin: 0;
            }
            
            /* Skeleton Loader */
            .skeleton-card, .skeleton-table, .skeleton-chart, .skeleton-text {
                background: var(--color-surface, #24282F);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
            }
            
            .skeleton-header, .skeleton-line, .skeleton-row, .skeleton-bar {
                background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
                border-radius: 4px;
                margin-bottom: 12px;
            }
            
            .skeleton-header { height: 24px; width: 60%; }
            .skeleton-line { height: 16px; }
            .skeleton-line.short { width: 40%; }
            .skeleton-row { height: 40px; }
            .skeleton-bar { height: 60px; width: 20%; display: inline-block; margin-right: 8px; }
            
            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            
            /* Error/Success Input States */
            .input-error {
                border-color: #FF4757 !important;
            }
            
            .input-success {
                border-color: #00FFD1 !important;
            }
            
            .error-message {
                color: #FF4757;
                font-size: 12px;
                margin-top: 4px;
            }
            
            /* Empty State */
            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: var(--color-text-subtle, #9EA0A8);
            }
            
            .empty-state-icon {
                font-size: 64px;
                margin-bottom: 20px;
                opacity: 0.5;
            }
            
            .empty-state h3 {
                color: var(--color-text-light, #F8F9FA);
                margin-bottom: 12px;
            }
            
            .empty-state p {
                margin-bottom: 24px;
            }
        `;
        document.head.appendChild(style);
    }
});
