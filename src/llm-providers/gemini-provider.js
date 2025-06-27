import { GoogleGenerativeAI } from '@google/generative-ai';
import BaseLLMProvider from './base-llm-provider.js';
import JSONExtractor from './json-extractor.js';

/**
 * Google Gemini LLM Provider implementation
 * Follows Single Responsibility Principle (SRP) - only handles Gemini interactions
 */
class GeminiProvider extends BaseLLMProvider {
    constructor() {
        super('gemini', {
            models: [
                'gemini-2.5-flash',
                'gemini-2.5-flash-lite-preview-06-17',
                'gemini-2.0-flash',
                'gemini-2.5-pro-preview-tts',
                'gemini-2.0-flash'
            ],
            supportsStreaming: true,
            maxTokens: 8192,
            rateLimits: {
                requestsPerMinute: 60,
                tokensPerMinute: 32000
            }
        });
    }

    async initializeClient() {
        try {
            this.client = new GoogleGenerativeAI(this.apiKey);
            console.log('Gemini client initialized successfully');
        } catch (error) {
            throw new Error(`Failed to initialize Gemini client: ${error.message}`);
        }
    }

    async performGeneration(prompt, options = {}) {
        const { model = this.config.models[0], maxRetries = 3 } = options;
        
        let lastError = null;
        const modelsToTry = this.config.models;
        
        // Try each model in sequence until one works (Open/Closed Principle)
        for (let i = 0; i < modelsToTry.length; i++) {
            const currentModel = modelsToTry[i];
            
            try {
                console.log(`Attempting generation with Gemini model: ${currentModel} (${i + 1}/${modelsToTry.length})`);
                
                const generativeModel = this.client.getGenerativeModel({ model: currentModel });
                const result = await generativeModel.generateContent(prompt);
                const response = result.response;
                const text = response.text();

                console.log(`✅ ${currentModel} - Response received: ${text.length} characters`);

                // Extract and parse JSON from response using unified extractor
                const cleanText = JSONExtractor.extractJSONFromResponse(text, 'Gemini');
                const parsedQuestions = JSONExtractor.validateQuestionsStructure(cleanText);

                console.log(`✅ ${currentModel} - Successfully parsed ${parsedQuestions.questions.length} questions`);
                return parsedQuestions.questions;
                
            } catch (error) {
                lastError = error;
                console.warn(`❌ ${currentModel} failed: ${error.message}`);
                
                if (i === modelsToTry.length - 1) {
                    console.error('🚨 All Gemini models failed. Throwing last error.');
                    break;
                }
                
                console.log(`⏭️  Trying next model...`);
                continue;
            }
        }
        
        // If we get here, all models failed
        console.error('💥 All Gemini models exhausted');
        if (lastError instanceof SyntaxError) {
            throw new Error(`Failed to parse LLM response as JSON (tried ${modelsToTry.length} models): ${lastError.message}`);
        }
        throw new Error(`All Gemini models failed (tried ${modelsToTry.length} models). Last error: ${lastError.message}`);
    }

    async performApiKeyTest() {
        const modelsToTest = this.config.models;
        
        for (let i = 0; i < modelsToTest.length; i++) {
            const modelName = modelsToTest[i];
            
            try {
                console.log(`Testing Gemini API key with model: ${modelName} (${i + 1}/${modelsToTest.length})`);
                
                const model = this.client.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Say "API key is working" in exactly those words.');
                const response = await result.response;
                const text = response.text().trim();
                
                const isWorking = text.includes('API key is working');
                
                if (isWorking) {
                    console.log(`✅ Gemini API key validated successfully with ${modelName}`);
                    return true;
                } else {
                    console.warn(`⚠️  ${modelName} responded but with unexpected text: "${text}"`);
                }
                
            } catch (modelError) {
                console.warn(`❌ ${modelName} test failed: ${modelError.message}`);
                
                if (i === modelsToTest.length - 1) {
                    throw modelError;
                }
                
                continue;
            }
        }
        
        return false;
    }

}

export default GeminiProvider;