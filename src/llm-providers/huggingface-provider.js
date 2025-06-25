const BaseLLMProvider = require('./base-llm-provider');

/**
 * Hugging Face LLM Provider implementation
 * Uses Hugging Face Inference API for free tier models
 */
class HuggingFaceProvider extends BaseLLMProvider {
    constructor() {
        super('huggingface', {
            models: [
                'mistralai/Mistral-7B-Instruct-v0.1',
                'microsoft/DialoGPT-medium',
                'google/flan-t5-large',
                'bigscience/bloom-560m',
                'facebook/blenderbot-400M-distill'
            ],
            supportsStreaming: false,
            maxTokens: 1024,
            rateLimits: {
                requestsPerHour: 1000, // Free tier limit
                requestsPerDay: 10000
            },
            baseUrl: 'https://api-inference.huggingface.co'
        });
    }

    async initializeClient() {
        try {
            this.client = {
                apiKey: this.apiKey,
                baseUrl: this.config.baseUrl,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };
            console.log('Hugging Face client initialized successfully');
        } catch (error) {
            throw new Error(`Failed to initialize Hugging Face client: ${error.message}`);
        }
    }

    async performGeneration(prompt, options = {}) {
        const modelsToTry = this.config.models;
        let lastError = null;

        for (let i = 0; i < modelsToTry.length; i++) {
            const currentModel = modelsToTry[i];
            
            try {
                console.log(`Attempting generation with Hugging Face model: ${currentModel} (${i + 1}/${modelsToTry.length})`);
                
                // Different models may require different input formats
                const requestBody = this.formatRequestForModel(currentModel, prompt, options);
                const response = await this.makeRequest(currentModel, requestBody);
                
                // Parse response based on model type
                const text = this.extractTextFromResponse(response, currentModel);
                console.log(`✅ ${currentModel} - Response received: ${text.length} characters`);

                // Extract and parse JSON from response
                const cleanText = this.extractJSONFromResponse(text);
                const parsedQuestions = JSON.parse(cleanText);

                if (!parsedQuestions.questions || !Array.isArray(parsedQuestions.questions)) {
                    throw new Error('Invalid response format from Hugging Face API');
                }

                console.log(`✅ ${currentModel} - Successfully parsed ${parsedQuestions.questions.length} questions`);
                return parsedQuestions.questions;
                
            } catch (error) {
                lastError = error;
                console.warn(`❌ ${currentModel} failed: ${error.message}`);
                
                // Handle model loading errors (common with HF free tier)
                if (error.message.includes('loading') || error.message.includes('currently loading')) {
                    console.log(`⏭️  Model ${currentModel} is loading, trying next model...`);
                    continue;
                }
                
                if (i === modelsToTry.length - 1) {
                    console.error('🚨 All Hugging Face models failed. Throwing last error.');
                    break;
                }
                
                console.log(`⏭️  Trying next model...`);
                continue;
            }
        }

        // If we get here, all models failed
        console.error('💥 All Hugging Face models exhausted');
        if (lastError instanceof SyntaxError) {
            throw new Error(`Failed to parse LLM response as JSON (tried ${modelsToTry.length} models): ${lastError.message}`);
        }
        throw new Error(`All Hugging Face models failed (tried ${modelsToTry.length} models). Last error: ${lastError.message}`);
    }

    async performApiKeyTest() {
        try {
            console.log('Testing Hugging Face API key...');
            
            // Use a simple model for testing
            const testModel = 'microsoft/DialoGPT-medium';
            const requestBody = {
                inputs: 'Say "API key is working" in exactly those words.',
                parameters: {
                    max_length: 50,
                    temperature: 0.1
                }
            };

            const response = await this.makeRequest(testModel, requestBody);
            
            if (Array.isArray(response) && response.length > 0) {
                const text = response[0].generated_text || response[0].translation_text || response[0].summary_text || '';
                const isWorking = text.includes('API key is working');
                
                if (isWorking) {
                    console.log('✅ Hugging Face API key validated successfully');
                    return true;
                } else {
                    console.warn(`⚠️  Hugging Face responded but with unexpected text: "${text}"`);
                    return false;
                }
            }
            
            return false;
        } catch (error) {
            console.error('❌ Hugging Face API key test failed:', error.message);
            return false;
        }
    }

    formatRequestForModel(model, prompt, options = {}) {
        // Different HF models have different input formats
        if (model.includes('DialoGPT')) {
            return {
                inputs: prompt,
                parameters: {
                    max_length: options.maxTokens || 512,
                    temperature: options.temperature || 0.7,
                    do_sample: true
                }
            };
        } else if (model.includes('flan-t5')) {
            return {
                inputs: `Generate educational questions: ${prompt}`,
                parameters: {
                    max_length: options.maxTokens || 512,
                    temperature: options.temperature || 0.7
                }
            };
        } else if (model.includes('bloom')) {
            return {
                inputs: prompt,
                parameters: {
                    max_new_tokens: options.maxTokens || 256,
                    temperature: options.temperature || 0.7,
                    do_sample: true
                }
            };
        } else {
            // Default format for instruction-following models
            return {
                inputs: prompt,
                parameters: {
                    max_new_tokens: options.maxTokens || 512,
                    temperature: options.temperature || 0.7,
                    do_sample: true,
                    top_p: options.topP || 0.9
                }
            };
        }
    }

    extractTextFromResponse(response, model) {
        if (Array.isArray(response) && response.length > 0) {
            const result = response[0];
            
            // Different models return different response formats
            if (result.generated_text) {
                return result.generated_text;
            } else if (result.translation_text) {
                return result.translation_text;
            } else if (result.summary_text) {
                return result.summary_text;
            } else if (typeof result === 'string') {
                return result;
            }
        }
        
        if (typeof response === 'string') {
            return response;
        }
        
        throw new Error(`Unexpected response format from model ${model}: ${JSON.stringify(response)}`);
    }

    async makeRequest(model, body) {
        const url = `${this.config.baseUrl}/models/${model}`;
        
        try {
            const fetch = require('node-fetch');
            
            const response = await fetch(url, {
                method: 'POST',
                headers: this.client.headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                let errorMessage = `Hugging Face API error (${response.status}): ${errorBody}`;
                
                // Parse error details if available
                try {
                    const errorJson = JSON.parse(errorBody);
                    if (errorJson.error) {
                        errorMessage = `Hugging Face API error: ${errorJson.error}`;
                    }
                } catch (parseError) {
                    // Use raw error body
                }
                
                throw new Error(errorMessage);
            }

            return await response.json();
        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to Hugging Face API. Please check your internet connection.');
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
            // If no JSON found, try to construct it from the text
            console.warn('No JSON object found, attempting to construct from text');
            return this.constructJSONFromText(text);
        }

        cleaned = cleaned.substring(firstBrace, lastBrace + 1);

        // Hugging Face specific cleaning
        cleaned = cleaned
            .replace(/^\s*["']?json["']?\s*/, '') // Remove leading "json"
            .trim();

        // Validate JSON
        try {
            JSON.parse(cleaned);
            return cleaned;
        } catch (error) {
            console.warn('JSON parse failed, attempting to construct from text...');
            return this.constructJSONFromText(text);
        }
    }

    constructJSONFromText(text) {
        // Fallback: construct basic JSON structure from unstructured text
        // This is a simple approach for when HF models don't return proper JSON
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        const questions = [];
        let currentQuestion = null;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Look for question patterns
            if (trimmedLine.match(/^\d+\./) || trimmedLine.toLowerCase().includes('question')) {
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }
                currentQuestion = {
                    type: 'multiple_choice',
                    text: trimmedLine.replace(/^\d+\.\s*/, ''),
                    points: 1,
                    choices: [],
                    correctAnswer: 0,
                    explanation: ''
                };
            } else if (currentQuestion && (trimmedLine.match(/^[A-D][\)\.]/))) {
                // Multiple choice option
                const choiceText = trimmedLine.replace(/^[A-D][\)\.]\s*/, '');
                currentQuestion.choices.push({
                    id: currentQuestion.choices.length,
                    text: choiceText
                });
            }
        }
        
        if (currentQuestion) {
            questions.push(currentQuestion);
        }
        
        if (questions.length === 0) {
            throw new Error('Could not extract questions from Hugging Face response');
        }
        
        return JSON.stringify({ questions });
    }
}

module.exports = HuggingFaceProvider;