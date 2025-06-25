/**
 * Example: Using the Multi-Provider LLM System
 * 
 * This example demonstrates how to use the new SOLID architecture
 * with multiple free LLM providers for question generation.
 */

const LLMService = require('../src/llm-service-v2');
const ProviderFactory = require('../src/llm-providers/provider-factory');

async function demonstrateMultiProviderUsage() {
    console.log('🚀 Multi-Provider LLM System Demo\n');

    // Initialize the LLM service
    const llmService = new LLMService();

    // 1. Show available providers
    console.log('📋 Available providers:');
    const providers = llmService.getAvailableProviders();
    providers.forEach(provider => {
        console.log(`  - ${provider.name}: ${provider.models.length} models, ${provider.supportsStreaming ? 'streaming' : 'no streaming'}`);
    });
    console.log();

    // 2. Example API keys (these would come from environment variables or user input)
    const apiKeys = {
        gemini: process.env.GEMINI_API_KEY || 'demo-gemini-key',
        mistral: process.env.MISTRAL_API_KEY || 'demo-mistral-key',
        deepseek: process.env.DEEPSEEK_API_KEY || 'demo-deepseek-key',
        huggingface: process.env.HF_API_KEY || 'demo-hf-key'
    };

    try {
        // 3. Configure primary provider (Gemini)
        console.log('🔧 Configuring primary provider (Gemini)...');
        await llmService.setProvider('gemini', apiKeys.gemini);
        
        // 4. Configure fallback providers
        console.log('🔧 Configuring fallback providers...');
        await llmService.configureFallbackProviders([
            { provider: 'mistral', apiKey: apiKeys.mistral },
            { provider: 'deepseek', apiKey: apiKeys.deepseek },
            { provider: 'huggingface', apiKey: apiKeys.huggingface }
        ]);

        // 5. Show current configuration
        const currentInfo = llmService.getCurrentProviderInfo();
        console.log('📊 Current configuration:', {
            primary: currentInfo.name,
            fallbacks: currentInfo.fallbackCount,
            models: currentInfo.models.slice(0, 3) // Show first 3 models
        });
        console.log();

        // 6. Generate questions with automatic fallback
        console.log('🎯 Generating questions with automatic fallback...');
        const sampleContent = `
        Artificial Intelligence (AI) is a rapidly growing field in computer science that aims to create 
        intelligent machines capable of performing tasks that typically require human intelligence. 
        These tasks include learning, reasoning, problem-solving, perception, and language understanding.
        
        Machine Learning is a subset of AI that focuses on the development of algorithms that can learn 
        and make decisions from data without being explicitly programmed for every scenario.
        `;

        const questions = await llmService.generateQuestions(sampleContent, {
            questionCount: 3,
            difficulty: 'medium',
            questionTypes: ['multiple_choice', 'true_false'],
            includeMath: false
        });

        console.log('✅ Generated questions:');
        questions.forEach((question, index) => {
            console.log(`\n${index + 1}. ${question.text}`);
            if (question.choices) {
                question.choices.forEach(choice => {
                    console.log(`   ${String.fromCharCode(65 + choice.id)}) ${choice.text}`);
                });
                console.log(`   Correct: ${String.fromCharCode(65 + question.correctAnswer)}`);
            } else {
                console.log(`   Answer: ${question.correctAnswer}`);
            }
        });

    } catch (error) {
        console.error('❌ Error during demo:', error.message);
    }

    console.log('\n🏁 Demo completed!');
}

async function demonstrateProviderSwitching() {
    console.log('\n🔄 Provider Switching Demo\n');

    const llmService = new LLMService();

    // Test different providers individually
    const providersToTest = ['gemini', 'mistral', 'deepseek', 'huggingface'];

    for (const providerName of providersToTest) {
        try {
            console.log(`🧪 Testing ${providerName} provider...`);
            
            // Create provider directly for testing
            const provider = ProviderFactory.createProvider(providerName);
            const info = provider.getProviderInfo();
            
            console.log(`  ✓ Models: ${info.models.slice(0, 2).join(', ')}${info.models.length > 2 ? '...' : ''}`);
            console.log(`  ✓ Max tokens: ${info.maxTokens}`);
            console.log(`  ✓ Rate limits: ${JSON.stringify(info.rateLimits)}`);

            // Test API key validation (will fail with demo keys, but shows the flow)
            const isValid = await llmService.testApiKey(providerName, 'demo-key');
            console.log(`  ${isValid ? '✅' : '❌'} API key test: ${isValid ? 'valid' : 'invalid (expected with demo key)'}`);

        } catch (error) {
            console.log(`  ❌ Error testing ${providerName}: ${error.message.substring(0, 50)}...`);
        }
        console.log();
    }
}

async function demonstrateConfigurationValidation() {
    console.log('\n🔍 Configuration Validation Demo\n');

    const configs = [
        {
            provider: 'gemini',
            config: { apiKey: 'valid-key', model: 'gemini-2.5-flash', maxTokens: 1000 },
            description: 'Valid Gemini configuration'
        },
        {
            provider: 'mistral',
            config: { model: 'mistral-7b-instruct' }, // Missing API key
            description: 'Invalid Mistral configuration (missing API key)'
        },
        {
            provider: 'deepseek',
            config: { apiKey: 'valid-key', maxTokens: 10000 }, // Exceeds limit
            description: 'DeepSeek configuration with high token limit'
        }
    ];

    configs.forEach(({ provider, config, description }) => {
        console.log(`🧪 ${description}:`);
        const validation = ProviderFactory.validateProviderConfig(provider, config);
        
        console.log(`  Valid: ${validation.isValid}`);
        if (validation.errors.length > 0) {
            console.log(`  Errors: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
            console.log(`  Warnings: ${validation.warnings.join(', ')}`);
        }
        console.log();
    });
}

// Run the demonstrations
async function runDemos() {
    try {
        await demonstrateMultiProviderUsage();
        await demonstrateProviderSwitching();
        await demonstrateConfigurationValidation();
    } catch (error) {
        console.error('Demo failed:', error);
    }
}

// Export for use as a module or run directly
if (require.main === module) {
    runDemos();
}

module.exports = {
    demonstrateMultiProviderUsage,
    demonstrateProviderSwitching,
    demonstrateConfigurationValidation
};