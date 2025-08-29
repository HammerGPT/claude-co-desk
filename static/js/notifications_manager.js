/**
 * Notification Configuration Manager
 * Manages email notification setup and testing
 */

class NotificationManager {
    constructor() {
        this.emailProviders = {
            'qq.com': {
                nameKey: 'providers.qq',
                host: 'smtp.qq.com',
                port: 587,
                secure: false
            },
            'foxmail.com': {
                nameKey: 'providers.foxmail',
                host: 'smtp.qq.com',
                port: 587,
                secure: false
            },
            '163.com': {
                nameKey: 'providers.163',
                host: 'smtp.163.com',
                port: 465,
                secure: true
            },
            '126.com': {
                nameKey: 'providers.126',
                host: 'smtp.126.com',
                port: 465,
                secure: true
            },
            'gmail.com': {
                nameKey: 'providers.gmail',
                host: 'smtp.gmail.com',
                port: 587,
                secure: false
            },
            'outlook.com': {
                nameKey: 'providers.outlook',
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false
            },
            'hotmail.com': {
                nameKey: 'providers.hotmail',
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false
            },
            'live.com': {
                nameKey: 'providers.live',
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false
            },
            'exmail.qq.com': {
                nameKey: 'providers.exmail',
                host: 'smtp.exmail.qq.com',
                port: 587,
                secure: false
            },
            'heliki.com': {
                nameKey: 'providers.custom',
                host: 'smtp.exmail.qq.com',
                port: 587,
                secure: false
            }
        };
        
        this.currentConfig = null;
        this.testStatus = null;
        this.init();
    }
    
    getText(key) {
        // Use the global i18n system
        return window.i18n ? window.i18n.t(key) : key;
    }
    
    init() {
        this.bindEvents();
        this.loadCurrentConfig();
    }
    
    // Public method to refresh configuration when entering the page
    refresh() {
        this.loadCurrentConfig();
    }
    
    bindEvents() {
        // Email address input change handler
        const emailInput = document.getElementById('email-address');
        if (emailInput) {
            emailInput.addEventListener('input', (e) => this.handleEmailChange(e.target.value));
        }
        
        // Password visibility toggle
        const togglePassword = document.getElementById('toggle-password');
        if (togglePassword) {
            togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
        }
        
        // Test email button
        const testButton = document.getElementById('test-email-config');
        if (testButton) {
            testButton.addEventListener('click', () => this.testEmailConfig());
        }
        
        // Save config button
        const saveButton = document.getElementById('save-email-config');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveEmailConfig());
        }
    }
    
    handleEmailChange(email) {
        if (!email) {
            this.hideConfigPreview();
            return;
        }
        
        const domain = email.split('@')[1];
        if (domain && this.emailProviders[domain]) {
            this.showConfigPreview(this.emailProviders[domain]);
        } else {
            this.hideConfigPreview();
        }
    }
    
    showConfigPreview(provider) {
        const preview = document.getElementById('smtp-config-preview');
        const providerEl = document.getElementById('detected-provider');
        const hostEl = document.getElementById('detected-host');
        const portEl = document.getElementById('detected-port');
        
        if (preview && providerEl && hostEl && portEl) {
            // Use internationalized provider name
            providerEl.textContent = this.getText(provider.nameKey);
            hostEl.textContent = provider.host;
            portEl.textContent = provider.port;
            
            preview.style.display = 'block';
            this.currentProvider = provider;
        }
    }
    
    hideConfigPreview() {
        const preview = document.getElementById('smtp-config-preview');
        if (preview) {
            preview.style.display = 'none';
            this.currentProvider = null;
        }
    }
    
    togglePasswordVisibility() {
        const passwordInput = document.getElementById('app-password');
        const toggleBtn = document.getElementById('toggle-password');
        
        if (passwordInput && toggleBtn) {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            
            // Update icon
            const svg = toggleBtn.querySelector('svg');
            if (svg) {
                if (isPassword) {
                    svg.innerHTML = `
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                    `;
                } else {
                    svg.innerHTML = `
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    `;
                }
            }
        }
    }
    
    async testEmailConfig() {
        const emailInput = document.getElementById('email-address');
        const senderNameInput = document.getElementById('sender-name');
        const passwordInput = document.getElementById('app-password');
        const testButton = document.getElementById('test-email-config');
        const testResult = document.getElementById('email-test-result');
        
        if (!emailInput?.value || !passwordInput?.value) {
            this.showTestResult(false, this.getText('notifications.fillRequired'));
            return;
        }
        
        if (!this.currentProvider) {
            this.showTestResult(false, this.getText('notifications.unsupportedProvider'));
            return;
        }
        
        // Show loading state
        const originalText = testButton.textContent;
        testButton.textContent = 'Sending...';
        testButton.disabled = true;
        
        try {
            // Get selected port or use provider default
            const portSelect = document.getElementById('smtp-port');
            const selectedPort = portSelect?.value ? parseInt(portSelect.value) : this.currentProvider.port;
            
            // Update provider with selected port
            const providerWithPort = {
                ...this.currentProvider,
                port: selectedPort
            };
            
            const config = {
                email: emailInput.value,
                senderName: senderNameInput.value || 'Claude Co-Desk',
                password: passwordInput.value,
                provider: providerWithPort
            };
            
            const response = await fetch('/api/notifications/test-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showTestResult(true, this.getText('notifications.testSuccess'));
                this.testStatus = 'success';
                this.updateConfigStatus('tested', this.getText('notifications.testSuccess'));
            } else {
                this.showTestResult(false, `${this.getText('notifications.testFailed')}: ${result.error || this.getText('error.unknown')}`);
                this.testStatus = 'failed';
            }
            
        } catch (error) {
            console.error('Test email error:', error);
            this.showTestResult(false, `${this.getText('notifications.networkError')}: ${error.message}`);
            this.testStatus = 'failed';
        } finally {
            testButton.textContent = originalText;
            testButton.disabled = false;
        }
    }
    
    async saveEmailConfig() {
        const emailInput = document.getElementById('email-address');
        const senderNameInput = document.getElementById('sender-name');
        const passwordInput = document.getElementById('app-password');
        const portSelect = document.getElementById('smtp-port');
        const saveButton = document.getElementById('save-email-config');
        
        if (!emailInput?.value || !passwordInput?.value) {
            this.showTestResult(false, this.getText('notifications.fillRequired'));
            return;
        }
        
        if (!this.currentProvider) {
            this.showTestResult(false, this.getText('notifications.unsupportedProvider'));
            return;
        }
        
        // Show loading state
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Saving...';
        saveButton.disabled = true;
        
        try {
            // Get selected port or use provider default
            const selectedPort = portSelect?.value ? parseInt(portSelect.value) : this.currentProvider.port;
            
            // Update provider with selected port
            const providerWithPort = {
                ...this.currentProvider,
                port: selectedPort
            };
            
            const config = {
                email: emailInput.value,
                senderName: senderNameInput.value || 'Claude Co-Desk',
                password: passwordInput.value,
                provider: providerWithPort,
                testStatus: this.testStatus
            };
            
            const response = await fetch('/api/notifications/save-email-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showTestResult(true, this.getText('notifications.saveSuccess'));
                // Reset test status when configuration is saved (config changed, old test invalid)
                this.testStatus = null;
                this.updateConfigStatus('configured', this.getText('notifications.configuredNotTested'));
                this.currentConfig = config;
            } else {
                this.showTestResult(false, `${this.getText('notifications.saveFailed')}: ${result.error || this.getText('error.unknown')}`);
            }
            
        } catch (error) {
            console.error('Save email config error:', error);
            this.showTestResult(false, `${this.getText('notifications.networkError')}: ${error.message}`);
        } finally {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }
    }
    
    showTestResult(success, message) {
        const testResult = document.getElementById('email-test-result');
        const resultIcon = document.getElementById('test-result-icon');
        const resultMessage = document.getElementById('test-result-message');
        
        if (!testResult || !resultIcon || !resultMessage) return;
        
        resultMessage.textContent = message;
        
        if (success) {
            resultIcon.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #28a745;">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
            `;
            testResult.className = 'test-result success';
        } else {
            resultIcon.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #dc3545;">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            `;
            testResult.className = 'test-result error';
        }
        
        testResult.style.display = 'block';
        
        // Auto hide after 5 seconds for success messages
        if (success) {
            setTimeout(() => {
                testResult.style.display = 'none';
            }, 5000);
        }
    }
    
    updateConfigStatus(status, text) {
        const indicator = document.getElementById('email-status-indicator');
        const statusText = document.getElementById('email-status-text');
        
        if (!indicator || !statusText) return;
        
        statusText.textContent = text;
        
        switch (status) {
            case 'configured':
                indicator.className = 'status-indicator configured';
                break;
            case 'tested':
                indicator.className = 'status-indicator tested';
                break;
            default:
                indicator.className = 'status-indicator';
        }
    }
    
    async loadCurrentConfig() {
        try {
            const response = await fetch('/api/notifications/email-config');
            const result = await response.json();
            
            if (result.success && result.config) {
                this.populateConfigForm(result.config);
                this.currentConfig = result.config;
                this.testStatus = result.config.testStatus;
                
                if (result.config.configured) {
                    // Update status based on test status
                    if (result.config.testStatus === 'success') {
                        this.updateConfigStatus('tested', this.getText('notifications.configured'));
                    } else {
                        this.updateConfigStatus('configured', this.getText('notifications.configuredNotTested'));
                    }
                }
            }
        } catch (error) {
            console.error('Load email config error:', error);
        }
    }
    
    populateConfigForm(config) {
        const emailInput = document.getElementById('email-address');
        const senderNameInput = document.getElementById('sender-name');
        const passwordInput = document.getElementById('app-password');
        const portSelect = document.getElementById('smtp-port');
        
        if (emailInput && config.email) {
            emailInput.value = config.email;
            
            // If we have actual provider configuration, use it; otherwise detect from email
            if (config.actualProvider) {
                // Show the actual saved configuration
                this.showConfigPreview(config.actualProvider);
                this.currentProvider = config.actualProvider;
            } else {
                // Fallback to email domain detection
                this.handleEmailChange(config.email);
            }
        }
        
        if (senderNameInput && config.senderName) {
            senderNameInput.value = config.senderName;
        }
        
        if (passwordInput) {
            if (config.configured && config.email) {
                // Show placeholder for existing password, don't show actual password for security
                passwordInput.placeholder = '●●●●●●●● (Password saved securely)';
                passwordInput.value = '';
            } else {
                passwordInput.placeholder = 'Enter your app password';
                passwordInput.value = '';
            }
        }
        
        // Set current SMTP port
        if (portSelect && config.actualProvider && config.actualProvider.port) {
            portSelect.value = config.actualProvider.port.toString();
        }
    }
}

// Initialize notification manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.notificationManager = new NotificationManager();
    });
} else {
    window.notificationManager = new NotificationManager();
}