const GeminiProvider = require('./gemini-provider');
const MistralProvider = require('./mistral-provider');
const DeepSeekProvider = require('./deepseek-provider');
const HuggingFaceProvider = require('./huggingface-provider');

/**
 * Factory class for creating LLM providers
 * Implements the Factory Method pattern and follows Open/Closed Principle
 */
class ProviderFactory {
    constructor() {
        // Registry of available providers (extensible)
        this.providers = new Map([
            ['gemini', GeminiProvider],
            ['mistral', MistralProvider],
            ['deepseek', DeepSeekProvider],
            ['huggingface', HuggingFaceProvider]
        ]);
    }

    /**
     * Create a provider instance
     * @param {string} providerName - Name of the provider to create
     * @returns {BaseLLMProvider} Provider instance
     * @throws {Error} If provider is not supported
     */
    createProvider(providerName) {
        const normalizedName = providerName.toLowerCase();
        
        if (!this.providers.has(normalizedName)) {
            throw new Error(`Unsupported provider: ${providerName}. Available providers: ${this.getAvailableProviders().join(', ')}`);
        }
        
        const ProviderClass = this.providers.get(normalizedName);
        return new ProviderClass();
    }

    /**
     * Register a new provider (follows Open/Closed Principle)
     * @param {string} name - Provider name
     * @param {class} ProviderClass - Provider class constructor
     */
    registerProvider(name, ProviderClass) {
        const normalizedName = name.toLowerCase();
        this.providers.set(normalizedName, ProviderClass);
        console.log(`Provider '${name}' registered successfully`);
    }

    /**
     * Check if a provider is supported
     * @param {string} providerName - Name of the provider
     * @returns {boolean} True if provider is supported
     */
    isProviderSupported(providerName) {
        return this.providers.has(providerName.toLowerCase());
    }

    /**
     * Get list of available provider names
     * @returns {Array<string>} Array of provider names
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }

    /**
     * Get provider information for all available providers
     * @returns {Array<Object>} Array of provider info objects
     */
    getAllProviderInfo() {
        const providerInfos = [];
        
        for (const [name, ProviderClass] of this.providers) {
            try {
                const tempProvider = new ProviderClass();
                providerInfos.push({
                    name: name,
                    displayName: tempProvider.name,
                    models: tempProvider.getAvailableModels(),
                    supportsStreaming: tempProvider.config.supportsStreaming,
                    maxTokens: tempProvider.config.maxTokens,
                    rateLimits: tempProvider.config.rateLimits
                });
            } catch (error) {
                console.warn(`Failed to get info for provider ${name}:`, error.message);
            }
        }
        
        return providerInfos;
    }

    /**
     * Create multiple providers at once
     * @param {Array<string>} providerNames - Array of provider names
     * @returns {Map<string, BaseLLMProvider>} Map of provider name to instance
     */
    createMultipleProviders(providerNames) {
        const providers = new Map();
        
        for (const name of providerNames) {
            try {
                const provider = this.createProvider(name);
                providers.set(name, provider);
            } catch (error) {
                console.warn(`Failed to create provider ${name}:`, error.message);
            }
        }
        
        return providers;
    }

    /**
     * Validate provider configuration
     * @param {string} providerName - Name of the provider
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result
     */
    validateProviderConfig(providerName, config) {
        try {
            const provider = this.createProvider(providerName);
            
            // Basic validation
            const validation = {
                isValid: true,
                errors: [],
                warnings: []
            };
            
            // Check for required API key
            if (!config.apiKey) {
                validation.isValid = false;
                validation.errors.push('API key is required');
            }
            
            // Check model selection
            if (config.model && !provider.getAvailableModels().includes(config.model)) {
                validation.warnings.push(`Model '${config.model}' not in available models list`);
            }
            
            // Check token limits
            if (config.maxTokens && config.maxTokens > provider.config.maxTokens) {
                validation.warnings.push(`Requested maxTokens (${config.maxTokens}) exceeds provider limit (${provider.config.maxTokens})`);
            }
            
            return validation;
        } catch (error) {
            return {
                isValid: false,
                errors: [error.message],
                warnings: []
            };
        }
    }
}

// Export singleton instance
module.exports = new ProviderFactory();