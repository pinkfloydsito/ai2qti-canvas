/**
 * LLM Providers Module
 * 
 * Exports all LLM providers and related utilities following SOLID principles:
 * - Single Responsibility: Each provider handles one API
 * - Open/Closed: Easy to extend with new providers
 * - Liskov Substitution: All providers implement BaseLLMProvider
 * - Interface Segregation: Clean provider interface
 * - Dependency Inversion: Service depends on abstractions, not concrete implementations
 */

// Base classes and interfaces
const BaseLLMProvider = require('./base-llm-provider');
const ProviderFactory = require('./provider-factory');

// Provider implementations
const GeminiProvider = require('./gemini-provider');
const MistralProvider = require('./mistral-provider');
const DeepSeekProvider = require('./deepseek-provider');
const HuggingFaceProvider = require('./huggingface-provider');

// Enhanced LLM Service
const LLMService = require('../llm-service-v2');

/**
 * Supported provider types with their characteristics
 */
const PROVIDER_TYPES = {
    FREE_TIER: [
        'huggingface',   // Free inference API
        'mistral',       // Free tier available
        'deepseek'       // Free tier available
    ],
    PAID_TIER: [
        'gemini'         // Generous free tier, then paid
    ],
    ALL: [
        'gemini',
        'mistral', 
        'deepseek',
        'huggingface'
    ]
};

/**
 * Provider capabilities matrix
 */
const PROVIDER_CAPABILITIES = {
    'gemini': {
        streaming: true,
        multimodal: true,
        codeGeneration: true,
        mathSupport: true,
        maxTokens: 8192
    },
    'mistral': {
        streaming: true,
        multimodal: false,
        codeGeneration: true,
        mathSupport: true,
        maxTokens: 32768
    },
    'deepseek': {
        streaming: true,
        multimodal: false,
        codeGeneration: true,
        mathSupport: true,
        maxTokens: 4096
    },
    'huggingface': {
        streaming: false,
        multimodal: false,
        codeGeneration: false,
        mathSupport: false,
        maxTokens: 1024
    }
};

/**
 * Get recommended providers based on requirements
 * @param {Object} requirements - Requirements object
 * @returns {Array<string>} Recommended provider names
 */
function getRecommendedProviders(requirements = {}) {
    const {
        budget = 'free',
        needsStreaming = false,
        needsMath = false,
        needsCode = false,
        maxTokens = 1000
    } = requirements;

    const candidateProviders = budget === 'free' ? PROVIDER_TYPES.FREE_TIER : PROVIDER_TYPES.ALL;
    
    return candidateProviders.filter(provider => {
        const capabilities = PROVIDER_CAPABILITIES[provider];
        
        if (needsStreaming && !capabilities.streaming) return false;
        if (needsMath && !capabilities.mathSupport) return false;
        if (needsCode && !capabilities.codeGeneration) return false;
        if (maxTokens > capabilities.maxTokens) return false;
        
        return true;
    });
}

/**
 * Create a configured LLM service with multiple providers
 * @param {Object} config - Configuration object
 * @returns {LLMService} Configured LLM service
 */
async function createLLMService(config = {}) {
    const {
        primaryProvider = 'gemini',
        fallbackProviders = ['mistral', 'deepseek'],
        apiKeys = {},
        autoFallback = true
    } = config;

    const service = new LLMService();
    service.updateConfig({ autoFallback });

    // Configure primary provider if API key is available
    if (apiKeys[primaryProvider]) {
        try {
            await service.setProvider(primaryProvider, apiKeys[primaryProvider]);
        } catch (error) {
            console.warn(`Failed to configure primary provider ${primaryProvider}:`, error.message);
        }
    }

    // Configure fallback providers
    const fallbackConfigs = fallbackProviders
        .filter(provider => apiKeys[provider])
        .map(provider => ({ provider, apiKey: apiKeys[provider] }));

    if (fallbackConfigs.length > 0) {
        await service.configureFallbackProviders(fallbackConfigs);
    }

    return service;
}

/**
 * Validate multiple provider configurations
 * @param {Object} configurations - Provider configurations
 * @returns {Object} Validation results
 */
function validateConfigurations(configurations) {
    const results = {};
    
    for (const [provider, config] of Object.entries(configurations)) {
        try {
            results[provider] = ProviderFactory.validateProviderConfig(provider, config);
        } catch (error) {
            results[provider] = {
                isValid: false,
                errors: [error.message],
                warnings: []
            };
        }
    }
    
    return results;
}

module.exports = {
    // Core classes
    BaseLLMProvider,
    ProviderFactory,
    LLMService,
    
    // Provider implementations
    GeminiProvider,
    MistralProvider,
    DeepSeekProvider,
    HuggingFaceProvider,
    
    // Constants and utilities
    PROVIDER_TYPES,
    PROVIDER_CAPABILITIES,
    
    // Helper functions
    getRecommendedProviders,
    createLLMService,
    validateConfigurations
};