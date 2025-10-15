import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class I18n {
    constructor() {
        this.translations = {};
        this.defaultLanguage = 'en';
        this.supportedLanguages = ['en', 'de'];
        this.loadTranslations();
    }

    loadTranslations() {
        this.supportedLanguages.forEach(lang => {
            try {
                const filePath = path.join(__dirname, `${lang}.json`);
                const fileContent = fs.readFileSync(filePath, 'utf8');
                this.translations[lang] = JSON.parse(fileContent);
                console.log(`✅ Loaded ${lang} translations`);
            } catch (error) {
                console.error(`❌ Error loading ${lang} translations:`, error.message);
                this.translations[lang] = {};
            }
        });
    }

    t(key, language = 'en', params = {}) {
        if (!this.supportedLanguages.includes(language)) {
            language = this.defaultLanguage;
        }

        const translation = this.getNestedTranslation(key, language);

        if (!translation) {
            const defaultTranslation = this.getNestedTranslation(key, this.defaultLanguage);
            if (!defaultTranslation) {
                console.warn(`⚠️ Translation not found for key: ${key}`);
                return key;
            }
            return this.replaceParams(defaultTranslation, params);
        }

        return this.replaceParams(translation, params);
    }

    getNestedTranslation(key, language) {
        const keys = key.split('.');
        let translation = this.translations[language];

        for (const k of keys) {
            if (translation && typeof translation === 'object' && k in translation) {
                translation = translation[k];
            } else {
                return null;
            }
        }

        return translation;
    }

    replaceParams(text, params) {
        if (!params || typeof params !== 'object') {
            return text;
        }

        let result = text;
        for (const [key, value] of Object.entries(params)) {
            const placeholder = `{${key}}`;
            result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }

        return result;
    }

    getAvailableLanguages() {
        return this.supportedLanguages;
    }

    isValidLanguage(language) {
        return this.supportedLanguages.includes(language);
    }

    getDefaultLanguage() {
        return this.defaultLanguage;
    }

    getAllTranslations(language = 'en') {
        if (!this.supportedLanguages.includes(language)) {
            language = this.defaultLanguage;
        }
        return this.translations[language];
    }

    reloadTranslations() {
        console.log('🔄 Reloading translations...');
        this.translations = {};
        this.loadTranslations();
    }
}

const i18n = new I18n();

export const t = (key, language, params) => i18n.t(key, language, params);

export default i18n;