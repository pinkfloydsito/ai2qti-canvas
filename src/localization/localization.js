class LocalizationManager {
    constructor() {
        this.currentLanguage = 'es'; // Default to Spanish as requested
        this.translations = {};
        this.loadTranslations();
    }

    async loadTranslations() {
        try {
            // Load Spanish translations
            const esTranslations = require('./es.json');
            this.translations['es'] = esTranslations;

            // Load English translations
            const enTranslations = require('./en.json');
            this.translations['en'] = enTranslations;

            console.log('Translations loaded successfully');
        } catch (error) {
            console.error('Error loading translations:', error);
        }
    }

    setLanguage(language) {
        if (this.translations[language]) {
            this.currentLanguage = language;
            this.updateUI();
            console.log(`Language changed to: ${language}`);
        } else {
            console.warn(`Language ${language} not available`);
        }
    }

    getText(key, replacements = {}) {
        const keys = key.split('.');
        let text = this.translations[this.currentLanguage];
        
        for (const k of keys) {
            if (text && text[k]) {
                text = text[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key; // Return the key if translation not found
            }
        }

        // Replace placeholders like {count}, {error}, etc.
        if (typeof text === 'string' && Object.keys(replacements).length > 0) {
            Object.keys(replacements).forEach(placeholder => {
                text = text.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
            });
        }

        return text;
    }

    // Update UI with current language
    updateUI() {
        // Update static text elements
        this.updateStaticElements();
        
        // Update dynamic content
        this.updatePlaceholders();
        
        // Update buttons and labels
        this.updateButtons();
    }

    updateStaticElements() {
        const elements = [
            { selector: 'header h1', key: 'app.title' },
            { selector: '#newAssessment', key: 'app.toolbar.newAssessment' },
            { selector: '#saveAssessment', key: 'app.toolbar.save' },
            { selector: '#exportQTI', key: 'app.toolbar.exportQTI' },
            { selector: '.ai-generation-section h2', key: 'aiGeneration.title' },
            { selector: '.assessment-details h2', key: 'assessment.title' },
            { selector: '.settings-section h2', key: 'settings.title' },
            { selector: '#generateQuestions', key: 'aiGeneration.generateBtn' }
        ];

        elements.forEach(({ selector, key }) => {
            const element = document.querySelector(selector);
            if (element) {
                element.textContent = this.getText(key);
            }
        });
    }

    updatePlaceholders() {
        const placeholders = [
            { selector: '#contextText', key: 'aiGeneration.contextPlaceholder' },
            { selector: '#assessmentTitle', key: 'assessment.titlePlaceholder' },
            { selector: '#assessmentDescription', key: 'assessment.descriptionPlaceholder' },
            { selector: '#timeLimit', key: 'assessment.timeLimitPlaceholder' },
            { selector: '#apiKey', key: 'settings.apiKeyPlaceholder' }
        ];

        placeholders.forEach(({ selector, key }) => {
            const element = document.querySelector(selector);
            if (element) {
                element.placeholder = this.getText(key);
            }
        });
    }

    updateButtons() {
        // Update upload button
        const uploadBtn = document.querySelector('#uploadBtn');
        if (uploadBtn && !uploadBtn.disabled) {
            uploadBtn.textContent = this.getText('aiGeneration.chooseFile');
        }

        // Update difficulty options
        const difficultySelect = document.querySelector('#difficultyLevel');
        if (difficultySelect) {
            const options = difficultySelect.querySelectorAll('option');
            options.forEach(option => {
                const value = option.value;
                if (this.getText(`aiGeneration.difficultyLevels.${value}`)) {
                    option.textContent = this.getText(`aiGeneration.difficultyLevels.${value}`);
                }
            });
        }

        // Update question type checkboxes
        const checkboxes = document.querySelectorAll('.checkbox-group label');
        checkboxes.forEach(label => {
            const input = label.querySelector('input[type="checkbox"]');
            if (input) {
                const value = input.value;
                let typeKey = '';
                switch (value) {
                    case 'multiple_choice':
                        typeKey = 'multipleChoice';
                        break;
                    case 'true_false':
                        typeKey = 'trueFalse';
                        break;
                    case 'short_answer':
                        typeKey = 'shortAnswer';
                        break;
                    case 'essay':
                        typeKey = 'essay';
                        break;
                }
                if (typeKey) {
                    const textNode = Array.from(label.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                    if (textNode) {
                        textNode.textContent = ' ' + this.getText(`aiGeneration.typeLabels.${typeKey}`);
                    }
                }
            }
        });

        // Update math checkbox
        const mathCheckbox = document.querySelector('label[for="includeMath"]');
        if (mathCheckbox) {
            const textNode = Array.from(mathCheckbox.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (textNode) {
                textNode.textContent = '\n            ' + this.getText('aiGeneration.includeMath');
            }
        }
    }

    // Update labels with specific selectors
    updateLabels() {
        const labels = [
            { selector: 'label[for="pdfUpload"]', key: 'aiGeneration.uploadPdf' },
            { selector: 'label[for="contextText"]', key: 'aiGeneration.contextText' },
            { selector: 'label[for="questionCount"]', key: 'aiGeneration.questionCount' },
            { selector: 'label[for="difficultyLevel"]', key: 'aiGeneration.difficulty' },
            { selector: 'label[for="questionTypes"]', key: 'aiGeneration.questionTypes' },
            { selector: 'label[for="assessmentTitle"]', key: 'assessment.titleField' },
            { selector: 'label[for="assessmentDescription"]', key: 'assessment.description' },
            { selector: 'label[for="timeLimit"]', key: 'assessment.timeLimit' },
            { selector: 'label[for="llmProvider"]', key: 'settings.provider' },
            { selector: 'label[for="apiKey"]', key: 'settings.apiKey' }
        ];

        labels.forEach(({ selector, key }) => {
            const element = document.querySelector(selector);
            if (element) {
                element.textContent = this.getText(key);
            }
        });
    }

    // Show localized messages
    showMessage(type, key, replacements = {}) {
        const message = this.getText(`messages.${type}.${key}`, replacements);
        
        if (type === 'success') {
            alert(message);
        } else if (type === 'errors') {
            alert(message);
        }
        
        return message;
    }

    // Initialize localization when DOM is ready
    init() {
        this.updateUI();
        this.updateLabels();
        
        // Add language switcher
        this.addLanguageSwitcher();
    }

    addLanguageSwitcher() {
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            const languageSwitcher = document.createElement('select');
            languageSwitcher.id = 'languageSwitcher';
            languageSwitcher.innerHTML = `
                <option value="es" ${this.currentLanguage === 'es' ? 'selected' : ''}>Español</option>
                <option value="en" ${this.currentLanguage === 'en' ? 'selected' : ''}>English</option>
            `;
            
            languageSwitcher.addEventListener('change', (e) => {
                this.setLanguage(e.target.value);
            });
            
            toolbar.appendChild(languageSwitcher);
        }
    }
}

module.exports = LocalizationManager;