// API Key caching service following SOLID principles
class ApiKeyCache {
    constructor(configManager) {
        this.configManager = configManager;
        this.cache = new Map();
        this.validators = new Map();
        this.timers = new Map();
        
        this.init();
    }

    init() {
        // Clean up expired keys on startup
        this.cleanupExpired();
        
        // Set up periodic cleanup
        const cleanupInterval = this.configManager.get('apiKeyCache.ttlMinutes') * 60 * 1000 / 4;
        this.cleanupTimer = setInterval(() => this.cleanupExpired(), cleanupInterval);
    }

    async setApiKey(provider, apiKey, validator = null) {
        if (!this.configManager.get('apiKeyCache.enabled')) {
            return false;
        }

        const cacheKey = this.getCacheKey(provider);
        const ttlMs = this.configManager.get('apiKeyCache.ttlMinutes') * 60 * 1000;
        const expiresAt = Date.now() + ttlMs;

        // Validate API key if validator provided
        if (validator && typeof validator === 'function') {
            try {
                const isValid = await validator(provider, apiKey);
                if (!isValid) {
                    console.warn(`Invalid API key for provider: ${provider}`);
                    return false;
                }
            } catch (error) {
                console.error(`API key validation failed for ${provider}:`, error.message);
                return false;
            }
        }

        // Store in cache
        const cacheEntry = {
            apiKey: this.encryptApiKey(apiKey),
            provider,
            expiresAt,
            validated: !!validator,
            createdAt: Date.now()
        };

        this.cache.set(cacheKey, cacheEntry);
        
        // Store validator for future use
        if (validator) {
            this.validators.set(provider, validator);
        }

        // Set up expiration timer
        this.setExpirationTimer(cacheKey, ttlMs);

        // Enforce cache size limit
        this.enforceCacheLimit();

        console.info(`API key cached for ${provider}, expires in ${this.configManager.get('apiKeyCache.ttlMinutes')} minutes`);
        return true;
    }

    getApiKey(provider) {
        if (!this.configManager.get('apiKeyCache.enabled')) {
            return null;
        }

        const cacheKey = this.getCacheKey(provider);
        const entry = this.cache.get(cacheKey);

        if (!entry) {
            return null;
        }

        if (this.isExpired(entry)) {
            this.removeFromCache(cacheKey);
            return null;
        }

        return this.decryptApiKey(entry.apiKey);
    }

    async validateCachedKey(provider) {
        const apiKey = this.getApiKey(provider);
        if (!apiKey) {
            return false;
        }

        const validator = this.validators.get(provider);
        if (!validator) {
            return true; // Assume valid if no validator
        }

        try {
            const isValid = await validator(provider, apiKey);
            if (!isValid) {
                this.removeApiKey(provider);
            }
            return isValid;
        } catch (error) {
            console.error(`Validation failed for cached ${provider} key:`, error.message);
            return false;
        }
    }

    removeApiKey(provider) {
        const cacheKey = this.getCacheKey(provider);
        this.removeFromCache(cacheKey);
        console.info(`Removed API key for ${provider} from cache`);
    }

    clear() {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        this.cache.clear();
        this.validators.clear();
        console.info('API key cache cleared');
    }

    getStats() {
        const entries = Array.from(this.cache.values());
        const now = Date.now();
        
        return {
            totalKeys: entries.length,
            validKeys: entries.filter(entry => !this.isExpired(entry)).length,
            expiredKeys: entries.filter(entry => this.isExpired(entry)).length,
            providers: [...new Set(entries.map(entry => entry.provider))],
            oldestEntry: entries.length > 0 ? Math.min(...entries.map(entry => entry.createdAt)) : null,
            newestEntry: entries.length > 0 ? Math.max(...entries.map(entry => entry.createdAt)) : null
        };
    }

    // Private methods

    getCacheKey(provider) {
        return `apikey_${provider}`;
    }

    isExpired(entry) {
        return Date.now() > entry.expiresAt;
    }

    removeFromCache(cacheKey) {
        this.cache.delete(cacheKey);
        
        const timer = this.timers.get(cacheKey);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(cacheKey);
        }
    }

    setExpirationTimer(cacheKey, ttlMs) {
        const existingTimer = this.timers.get(cacheKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            this.removeFromCache(cacheKey);
            console.info(`API key expired and removed from cache: ${cacheKey}`);
        }, ttlMs);

        this.timers.set(cacheKey, timer);
    }

    cleanupExpired() {
        const expiredKeys = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry)) {
                expiredKeys.push(key);
            }
        }

        expiredKeys.forEach(key => this.removeFromCache(key));
        
        if (expiredKeys.length > 0) {
            console.info(`Cleaned up ${expiredKeys.length} expired API keys`);
        }
    }

    enforceCacheLimit() {
        const maxKeys = this.configManager.get('apiKeyCache.maxKeys');
        const entries = Array.from(this.cache.entries());
        
        if (entries.length <= maxKeys) {
            return;
        }

        // Remove oldest entries
        entries
            .sort((a, b) => a[1].createdAt - b[1].createdAt)
            .slice(0, entries.length - maxKeys)
            .forEach(([key]) => this.removeFromCache(key));
    }

    // Simple encryption/decryption (not cryptographically secure, just obfuscation)
    encryptApiKey(apiKey) {
        return Buffer.from(apiKey).toString('base64');
    }

    decryptApiKey(encryptedKey) {
        return Buffer.from(encryptedKey, 'base64').toString('utf8');
    }

    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.clear();
    }
}

module.exports = ApiKeyCache;