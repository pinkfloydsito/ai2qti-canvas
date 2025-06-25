const BaseLLMProvider = require('./base-llm-provider');

/**
 * DeepSeek AI LLM Provider implementation
 * Uses DeepSeek's OpenAI-compatible API
 */
class DeepSeekProvider extends BaseLLMProvider {
    constructor() {
        super('deepseek', {
            models: [
                'deepseek-chat',
                'deepseek-coder',
                'deepseek-math'
            ],
            supportsStreaming: true,
            maxTokens: 4096,
            rateLimits: {
                requestsPerMinute: 10, // Free tier limit
                tokensPerMinute: 1000000 // 1M tokens per month free
            },
            baseUrl: 'https://api.deepseek.com/v1'
        });
    }

    async initializeClient() {
        try {
            // DeepSeek uses OpenAI-compatible API format
            this.client = {
                apiKey: this.apiKey,
                baseUrl: this.config.baseUrl,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };
            console.log('DeepSeek client initialized successfully');
        } catch (error) {
            throw new Error(`Failed to initialize DeepSeek client: ${error.message}`);
        }
    }

    async performGeneration(prompt, options = {}) {
        const modelsToTry = this.config.models;
        let lastError = null;

        for (let i = 0; i < modelsToTry.length; i++) {
            const currentModel = modelsToTry[i];
            
            try {
                console.log(`Attempting generation with DeepSeek model: ${currentModel} (${i + 1}/${modelsToTry.length})`);
                
                const requestBody = {
                    model: currentModel,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful AI assistant that generates educational questions in JSON format.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: options.maxTokens || 4096,
                    temperature: options.temperature || 0.7,
                    top_p: options.topP || 0.9,
                    stream: false
                };

                const response = await this.makeRequest('/chat/completions', requestBody);
                
                if (!response.choices || response.choices.length === 0) {
                    throw new Error('No response choices returned from DeepSeek API');
                }

                const text = response.choices[0].message.content;
                console.log(`✅ ${currentModel} - Response received: ${text.length} characters`);

                // Extract and parse JSON from response
                const cleanText = this.extractJSONFromResponse(text);
                const parsedQuestions = JSON.parse(cleanText);

                if (!parsedQuestions.questions || !Array.isArray(parsedQuestions.questions)) {
                    throw new Error('Invalid response format from DeepSeek API');
                }

                console.log(`✅ ${currentModel} - Successfully parsed ${parsedQuestions.questions.length} questions`);
                return parsedQuestions.questions;
                
            } catch (error) {
                lastError = error;
                console.warn(`❌ ${currentModel} failed: ${error.message}`);
                
                // DeepSeek might have different error handling for different models
                if (error.message.includes('model not found') || error.message.includes('invalid model')) {
                    console.log(`⏭️  Model ${currentModel} not available, trying next model...`);
                    continue;
                }
                
                if (i === modelsToTry.length - 1) {
                    console.error('🚨 All DeepSeek models failed. Throwing last error.');
                    break;
                }
                
                console.log(`⏭️  Trying next model...`);
                continue;
            }
        }

        // If we get here, all models failed
        console.error('💥 All DeepSeek models exhausted');
        if (lastError instanceof SyntaxError) {
            throw new Error(`Failed to parse LLM response as JSON (tried ${modelsToTry.length} models): ${lastError.message}`);
        }
        throw new Error(`All DeepSeek models failed (tried ${modelsToTry.length} models). Last error: ${lastError.message}`);
    }

    async performApiKeyTest() {
        try {
            console.log('Testing DeepSeek API key...');
            
            const requestBody = {
                model: this.config.models[0], // Use first available model
                messages: [
                    {
                        role: 'user',
                        content: 'Say "API key is working" in exactly those words.'
                    }
                ],
                max_tokens: 20,
                temperature: 0
            };

            const response = await this.makeRequest('/chat/completions', requestBody);
            
            if (response.choices && response.choices.length > 0) {
                const text = response.choices[0].message.content.trim();
                const isWorking = text.includes('API key is working');
                
                if (isWorking) {
                    console.log('✅ DeepSeek API key validated successfully');
                    return true;
                } else {
                    console.warn(`⚠️  DeepSeek responded but with unexpected text: "${text}"`);
                    return false;
                }
            }
            
            return false;
        } catch (error) {
            console.error('❌ DeepSeek API key test failed:', error.message);
            return false;
        }
    }

    async makeRequest(endpoint, body) {
        const url = `${this.config.baseUrl}${endpoint}`;
        
        try {
            const fetch = require('node-fetch');
            
            const response = await fetch(url, {
                method: 'POST',
                headers: this.client.headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                let errorMessage = `DeepSeek API error (${response.status}): ${errorBody}`;
                
                // Parse error details if available
                try {
                    const errorJson = JSON.parse(errorBody);
                    if (errorJson.error && errorJson.error.message) {
                        errorMessage = `DeepSeek API error: ${errorJson.error.message}`;
                    }
                } catch (parseError) {
                    // Use raw error body
                }
                
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to DeepSeek API. Please check your internet connection.');
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

        // DeepSeek-specific JSON cleaning
        cleaned = cleaned
            .replace(/^\s*["']?json["']?\s*/, '') // Remove leading "json"
            .replace(/\n/g, '\\n') // Escape newlines
            .replace(/\t/g, '\\t') // Escape tabs
            .trim();

        // Validate JSON
        try {
            JSON.parse(cleaned);
            return cleaned;
        } catch (error) {
            console.warn('JSON parse failed, attempting repair...');
            
            // DeepSeek response repair
            const repaired = cleaned
                .replace(/,\s*}/g, '}') // Remove trailing commas in objects
                .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
                .replace(/([^\\])\\([^\\"])/g, '$1\\\\$2') // Fix unescaped backslashes
                .replace(/\\\"/g, '"') // Fix over-escaped quotes
                .replace(/"{2,}/g, '"'); // Fix double quotes
            
            try {
                JSON.parse(repaired);
                console.log('JSON repair successful');
                return repaired;
            } catch (repairError) {
                console.error('JSON repair failed:', repairError.message);
                throw new Error(`Invalid JSON format: ${error.message}`);
            }
        }
    }
}

module.exports = DeepSeekProvider;