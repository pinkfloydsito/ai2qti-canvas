import { writable, derived } from 'svelte/store';

// Import translations directly
import enTranslations from '../localization/en.json';
import esTranslations from '../localization/es.json';

// Available translations
const translations = {
  en: enTranslations,
  es: esTranslations
};

// Current language store
export const currentLanguage = writable('es');

// Derived store for translation function
export const t = derived(currentLanguage, ($currentLanguage) =>
  (key, replacements = {}) => {
    const keys = key.split('.');
    let text = translations[$currentLanguage];

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
);

// Function to change language
export function setLanguage(language) {
  if (translations[language]) {
    currentLanguage.set(language);
    console.log(`Language changed to: ${language}`);
  } else {
    console.warn(`Language ${language} not available`);
  }
}
