const { GoogleGenerativeAI } = require('@google/generative-ai');
const BaseLLMProvider = require('./base-llm-provider');

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

                // Extract and parse JSON from response
                const cleanText = this.extractJSONFromResponse(text);
                const parsedQuestions = JSON.parse(cleanText);

                if (!parsedQuestions.questions || !Array.isArray(parsedQuestions.questions)) {
                    throw new Error('Invalid response format from Gemini API');
                }

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

        // Fix LaTeX escape sequences that might be broken
        cleaned = cleaned
            .replace(/\\\\(\w+)/g, '\\\\$1') // Ensure double backslashes for LaTeX commands
            .replace(/([^\\])\\([a-zA-Z])/g, '$1\\\\$2') // Fix single backslashes before letters
            .replace(/\\\"/g, '\\\\"') // Fix escaped quotes
            .replace(/^\s*["']?json["']?\s*/, '') // Remove leading "json"
            .trim();

        // Validate that we can parse it
        try {
            JSON.parse(cleaned);
            return cleaned;
        } catch (error) {
            console.warn('Initial JSON parse failed, attempting repair...');

            // Try to repair common JSON issues
            const repaired = this.repairJSON(cleaned);

            // Test the repair
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

    repairJSON(jsonStr) {
        let repaired = jsonStr;

        // Step 1: Fix LaTeX escape sequences systematically
        repaired = this.fixLatexEscapes(repaired);

        // Step 2: Fix other common JSON issues
        repaired = repaired
            // Fix line breaks within strings
            .replace(/\\n/g, '\\\\n')
            .replace(/\\t/g, '\\\\t')
            // Fix unescaped quotes (but not already escaped ones)
            .replace(/(?<!\\)\\(?!\\)/g, '\\\\')
            // Clean up multiple backslashes
            .replace(/\\\\+/g, '\\\\');

        return repaired;
    }

    fixLatexEscapes(text) {
        let fixed = text;

        // Handle different LaTeX contexts
        const latexPatterns = [
            // Math expressions with single $
            {
                pattern: /\$([^$]*?)\$/g,
                fix: (match, content) => {
                    const fixedContent = this.escapeLatexInMath(content);
                    return `$${fixedContent}$`;
                }
            },
            // Math expressions with double $$
            {
                pattern: /\$\$([^$]*?)\$\$/g,
                fix: (match, content) => {
                    const fixedContent = this.escapeLatexInMath(content);
                    return `$$${fixedContent}$$`;
                }
            }
        ];

        latexPatterns.forEach(({ pattern, fix }) => {
            fixed = fixed.replace(pattern, fix);
        });

        return fixed;
    }

    escapeLatexInMath(mathContent) {
        return mathContent
            // Fix common LaTeX commands
            .replace(/\\([a-zA-Z]+)/g, '\\\\$1')
            // Fix specific symbols that need escaping
            .replace(/\\(\{|\}|\[|\]|\|)/g, '\\\\$1')
            // Fix already escaped sequences (avoid double escaping)
            .replace(/\\\\\\\\([a-zA-Z]+)/g, '\\\\$1')
            // Fix degree symbol specifically
            .replace(/\\\\circ/g, '\\\\circ')
            // Fix text commands
            .replace(/\\\\text\{([^}]*)\}/g, '\\\\text{$1}')
            // Fix fractions
            .replace(/\\\\frac\{([^}]*)\}\{([^}]*)\}/g, '\\\\frac{$1}{$2}');
    }
}

module.exports = GeminiProvider;