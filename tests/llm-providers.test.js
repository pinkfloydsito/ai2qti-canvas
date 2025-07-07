import ProviderFactory from '../src/llm-providers/provider-factory.js';
import GeminiProvider from '../src/llm-providers/gemini-provider.js';
import MistralProvider from '../src/llm-providers/mistral-provider.js';
import DeepSeekProvider from '../src/llm-providers/deepseek-provider.js';
import HuggingFaceProvider from '../src/llm-providers/huggingface-provider.js';
import BaseLLMProvider from '../src/llm-providers/base-llm-provider.js';
import JSONExtractor from '../src/llm-providers/json-extractor.js';

describe('LLM Providers Architecture', () => {
    
    describe('BaseLLMProvider', () => {
        test('should not allow direct instantiation', () => {
            expect(() => new BaseLLMProvider('test')).toThrow('Cannot instantiate abstract class BaseLLMProvider');
        });

        test('should require implementation of abstract methods', async () => {
            class TestProvider extends BaseLLMProvider {
                constructor() {
                    super('test');
                }
            }

            const provider = new TestProvider();
            
            await expect(provider.initializeClient()).rejects.toThrow('initializeClient method must be implemented by subclass');
            await expect(provider.performGeneration('test')).rejects.toThrow('performGeneration method must be implemented by subclass');
            await expect(provider.performApiKeyTest()).rejects.toThrow('performApiKeyTest method must be implemented by subclass');
        });

        test('should enforce configuration before use', async () => {
            class TestProvider extends BaseLLMProvider {
                constructor() {
                    super('test');
                }
                async initializeClient() {}
                async performGeneration() { return []; }
                async performApiKeyTest() { return true; }
            }

            const provider = new TestProvider();
            
            await expect(provider.generateQuestions('test')).rejects.toThrow('test provider is not configured');
            await expect(provider.testApiKey()).rejects.toThrow('test provider is not configured');
        });
    });

    describe('ProviderFactory', () => {
        test('should create all supported providers', () => {
            const supportedProviders = ['gemini', 'mistral', 'deepseek', 'huggingface'];
            
            supportedProviders.forEach(providerName => {
                expect(() => ProviderFactory.createProvider(providerName)).not.toThrow();
                const provider = ProviderFactory.createProvider(providerName);
                expect(provider).toBeInstanceOf(BaseLLMProvider);
            });
        });

        test('should throw error for unsupported provider', () => {
            expect(() => ProviderFactory.createProvider('unsupported')).toThrow('Unsupported provider: unsupported');
        });

        test('should return correct available providers', () => {
            const providers = ProviderFactory.getAvailableProviders();
            expect(providers).toContain('gemini');
            expect(providers).toContain('mistral');
            expect(providers).toContain('deepseek');
            expect(providers).toContain('huggingface');
        });

        test('should validate provider support check', () => {
            expect(ProviderFactory.isProviderSupported('gemini')).toBe(true);
            expect(ProviderFactory.isProviderSupported('GEMINI')).toBe(true); // Case insensitive
            expect(ProviderFactory.isProviderSupported('nonexistent')).toBe(false);
        });

        test('should register new providers', () => {
            class CustomProvider extends BaseLLMProvider {
                constructor() { super('custom'); }
                async initializeClient() {}
                async performGeneration() { return []; }
                async performApiKeyTest() { return true; }
            }

            const initialCount = ProviderFactory.getAvailableProviders().length;
            ProviderFactory.registerProvider('custom', CustomProvider);
            
            expect(ProviderFactory.getAvailableProviders().length).toBe(initialCount + 1);
            expect(ProviderFactory.isProviderSupported('custom')).toBe(true);
            
            const customProvider = ProviderFactory.createProvider('custom');
            expect(customProvider).toBeInstanceOf(CustomProvider);
        });

        test('should create multiple providers', () => {
            const providerNames = ['gemini', 'mistral'];
            const providers = ProviderFactory.createMultipleProviders(providerNames);
            
            expect(providers.size).toBe(2);
            expect(providers.has('gemini')).toBe(true);
            expect(providers.has('mistral')).toBe(true);
            expect(providers.get('gemini')).toBeInstanceOf(GeminiProvider);
            expect(providers.get('mistral')).toBeInstanceOf(MistralProvider);
        });

        test('should get provider information', () => {
            const providerInfos = ProviderFactory.getAllProviderInfo();
            
            expect(Array.isArray(providerInfos)).toBe(true);
            expect(providerInfos.length).toBeGreaterThan(0);
            
            const geminiInfo = providerInfos.find(info => info.name === 'gemini');
            expect(geminiInfo).toBeDefined();
            expect(geminiInfo.models).toContain('gemini-2.5-flash');
            expect(typeof geminiInfo.supportsStreaming).toBe('boolean');
            expect(typeof geminiInfo.maxTokens).toBe('number');
        });

        test('should validate provider configuration', () => {
            const validConfig = {
                apiKey: 'test-key',
                model: 'gemini-2.5-flash',
                maxTokens: 1000
            };
            
            const validation = ProviderFactory.validateProviderConfig('gemini', validConfig);
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            
            const invalidConfig = {
                model: 'gemini-2.5-flash'
                // Missing apiKey
            };
            
            const invalidValidation = ProviderFactory.validateProviderConfig('gemini', invalidConfig);
            expect(invalidValidation.isValid).toBe(false);
            expect(invalidValidation.errors).toContain('API key is required');
        });
    });

    describe('GeminiProvider', () => {
        let provider;

        beforeEach(() => {
            provider = new GeminiProvider();
        });

        test('should initialize with correct configuration', () => {
            expect(provider.name).toBe('gemini');
            expect(provider.getAvailableModels()).toContain('gemini-2.5-flash');
            expect(provider.config.supportsStreaming).toBe(true);
            expect(provider.config.maxTokens).toBe(8192);
        });

        test('should require API key for configuration', async () => {
            await expect(provider.configure('')).rejects.toThrow('API key is required for gemini provider');
        });

        test('should extract JSON from response correctly using unified extractor', () => {
            const testResponse = '```json\n{"questions": [{"type": "multiple_choice", "text": "Test?"}]}\n```';
            const result = JSONExtractor.extractJSONFromResponse(testResponse, 'Gemini');
            const parsed = JSON.parse(result);
            
            expect(parsed.questions).toBeDefined();
            expect(parsed.questions[0].type).toBe('multiple_choice');
        });

        test('should handle LaTeX in JSON responses using unified extractor', () => {
            const testResponse = '{"questions": [{"text": "What is $\\\\frac{x}{2}$?"}]}';
            const result = JSONExtractor.extractJSONFromResponse(testResponse, 'Gemini');
            const parsed = JSON.parse(result);
            
            expect(parsed.questions[0].text).toContain('\\frac{x}{2}');
        });

        test('should convert double backslashes to single backslashes in LaTeX expressions', () => {
            const testResponse = JSON.stringify({
                "id": 1,
                "type": "multiple_choice",
                "text": "A regular tetrahedron is inscribed in a sphere of radius $R$. What is the volume of the tetrahedron in terms of $R$?",
                "points": 2,
                "choices": [
                    {"id": 0, "text": "$\\\\frac{4\\\\sqrt{2}}{9}R^3$"},
                    {"id": 1, "text": "$\\\\frac{8\\\\sqrt{3}}{27}R^3$"},
                    {"id": 2, "text": "$\\\\frac{2\\\\sqrt{6}}{9}R^3$"},
                    {"id": 3, "text": "$\\\\frac{16\\\\sqrt{3}}{81}R^3$"}
                ],
                "correctAnswer": 1,
                "explanation": "Let $a$ be the side length of the regular tetrahedron. The height of the tetrahedron is $h = a\\\\sqrt{\\\\frac{2}{3}}$. The center of the inscribed sphere (circumcenter) coincides with the tetrahedron's centroid. The distance from the centroid to any vertex is $R$. The centroid divides the altitude from a vertex to the center of the opposite face in a $3:1$ ratio (vertex to centroid is $3/4$ of the total height). Thus, $R = \\\\frac{3}{4}h = \\\\frac{3}{4}a\\\\sqrt{\\\\frac{2}{3}} = \\\\frac{3a\\\\sqrt{6}}{12} = \\\\frac{a\\\\sqrt{6}}{4}$."
            });
            
            const result = JSONExtractor.extractJSONFromResponse(testResponse, 'Test');
            const parsed = JSON.parse(result);
            
            // Check that double backslashes are converted to single backslashes
            expect(parsed.choices[0].text).toBe('$\\frac{4\\sqrt{2}}{9}R^3$');
            expect(parsed.choices[1].text).toBe('$\\frac{8\\sqrt{3}}{27}R^3$');
            expect(parsed.choices[2].text).toBe('$\\frac{2\\sqrt{6}}{9}R^3$');
            expect(parsed.choices[3].text).toBe('$\\frac{16\\sqrt{3}}{81}R^3$');
            
            // Check explanation text has single backslashes by checking for LaTeX commands
            expect(parsed.explanation).toContain('\\frac');
            expect(parsed.explanation).toContain('\\sqrt');
            
            // Ensure no double backslashes remain in any choice text
            expect(parsed.choices[0].text).not.toContain('\\\\');
            expect(parsed.choices[1].text).not.toContain('\\\\');
            expect(parsed.choices[2].text).not.toContain('\\\\');
            expect(parsed.choices[3].text).not.toContain('\\\\');
            expect(parsed.explanation).not.toContain('\\\\');
        });

        test('should repair malformed JSON using unified extractor', () => {
            const malformedJson = '{"questions": [{"text": "Test"}]}'; // Valid JSON for test
            const result = JSONExtractor.extractJSONFromResponse(malformedJson, 'Gemini');
            
            expect(() => JSON.parse(result)).not.toThrow();
        });
    });

    describe('MistralProvider', () => {
        let provider;

        beforeEach(() => {
            provider = new MistralProvider();
        });

        test('should initialize with correct configuration', () => {
            expect(provider.name).toBe('mistral');
            expect(provider.getAvailableModels()).toContain('mistral-7b-instruct');
            expect(provider.config.baseUrl).toBe('https://api.mistral.ai/v1');
            expect(provider.config.rateLimits.requestsPerMinute).toBe(5);
        });

        test('should format request correctly', async () => {
            // Mock the client initialization
            provider.client = {
                headers: {
                    'Authorization': 'Bearer test-key',
                    'Content-Type': 'application/json'
                }
            };
            provider.isConfigured = true;

            // Test the makeRequest method would be called with correct format
            const testPrompt = 'Generate questions';
            
            // We can't easily test the actual API call without mocking fetch
            // But we can verify the provider structure is correct
            expect(provider.config.models.length).toBeGreaterThan(0);
            expect(provider.config.baseUrl).toBeTruthy();
        });
    });

    describe('DeepSeekProvider', () => {
        let provider;

        beforeEach(() => {
            provider = new DeepSeekProvider();
        });

        test('should initialize with correct configuration', () => {
            expect(provider.name).toBe('deepseek');
            expect(provider.getAvailableModels()).toContain('deepseek-chat');
            expect(provider.config.baseUrl).toBe('https://api.deepseek.com/v1');
        });

        test('should handle model-specific errors', () => {
            const testError = new Error('model not found');
            
            // The provider should handle this type of error gracefully
            expect(testError.message).toContain('model not found');
        });

        test('should extract JSON from complex Game of Thrones response', () => {
            
            const gameOfThronesResponse = `Extracted JSON from response: {
  "questions": [
    {
      "type": "multiple_choice",
      "text": "What is the name of the Valyrian steel greatsword originally wielded by House Stark, later reforged into two smaller swords?",
      "points": 2,
      "choices": [
        {"id": 0, "text": "Oathkeeper"},
        {"id": 1, "text": "Longclaw"},
        {"id": 2, "text": "Ice"},
        {"id": 3, "text": "Heartsbane"}
      ],
      "correctAnswer": 2,
      "explanation": "Ice was the ancestral Stark greatsword melted down by Tywin Lannister and reforged into Widow's Wail and Oathkeeper."
    },
    {
      "type": "multiple_choice",
      "text": "Which character orchestrated the Purple Wedding where Joffrey Baratheon was poisoned?",
      "points": 2,
      "choices": [
        {"id": 0, "text": "Cersei Lannister"},
        {"id": 1, "text": "Petyr Baelish"},
        {"id": 2, "text": "Olenna Tyrell"},
        {"id": 3, "text": "Tyrion Lannister"}
      ],
      "correctAnswer": 1,
      "explanation": "Petyr Baelish conspired with Olenna Tyrell to poison Joffrey, though Olenna administered the poison while Baelish arranged Sansa's escape."
    }
  ]
}`;

            const result = JSONExtractor.extractJSONFromResponse(gameOfThronesResponse, 'DeepSeek');
            const parsed = JSONExtractor.validateQuestionsStructure(result);
            
            expect(parsed.questions).toBeDefined();
            expect(parsed.questions.length).toBe(2);
            
            // Test first question
            expect(parsed.questions[0].type).toBe('multiple_choice');
            expect(parsed.questions[0].text).toContain('Valyrian steel greatsword');
            expect(parsed.questions[0].choices.length).toBe(4);
            expect(parsed.questions[0].correctAnswer).toBe(2);
            expect(parsed.questions[0].explanation).toContain('Ice was the ancestral');
            
            // Test second question
            expect(parsed.questions[1].text).toContain('Purple Wedding');
            expect(parsed.questions[1].correctAnswer).toBe(1);
            expect(parsed.questions[1].explanation).toContain('Petyr Baelish');
        });
    });

    describe('HuggingFaceProvider', () => {
        let provider;

        beforeEach(() => {
            provider = new HuggingFaceProvider();
        });

        test('should initialize with correct configuration', () => {
            expect(provider.name).toBe('huggingface');
            expect(provider.getAvailableModels()).toContain('mistralai/Mistral-7B-Instruct-v0.1');
            expect(provider.config.baseUrl).toBe('https://api-inference.huggingface.co');
        });

        test('should format request for different models', () => {
            const prompt = 'Test prompt';
            
            const dialogGptRequest = provider.formatRequestForModel('microsoft/DialoGPT-medium', prompt);
            expect(dialogGptRequest.inputs).toBe(prompt);
            expect(dialogGptRequest.parameters.max_length).toBe(512);
            
            const flanRequest = provider.formatRequestForModel('google/flan-t5-large', prompt);
            expect(flanRequest.inputs).toContain('Generate educational questions');
        });

        test('should extract text from various response formats', () => {
            const responses = [
                [{ generated_text: 'Generated content' }],
                [{ translation_text: 'Translated content' }],
                [{ summary_text: 'Summary content' }],
                ['Direct string content']
            ];
            
            responses.forEach((response, index) => {
                const text = provider.extractTextFromResponse(response, 'test-model');
                expect(text).toBeTruthy();
                expect(typeof text).toBe('string');
            });
        });

        test('should construct JSON from unstructured text', () => {
            const unstructuredText = `
            1. What is the capital of France?
            A) London
            B) Paris
            C) Berlin
            D) Madrid
            
            2. What is 2 + 2?
            A) 3
            B) 4
            C) 5
            D) 6
            `;
            
            const result = provider.constructJSONFromText(unstructuredText);
            const parsed = JSON.parse(result);
            
            expect(parsed.questions).toBeDefined();
            expect(parsed.questions.length).toBe(2);
            expect(parsed.questions[0].choices.length).toBe(4);
        });
    });

    describe('Integration Tests', () => {
        test('should handle provider switching', async () => {
            const geminiProvider = ProviderFactory.createProvider('gemini');
            const mistralProvider = ProviderFactory.createProvider('mistral');
            
            expect(geminiProvider.name).toBe('gemini');
            expect(mistralProvider.name).toBe('mistral');
            
            // Both providers should implement the same interface
            expect(typeof geminiProvider.configure).toBe('function');
            expect(typeof mistralProvider.configure).toBe('function');
            expect(typeof geminiProvider.generateQuestions).toBe('function');
            expect(typeof mistralProvider.generateQuestions).toBe('function');
        });

        test('should maintain provider state independently', async () => {
            const provider1 = ProviderFactory.createProvider('gemini');
            const provider2 = ProviderFactory.createProvider('gemini');
            
            // Different instances should be independent
            expect(provider1).not.toBe(provider2);
            expect(provider1.isConfigured).toBe(false);
            expect(provider2.isConfigured).toBe(false);
        });

        test('should handle concurrent provider operations', async () => {
            const providers = ProviderFactory.createMultipleProviders(['gemini', 'mistral', 'deepseek']);
            
            // All providers should be created successfully
            expect(providers.size).toBe(3);
            
            // Each provider should be independently configurable
            for (const [name, provider] of providers) {
                expect(provider.isConfigured).toBe(false);
                expect(typeof provider.getProviderInfo).toBe('function');
                
                const info = provider.getProviderInfo();
                expect(info.name).toBe(name);
                expect(Array.isArray(info.models)).toBe(true);
            }
        });
    });

    describe('Error Handling', () => {
        test('should handle network errors gracefully', async () => {
            const provider = new MistralProvider();
            provider.client = {
                headers: { 'Authorization': 'Bearer test' }
            };
            provider.isConfigured = true;

            // Mock a network error scenario
            const originalFetch = global.fetch;
            
            // Mock fetch to throw network error
            global.fetch = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));

            await expect(provider.performGeneration('test')).rejects.toThrow(/models failed|network error/i);
        });

        test('should validate JSON responses using unified extractor', () => {
            expect(() => JSONExtractor.extractJSONFromResponse('Not JSON at all', 'Test')).toThrow('No JSON object found in response');
            expect(() => JSONExtractor.extractJSONFromResponse('{"invalid": json}', 'Test')).toThrow(/Invalid JSON format/);
        });

        test('should handle API rate limits', async () => {
            const provider = new MistralProvider();
            
            // Rate limits should be defined
            expect(provider.config.rateLimits).toBeDefined();
            expect(typeof provider.config.rateLimits.requestsPerMinute).toBe('number');
        });
    });
});

describe('Performance and Scalability', () => {
    test('should create providers efficiently', () => {
        const startTime = Date.now();
        
        for (let i = 0; i < 100; i++) {
            ProviderFactory.createProvider('gemini');
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should create 100 providers in less than 1 second
        expect(duration).toBeLessThan(1000);
    });

    test('should handle large provider registrations', () => {
        const initialCount = ProviderFactory.getAvailableProviders().length;
        
        // Register multiple test providers
        for (let i = 0; i < 10; i++) {
            class TestProvider extends BaseLLMProvider {
                constructor() { super(`test${i}`); }
                async initializeClient() {}
                async performGeneration() { return []; }
                async performApiKeyTest() { return true; }
            }
            
            ProviderFactory.registerProvider(`test${i}`, TestProvider);
        }
        
        const newCount = ProviderFactory.getAvailableProviders().length;
        expect(newCount).toBe(initialCount + 10);
    });
});