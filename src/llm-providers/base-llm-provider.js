/**
 * Base abstract class for LLM providers following the Strategy pattern
 * Implements the Interface Segregation Principle (ISP) and Single Responsibility Principle (SRP)
 */
class BaseLLMProvider {
    constructor(name, config = {}) {
        if (new.target === BaseLLMProvider) {
            throw new Error('Cannot instantiate abstract class BaseLLMProvider');
        }
        
        this.name = name;
        this.config = config;
        this.client = null;
        this.isConfigured = false;
    }

    /**
     * Configure the provider with API key and settings
     * @param {string} apiKey - The API key for the provider
     * @param {Object} options - Additional configuration options
     * @returns {Promise<void>}
     */
    async configure(apiKey, options = {}) {
        if (!apiKey) {
            throw new Error(`API key is required for ${this.name} provider`);
        }
        
        this.apiKey = apiKey;
        this.options = { ...this.config, ...options };
        
        await this.initializeClient();
        this.isConfigured = true;
    }

    /**
     * Initialize the provider-specific client
     * Must be implemented by subclasses
     * @abstract
     */
    async initializeClient() {
        throw new Error('initializeClient method must be implemented by subclass');
    }

    /**
     * Generate questions using the provider's LLM
     * @param {string} prompt - The prompt for question generation
     * @param {Object} options - Generation options
     * @returns {Promise<Array>} Array of generated questions
     */
    async generateQuestions(prompt, options = {}) {
        if (!this.isConfigured) {
            throw new Error(`${this.name} provider is not configured`);
        }
        
        return await this.performGeneration(prompt, options);
    }

    /**
     * Perform the actual generation - must be implemented by subclasses
     * @abstract
     * @param {string} prompt - The prompt for generation
     * @param {Object} options - Generation options
     * @returns {Promise<Array>} Generated questions
     */
    async performGeneration(prompt, options = {}) {
        throw new Error('performGeneration method must be implemented by subclass');
    }

    /**
     * Test if the API key is valid
     * @returns {Promise<boolean>} True if API key is valid
     */
    async testApiKey() {
        if (!this.isConfigured) {
            throw new Error(`${this.name} provider is not configured`);
        }
        
        try {
            return await this.performApiKeyTest();
        } catch (error) {
            console.error(`${this.name} API key test failed:`, error.message);
            return false;
        }
    }

    /**
     * Perform provider-specific API key test
     * @abstract
     * @returns {Promise<boolean>}
     */
    async performApiKeyTest() {
        throw new Error('performApiKeyTest method must be implemented by subclass');
    }

    /**
     * Get the list of available models for this provider
     * @returns {Array<string>} Array of model names
     */
    getAvailableModels() {
        return this.config.models || [];
    }

    /**
     * Get provider information
     * @returns {Object} Provider information
     */
    getProviderInfo() {
        return {
            name: this.name,
            isConfigured: this.isConfigured,
            models: this.getAvailableModels(),
            supportsStreaming: this.config.supportsStreaming || false,
            maxTokens: this.config.maxTokens || 4096,
            rateLimits: this.config.rateLimits || {}
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.client = null;
        this.isConfigured = false;
    }
}

module.exports = BaseLLMProvider;