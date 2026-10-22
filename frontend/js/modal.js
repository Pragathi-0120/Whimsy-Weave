/* ===================================
   WHIMSY & WEAVE MODAL SYSTEM
   Premium notification & alert component
=================================== */

class WhimsyModal {
    constructor() {
        this.modals = new Map();
        this.createModalStyles();
        this.setupGlobalModal();
    }

    createModalStyles() {
        if (document.getElementById('whimsy-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'whimsy-modal-styles';
        style.textContent = `
            /* ===== MODAL OVERLAY ===== */
            .whimsy-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }

            .whimsy-modal-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            /* ===== MODAL CONTAINER ===== */
            .whimsy-modal-container {
                background: white;
                border-radius: 20px;
                padding: 0;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
                transform: scale(0.85) translateY(30px);
                transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.5);
                position: relative;
            }

            .whimsy-modal-overlay.active .whimsy-modal-container {
                transform: scale(1) translateY(0);
            }

            /* ===== MODAL HEADER ===== */
            .whimsy-modal-header {
                padding: 2rem 2rem 1rem;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 1rem;
            }

            .whimsy-modal-icon {
                font-size: 2.5rem;
                line-height: 1;
                min-width: max-content;
            }

            .whimsy-modal-title {
                font-size: 1.5rem;
                font-weight: 600;
                color: #1a1a1a;
                margin: 0;
                padding: 0;
                line-height: 1.2;
            }

            /* ===== MODAL CONTENT ===== */
            .whimsy-modal-content {
                padding: 0 2rem 2rem;
                color: #666;
                font-size: 1rem;
                line-height: 1.6;
                text-align: center;
            }

            /* ===== MODAL FOOTER ===== */
            .whimsy-modal-footer {
                padding: 1.5rem 2rem;
                display: flex;
                gap: 1rem;
                justify-content: center;
                flex-wrap: wrap;
                border-top: 1px solid #f0f0f0;
            }

            .whimsy-modal-footer.single-action {
                justify-content: center;
            }

            /* ===== MODAL BUTTONS ===== */
            .whimsy-modal-btn {
                padding: 0.75rem 2rem;
                border: none;
                border-radius: 10px;
                font-size: 0.95rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: 'Inter', sans-serif;
            }

            .whimsy-modal-btn-primary {
                background: linear-gradient(135deg, #d4a5a5 0%, #c48b8b 100%);
                color: white;
            }

            .whimsy-modal-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(212, 165, 165, 0.4);
            }

            .whimsy-modal-btn-secondary {
                background: #f5f5f5;
                color: #333;
            }

            .whimsy-modal-btn-secondary:hover {
                background: #eeeeee;
                transform: translateY(-2px);
            }

            /* ===== SUCCESS STATE ===== */
            .whimsy-modal-container.success .whimsy-modal-header {
                background: linear-gradient(135deg, #d4f1d4 0%, #e8f5e8 100%);
            }

            .whimsy-modal-container.success .whimsy-modal-icon {
                animation: successBounce 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            }

            /* ===== ERROR STATE ===== */
            .whimsy-modal-container.error .whimsy-modal-header {
                background: linear-gradient(135deg, #ffd4d4 0%, #ffe8e8 100%);
            }

            .whimsy-modal-container.error .whimsy-modal-icon {
                animation: errorShake 0.5s ease;
            }

            /* ===== WARNING STATE ===== */
            .whimsy-modal-container.warning .whimsy-modal-header {
                background: linear-gradient(135deg, #fff3d4 0%, #fffae8 100%);
            }

            /* ===== INFO STATE ===== */
            .whimsy-modal-container.info .whimsy-modal-header {
                background: linear-gradient(135deg, #d4e5ff 0%, #e8f0ff 100%);
            }

            /* ===== LOADING STATE ===== */
            .whimsy-modal-container.loading .whimsy-modal-header {
                background: linear-gradient(135deg, #e8d4f1 0%, #f0e8f5 100%);
            }

            .whimsy-modal-spinner {
                display: inline-block;
                width: 40px;
                height: 40px;
                border: 3px solid #d4a5a5;
                border-top-color: #c48b8b;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            /* ===== ANIMATIONS ===== */
            @keyframes successBounce {
                0% { transform: scale(0) rotate(-180deg); }
                50% { transform: scale(1.15); }
                100% { transform: scale(1); }
            }

            @keyframes errorShake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* ===== NOTIFICATION TOAST ===== */
            .whimsy-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 400px;
                padding: 1rem 1.5rem;
                border-radius: 12px;
                background: white;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
                border-left: 4px solid #d4a5a5;
                display: flex;
                gap: 1rem;
                align-items: center;
                animation: slideInRight 0.4s ease;
                z-index: 10000;
            }

            .whimsy-notification.success {
                border-left-color: #4caf50;
                background: #f1f8f4;
            }

            .whimsy-notification.error {
                border-left-color: #f44336;
                background: #fef5f5;
            }

            .whimsy-notification.warning {
                border-left-color: #ff9800;
                background: #fef9f5;
            }

            .whimsy-notification.info {
                border-left-color: #2196f3;
                background: #f0f7ff;
            }

            .whimsy-notification-content {
                flex: 1;
                color: #333;
                font-weight: 500;
            }

            .whimsy-notification-close {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 1.2rem;
                color: #999;
                transition: color 0.2s;
            }

            .whimsy-notification-close:hover {
                color: #333;
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }

            @media (max-width: 640px) {
                .whimsy-modal-container {
                    width: 95%;
                    max-width: none;
                }

                .whimsy-modal-header {
                    flex-direction: column;
                    text-align: center;
                }

                .whimsy-notification {
                    left: 10px;
                    right: 10px;
                    top: auto;
                    bottom: 20px;
                }

                .whimsy-modal-footer {
                    flex-direction: column;
                }

                .whimsy-modal-btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupGlobalModal() {
        const overlay = document.createElement('div');
        overlay.id = 'whimsy-modal-global';
        overlay.className = 'whimsy-modal-overlay';
        overlay.innerHTML = '<div class="whimsy-modal-container"></div>';
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.close();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
    }

    show(config = {}) {
        const {
            type = 'info',
            title = 'Notification',
            message = '',
            icon = this.getIcon(type),
            primaryBtn = { text: 'Okay', callback: null },
            secondaryBtn = null,
            onClose = null,
            autoClose = null
        } = config;

        const overlay = document.getElementById('whimsy-modal-global');
        const container = overlay.querySelector('.whimsy-modal-container');

        // Build modal HTML
        let html = `
            <div class="whimsy-modal-header">
                <div class="whimsy-modal-icon">${icon}</div>
                <h2 class="whimsy-modal-title">${title}</h2>
            </div>
            ${message ? `<div class="whimsy-modal-content">${message}</div>` : ''}
        `;

        if (primaryBtn || secondaryBtn) {
            const isSingleAction = primaryBtn && !secondaryBtn;
            html += `<div class="whimsy-modal-footer ${isSingleAction ? 'single-action' : ''}">`;
            
            if (primaryBtn) {
                html += `<button class="whimsy-modal-btn whimsy-modal-btn-primary" id="whimsy-modal-primary">${primaryBtn.text}</button>`;
            }
            
            if (secondaryBtn) {
                html += `<button class="whimsy-modal-btn whimsy-modal-btn-secondary" id="whimsy-modal-secondary">${secondaryBtn.text}</button>`;
            }
            
            html += '</div>';
        }

        container.className = `whimsy-modal-container ${type}`;
        container.innerHTML = html;

        // Setup button handlers
        if (primaryBtn) {
            const primaryBtnEl = container.querySelector('#whimsy-modal-primary');
            if (primaryBtnEl) {
                primaryBtnEl.addEventListener('click', () => {
                    if (primaryBtn.callback) primaryBtn.callback();
                    this.close();
                });
            }
        }

        if (secondaryBtn) {
            const secondaryBtnEl = container.querySelector('#whimsy-modal-secondary');
            if (secondaryBtnEl) {
                secondaryBtnEl.addEventListener('click', () => {
                    if (secondaryBtn.callback) secondaryBtn.callback();
                    this.close();
                });
            }
        }

        // Show modal
        overlay.classList.add('active');

        // Store callback
        this.currentOnClose = onClose;

        // Auto-close after delay
        if (autoClose) {
            setTimeout(() => this.close(), autoClose);
        }

        return this;
    }

    close() {
        const overlay = document.getElementById('whimsy-modal-global');
        overlay.classList.remove('active');
        
        if (this.currentOnClose) {
            this.currentOnClose();
            this.currentOnClose = null;
        }
    }

    getIcon(type) {
        const icons = {
            success: '✨',
            error: '⚠️',
            warning: '🔔',
            info: 'ℹ️',
            loading: '<div class="whimsy-modal-spinner"></div>'
        };
        return icons[type] || icons.info;
    }

    // Convenience methods
    success(title, message, config = {}) {
        return this.show({
            type: 'success',
            title,
            message,
            ...config
        });
    }

    error(title, message, config = {}) {
        return this.show({
            type: 'error',
            title,
            message,
            ...config
        });
    }

    warning(title, message, config = {}) {
        return this.show({
            type: 'warning',
            title,
            message,
            ...config
        });
    }

    info(title, message, config = {}) {
        return this.show({
            type: 'info',
            title,
            message,
            ...config
        });
    }

    loading(title, message) {
        return this.show({
            type: 'loading',
            title,
            message,
            primaryBtn: null,
            secondaryBtn: null
        });
    }

    // Toast notifications (small, non-intrusive)
    toast(message, type = 'info', duration = 4000) {
        const notif = document.createElement('div');
        notif.className = `whimsy-notification ${type}`;
        notif.innerHTML = `
            <div class="whimsy-notification-content">${message}</div>
            <button class="whimsy-notification-close">✕</button>
        `;

        document.body.appendChild(notif);

        const closeBtn = notif.querySelector('.whimsy-notification-close');
        closeBtn.addEventListener('click', () => {
            notif.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notif.remove(), 300);
        });

        setTimeout(() => {
            if (notif.parentElement) {
                notif.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notif.remove(), 300);
            }
        }, duration);

        return notif;
    }

    confirm(title, message, onConfirm, onCancel) {
        return this.show({
            type: 'info',
            title,
            message,
            primaryBtn: { 
                text: 'Confirm', 
                callback: onConfirm 
            },
            secondaryBtn: { 
                text: 'Cancel', 
                callback: onCancel 
            }
        });
    }
}

// Initialize global modal instance
const whimsyModal = new WhimsyModal();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WhimsyModal;
}
