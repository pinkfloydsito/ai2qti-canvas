import BaseLLMProvider from './base-llm-provider.js';
import JSONExtractor from './json-extractor.js';
import log from 'electron-log/main.js';

/**
 * DeepSeek AI LLM Provider implementation
 * Uses DeepSeek's OpenAI-compatible API
 */
class DeepSeekProvider extends BaseLLMProvider {
  constructor() {
    super('deepseek', {
      models: [
        'deepseek-reasoner',
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
      log.info('DeepSeek client initialized successfully');
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
        log.info(`Attempting generation with DeepSeek model: ${currentModel} (${i + 1}/${modelsToTry.length})`);

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
        log.info(`✅ ${currentModel} - Response received: ${text.length} characters`);

        // Extract and parse JSON from response using unified extractor
        const cleanText = JSONExtractor.extractJSONFromResponse(text, 'DeepSeek');
        const parsedQuestions = JSONExtractor.validateQuestionsStructure(cleanText);

        log.info(`✅ ${currentModel} - Successfully parsed ${parsedQuestions.questions.length} questions`);
        return parsedQuestions.questions;

      } catch (error) {
        lastError = error;
        log.warn(`❌ ${currentModel} failed: ${error.message}`);

        // DeepSeek might have different error handling for different models
        if (error.message.includes('model not found') || error.message.includes('invalid model')) {
          log.info(`⏭️  Model ${currentModel} not available, trying next model...`);
          continue;
        }

        if (i === modelsToTry.length - 1) {
          log.error('🚨 All DeepSeek models failed. Throwing last error.');
          break;
        }

        log.info(`⏭️  Trying next model...`);
        continue;
      }
    }

    // If we get here, all models failed
    log.error('💥 All DeepSeek models exhausted');
    if (lastError instanceof SyntaxError) {
      throw new Error(`Failed to parse LLM response as JSON (tried ${modelsToTry.length} models): ${lastError.message}`);
    }
    throw new Error(`All DeepSeek models failed (tried ${modelsToTry.length} models). Last error: ${lastError.message}`);
  }

  async performApiKeyTest() {
    try {
      log.info('Testing DeepSeek API key...');

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
          log.info('✅ DeepSeek API key validated successfully');
          return true;
        } else {
          log.warn(`⚠️  DeepSeek responded but with unexpected text: "${text}"`);
          return false;
        }
      }

      return false;
    } catch (error) {
      log.error('❌ DeepSeek API key test failed:', error.message);
      return false;
    }
  }

  async makeRequest(endpoint, body) {
    const url = `${this.config.baseUrl}${endpoint}`;

    try {
      // Use global fetch (Node.js 18+) or import if needed
      if (typeof fetch === "undefined") {
        const { default: fetch } = await import("node-fetch");
        global.fetch = fetch;
      }

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

}

export default DeepSeekProvider;
