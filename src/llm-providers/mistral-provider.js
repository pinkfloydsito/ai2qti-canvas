const BaseLLMProvider = require('./base-llm-provider');

/**
 * Mistral AI LLM Provider implementation
 * Uses Mistral's API for free tier models
 */
class MistralProvider extends BaseLLMProvider {
    constructor() {
        super('mistral', {
            models: [
                'mistral-7b-instruct',
                'mixtral-8x7b-instruct',
                'mistral-small-latest',
                'mistral-medium-latest'
            ],
            supportsStreaming: true,
            maxTokens: 32768,
            rateLimits: {
                requestsPerMinute: 5, // Free tier limit
                tokensPerMinute: 20000
            },
            baseUrl: 'https://api.mistral.ai/v1'
        });
    }

    async initializeClient() {
        try {
            // Mistral uses OpenAI-compatible API format
            this.client = {
                apiKey: this.apiKey,
                baseUrl: this.config.baseUrl,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };
            console.log('Mistral client initialized successfully');
        } catch (error) {
            throw new Error(`Failed to initialize Mistral client: ${error.message}`);
        }
    }

    async performGeneration(prompt, options = {}) {
        const modelsToTry = this.config.models;
        let lastError = null;

        for (let i = 0; i < modelsToTry.length; i++) {
            const currentModel = modelsToTry[i];
            
            try {
                console.log(`Attempting generation with Mistral model: ${currentModel} (${i + 1}/${modelsToTry.length})`);
                
                const requestBody = {
                    model: currentModel,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: options.maxTokens || 4096,
                    temperature: options.temperature || 0.7,
                    top_p: options.topP || 0.9
                };

                const response = await this.makeRequest('/chat/completions', requestBody);
                
                if (!response.choices || response.choices.length === 0) {
                    throw new Error('No response choices returned from Mistral API');
                }

                const text = response.choices[0].message.content;
                console.log(`✅ ${currentModel} - Response received: ${text.length} characters`);

                // Extract and parse JSON from response
                const cleanText = this.extractJSONFromResponse(text);
                const parsedQuestions = JSON.parse(cleanText);

                if (!parsedQuestions.questions || !Array.isArray(parsedQuestions.questions)) {
                    throw new Error('Invalid response format from Mistral API');
                }

                console.log(`✅ ${currentModel} - Successfully parsed ${parsedQuestions.questions.length} questions`);
                return parsedQuestions.questions;
                
            } catch (error) {
                lastError = error;
                console.warn(`❌ ${currentModel} failed: ${error.message}`);
                
                if (i === modelsToTry.length - 1) {
                    console.error('🚨 All Mistral models failed. Throwing last error.');
                    break;
                }
                
                console.log(`⏭️  Trying next model...`);
                continue;
            }
        }

        // If we get here, all models failed
        console.error('💥 All Mistral models exhausted');
        if (lastError instanceof SyntaxError) {
            throw new Error(`Failed to parse LLM response as JSON (tried ${modelsToTry.length} models): ${lastError.message}`);
        }
        throw new Error(`All Mistral models failed (tried ${modelsToTry.length} models). Last error: ${lastError.message}`);
    }

    async performApiKeyTest() {
        try {
            console.log('Testing Mistral API key...');
            
            const requestBody = {
                model: this.config.models[0], // Use first available model
                messages: [
                    {
                        role: 'user',
                        content: 'Say "API key is working" in exactly those words.'
                    }
                ],
                max_tokens: 20
            };

            const response = await this.makeRequest('/chat/completions', requestBody);
            
            if (response.choices && response.choices.length > 0) {
                const text = response.choices[0].message.content.trim();
                const isWorking = text.includes('API key is working');
                
                if (isWorking) {
                    console.log('✅ Mistral API key validated successfully');
                    return true;
                } else {
                    console.warn(`⚠️  Mistral responded but with unexpected text: "${text}"`);
                    return false;
                }
            }
            
            return false;
        } catch (error) {
            console.error('❌ Mistral API key test failed:', error.message);
            return false;
        }
    }

    async makeRequest(endpoint, body) {
        const url = `${this.config.baseUrl}${endpoint}`;
        
        try {
            const fetch = require('node-fetch'); // Ensure node-fetch is available
            
            const response = await fetch(url, {
                method: 'POST',
                headers: this.client.headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Mistral API error (${response.status}): ${errorBody}`);
            }

            return await response.json();
        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to Mistral API. Please check your internet connection.');
            }
            throw error;
        }
    }

    extractJSONFromResponse(text) {
        // Remove markdown code blocks
        let cleaned = text.replace(/```json\s*|\s*```/g, '');

        // Remove any text before the first { and after the last }
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No JSON object found in response');
        }

        cleaned = cleaned.substring(firstBrace, lastBrace + 1);

        // Fix common JSON issues
        cleaned = cleaned
            .replace(/([^\\])\\([^\\"])/g, '$1\\\\$2') // Fix unescaped backslashes
            .replace(/^\s*["']?json["']?\s*/, '') // Remove leading "json"
            .trim();

        // Validate JSON
        try {
            JSON.parse(cleaned);
            return cleaned;
        } catch (error) {
            console.warn('JSON parse failed, attempting basic repair...');
            
            // Basic JSON repair
            const repaired = cleaned
                .replace(/,\s*}/g, '}') // Remove trailing commas
                .replace(/,\s*]/g, ']')
                .replace(/([^\\])"/g, '$1\\"') // Escape unescaped quotes
                .replace(/^"/, '\\"'); // Escape leading quote if present
            
            try {
                JSON.parse(repaired);
                return repaired;
            } catch (repairError) {
                throw new Error(`Invalid JSON format: ${error.message}`);
            }
        }
    }
}

module.exports = MistralProvider;