// Configuration management following SOLID principles
class ConfigManager {
  constructor() {
    this.config = {
      apiKeyCache: {
        enabled: true,
        ttlMinutes: 100,
        maxKeys: 5
      },
      llm: {
        defaultProvider: 'gemini',
        timeout: 30000,
        maxRetries: 3
      },
      ui: {
        autoSave: true,
        autoSaveInterval: 30000,
        mathPreviewDelay: 500
      },
      export: {
        defaultFormat: 'qti',
        includeExplanations: true,
        validateXML: true
      }
    };

    this.loadUserConfig();
  }

  get(path) {
    return this.getNestedValue(this.config, path);
  }

  set(path, value) {
    this.setNestedValue(this.config, path, value);
    this.saveUserConfig();
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  loadUserConfig() {
    try {
      const userConfigPath = this.getUserConfigPath();
      if (require('fs').existsSync(userConfigPath)) {
        const userConfig = JSON.parse(require('fs').readFileSync(userConfigPath, 'utf8'));
        this.mergeConfig(this.config, userConfig);
      }
    } catch (error) {
      console.warn('Failed to load user config:', error.message);
    }
  }

  saveUserConfig() {
    try {
      const userConfigPath = this.getUserConfigPath();
      const configDir = require('path').dirname(userConfigPath);

      if (!require('fs').existsSync(configDir)) {
        require('fs').mkdirSync(configDir, { recursive: true });
      }

      require('fs').writeFileSync(userConfigPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.warn('Failed to save user config:', error.message);
    }
  }

  getUserConfigPath() {
    const os = require('os');
    const path = require('path');
    return path.join(os.homedir(), '.qti-generator', 'config.json');
  }

  mergeConfig(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.mergeConfig(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  reset() {
    this.config = {
      apiKeyCache: {
        enabled: true,
        ttlMinutes: 10,
        maxKeys: 5
      },
      llm: {
        defaultProvider: 'gemini',
        timeout: 30000,
        maxRetries: 3
      },
      ui: {
        autoSave: true,
        autoSaveInterval: 30000,
        mathPreviewDelay: 500
      },
      export: {
        defaultFormat: 'qti',
        includeExplanations: true,
        validateXML: true
      }
    };
    this.saveUserConfig();
  }

  validate() {
    const errors = [];

    // Validate API key cache settings
    const cacheConfig = this.get('apiKeyCache');
    if (cacheConfig.ttlMinutes < 1 || cacheConfig.ttlMinutes > 60) {
      errors.push('apiKeyCache.ttlMinutes must be between 1 and 60');
    }

    // Validate LLM settings
    const llmConfig = this.get('llm');
    if (!['gemini', 'openai'].includes(llmConfig.defaultProvider)) {
      errors.push('llm.defaultProvider must be "gemini" or "openai"');
    }

    if (llmConfig.timeout < 5000 || llmConfig.timeout > 120000) {
      errors.push('llm.timeout must be between 5000 and 120000 ms');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default ConfigManager;
