import ProviderFactory from './llm-providers/provider-factory.js';
import ConfigManager from './config/config-manager.js';
import ApiKeyCache from './services/api-key-cache.js';

import log from 'electron-log/main.js';

/**
 * Enhanced LLM Service with SOLID architecture
 * Supports multiple providers with clean separation of concerns
 */
class LLMService {
  constructor() {
    this.configManager = new ConfigManager();
    this.apiKeyCache = new ApiKeyCache(this.configManager);
    this.currentProvider = null;
    this.providerName = null;
    this.fallbackProviders = [];

    // Default configuration
    this.config = {
      primaryProvider: 'gemini',
      fallbackProviders: ['mistral', 'deepseek', 'huggingface'],
      autoFallback: true,
      maxRetries: 3
    };
  }

  /**
   * Set the primary provider and configure it
   * @param {string} providerName - Name of the provider
   * @param {string} apiKey - API key for the provider
   * @param {Object} options - Additional configuration options
   */
  async setProvider(providerName, apiKey, options = {}) {
    try {
      // Create and configure the provider
      this.currentProvider = ProviderFactory.createProvider(providerName);
      await this.currentProvider.configure(apiKey, options);

      this.providerName = providerName;

      // Cache the API key if validation successful
      if (await this.currentProvider.testApiKey()) {
        await this.apiKeyCache.setApiKey(providerName, apiKey, () => this.currentProvider.testApiKey());
        log.info(`✅ ${providerName} provider configured and validated successfully`);
      } else {
        log.debug(`⚠️  ${providerName} provider configured but API key validation failed`);
      }

    } catch (error) {
      log.error(`❌ Failed to configure ${providerName} provider:`, error.message);
      throw new Error(`Failed to configure ${providerName} provider: ${error.message}`);
    }
  }

  /**
   * Configure fallback providers for automatic failover
   * @param {Array<Object>} fallbackConfigs - Array of {provider, apiKey} objects
   */
  async configureFallbackProviders(fallbackConfigs) {
    this.fallbackProviders = [];

    for (const config of fallbackConfigs) {
      try {
        const provider = ProviderFactory.createProvider(config.provider);
        await provider.configure(config.apiKey, config.options || {});

        this.fallbackProviders.push({
          name: config.provider,
          provider: provider,
          isValid: await provider.testApiKey()
        });

        log.info(`📋 Fallback provider ${config.provider} configured`);
      } catch (error) {
        log.warn(`⚠️  Failed to configure fallback provider ${config.provider}:`, error.message);
      }
    }

    log.info(`🔄 Configured ${this.fallbackProviders.length} fallback providers`);
  }

  /**
   * Generate questions using the configured provider with automatic fallback
   * @param {string} context - The content context for question generation
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Array of generated questions
   */
  async generateQuestions(context, options = {}) {
    const {
      questionCount = 5,
      difficulty = 'medium',
      questionTypes = ['multiple_choice'],
      includeMath = true,
      attachments = [],
      maxRetries = this.config.maxRetries
    } = options;

    const prompt = this.buildPrompt(context, {
      questionCount,
      difficulty,
      questionTypes,
      includeMath,
      withAttachments: attachments.length > 0
    });

    // Prepare options with attachments for provider
    const providerOptions = {
      ...options,
      attachments: attachments.map(file => {
        if (!file.path) {
          log.error('❌ Attachment missing file path:', JSON.stringify(file));
          throw new Error(`Attachment file path is missing for file: ${file.name || 'unknown'}`);
        }
        return {
          filePath: file.path,
          type: file.type
        };
      })
    };

    // Try primary provider first
    if (this.currentProvider) {
      try {
        log.info(`🎯 Attempting generation with primary provider: ${this.providerName}`);
        if (attachments.length > 0) {
          log.info(`📎 Using ${attachments.length} attachment(s): ${attachments.map(f => f.name).join(', ')}`);
        }
        const questions = await this.currentProvider.generateQuestions(prompt, providerOptions);
        return this.validateAndProcessQuestions(questions);
      } catch (error) {
        log.warn(`❌ Primary provider ${this.providerName} failed:`, error.message);

        if (!this.config.autoFallback) {
          throw error;
        }
      }
    }

    // Try fallback providers if auto-fallback is enabled
    if (this.config.autoFallback && this.fallbackProviders.length > 0) {
      log.info('🔄 Attempting fallback providers...');

      for (const fallback of this.fallbackProviders) {
        if (!fallback.isValid) {
          log.info(`⏭️  Skipping invalid fallback provider: ${fallback.name}`);
          continue;
        }

        try {
          log.info(`🎯 Attempting generation with fallback provider: ${fallback.name}`);
          log.info(`📤 Sending request to fallback provider: ${fallback.name}`);

          const questions = await fallback.provider.generateQuestions(prompt, providerOptions);
          log.info(`📥 Received response from ${fallback.name}`);
          log.info('🔍 Validating and processing questions...');

          const processedQuestions = this.validateAndProcessQuestions(questions);

          log.info(`✅ Successfully generated ${processedQuestions.length} questions with ${fallback.name}`);
          log.info(`📊 Generated ${processedQuestions.length} questions with ${fallback.name}`);
          return processedQuestions;
        } catch (error) {
          log.warn(`❌ Fallback provider ${fallback.name} failed:`, error.message);
          log.error(`❌ Fallback provider ${fallback.name} failed: ${error.message}`);
        }
      }
    }

    const errorMessage = 'All configured providers failed to generate questions';
    log.error(errorMessage);
    throw new Error(errorMessage);
  }

  /**
   * Test API key for a specific provider
   * @param {string} providerName - Name of the provider
   * @param {string} apiKey - API key to test
   * @returns {Promise<boolean>} True if API key is valid
   */
  async testApiKey(providerName, apiKey) {
    try {
      const provider = ProviderFactory.createProvider(providerName);
      await provider.configure(apiKey);
      return await provider.testApiKey();
    } catch (error) {
      log.error(`API key test failed for ${providerName}:`, error.message);
      return false;
    }
  }

  /**
   * Get information about all available providers
   * @returns {Array<Object>} Provider information
   */
  getAvailableProviders() {
    return ProviderFactory.getAllProviderInfo();
  }

  /**
   * Get information about the current provider
   * @returns {Object|null} Current provider information
   */
  getCurrentProviderInfo() {
    if (!this.currentProvider) {
      return null;
    }

    return {
      name: this.providerName,
      ...this.currentProvider.getProviderInfo(),
      fallbackCount: this.fallbackProviders.length
    };
  }

  /**
   * Builds the prompt for question generation with support for attachments
   * @param {string} context - Content context
   * @param {Object} options - Generation options
   * @param {Array} [attachments=[]] - Optional file attachments
   * @returns {string} Formatted prompt
   */
  buildPrompt(context, options) {
    const {
      questionCount = 10,
      difficulty = 'medium',
      questionTypes = ['multiple_choice', 'short_answer'],
      includeMath = false,
      withAttachments = false,
    } = options;

    // Core prompt components
    const baseInstruction = withAttachments
      ? 'consider the number of questions given in the file starting by the tag \\begin{ejerc}, copy all the questions from the attached files, using all its options. Inlude latex expressions of course'
      : `Generate ${questionCount} questions from the text content`;

    const questionTypeInstruction = withAttachments ? this.buildQuestionTypeInstruction(questionTypes) : `questions of types: multiple_choice,
      true_false,
      short_answer,
      essay
`;
    const mathInstruction = withAttachments ? this.buildMathInstruction(includeMath) : '\n';
    const formatInstruction = this.buildFormatInstruction();

    return `
${baseInstruction} at ${difficulty} difficulty level.

${withAttachments ? 'Attachment content:' : 'Text content:'}
${context}

Instructions:
1. ${questionTypeInstruction}
2. Difficulty level: ${withAttachments ? difficulty : 'given in the attachment questions'}
3. ${mathInstruction}
4. ${formatInstruction}

${this.getJsonSchemaExample()}
`;
  }

  // Helper methods decomposed for single responsibility
  buildQuestionTypeInstruction(questionTypes) {
    const typeMap = {
      multiple_choice: 'multiple choice (4 options)',
      true_false: 'true/false',
      short_answer: 'short answer',
      essay: 'essay'
    };

    const formattedTypes = questionTypes.map(type =>
      typeMap[type] || type
    ).join(', ');

    return `Create questions of these types: ${formattedTypes}. ` +
      'For multiple choice: provide exactly 4 options with one correct answer. ' +
      'For true/false: provide correct boolean answer. ' +
      'For short answer: provide sample correct answer. ' +
      'For essay: provide grading criteria.';
  }

  buildMathInstruction(includeMath) {
    return includeMath
      ? 'Use LaTeX notation for math: '
      + 'Single backslashes for JSON-compatible LaTeX (e.g., "$\\int_0^1 x^2 dx$" for inline, '
      + '"$$\\\\frac{1}{2}$$" for display math, "$90^\\circ$" for degrees).'
      : 'Avoid complex mathematical notation.';
  }

  buildFormatInstruction() {
    return 'Return ONLY valid JSON with no additional text. ' +
      'Ensure proper escaping and UTF-8 compatibility.';
  }

  getJsonSchemaExample() {
    return `JSON response structure example (ALWAYS follow exactly):
{
  "questions": [
    {
      "type": "multiple_choice",
      "text": "Question text",
      "points": 2,
      "choices": [
        {"id": 0, "text": "Option A"},
        {"id": 1, "text": "Option B"},
        {"id": 2, "text": "Option C"},
        {"id": 3, "text": "Option D"}
      ],
      "correctAnswer": 1,
      "explanation": "Explanation"
    },
    {
      "type": "short_answer",
      "text": "Question text",
      "points": 3,
      "sampleAnswer": "Correct answer",
      "explanation": "Explanation"
    }
  ]
}`;
  }

  /**
   * Validate and process questions from any provider
   * @param {Array} questions - Raw questions from provider
   * @returns {Array} Processed questions
   */
  validateAndProcessQuestions(questions) {
    log.info(`Starting validation of ${questions.length} questions`);
    const processedQuestions = [];

    questions.forEach((question, index) => {
      try {
        log.info(`Processing question ${index + 1}:`, {
          type: question.type,
          text: question.text?.substring(0, 50) + '...',
          hasChoices: question.choices ? question.choices.length : 'N/A',
          correctAnswer: question.correctAnswer
        });

        const processedQuestion = {
          id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
          type: question.type,
          text: question.text,
          points: question.points || 1
        };

        // Validate question type
        if (!['multiple_choice', 'true_false', 'short_answer', 'essay'].includes(question.type)) {
          log.warn(`Skipping question ${index + 1}: Invalid type ${question.type}`);
          return;
        }

        // Type-specific validation and processing
        if (question.type === 'multiple_choice') {
          if (!question.choices || !Array.isArray(question.choices)) {
            log.warn(`Skipping question ${index + 1}: Got:`, question.choices);
            return;
          }
          processedQuestion.choices = question.choices.map((choice, i) => ({
            id: i,
            text: choice.text
          }));
          processedQuestion.correctAnswer = question.correctAnswer;
          log.info(`Multiple choice question processed. Correct answer: ${question.correctAnswer}`);
        } else if (question.type === 'true_false') {
          if (!['true', 'false'].includes(question.correctAnswer)) {
            log.warn(`Skipping question ${index + 1}: True/false must have 'true' or 'false' as correct answer. Got: ${question.correctAnswer}`);
            return;
          }
          processedQuestion.correctAnswer = question.correctAnswer;
        } else if (question.type === 'short_answer') {
          processedQuestion.sampleAnswer = question.sampleAnswer || '';
        } else if (question.type === 'essay') {
          processedQuestion.gradingRubric = question.gradingRubric || '';
        }

        // Add explanation if provided
        if (question.explanation) {
          processedQuestion.explanation = question.explanation;
        }

        processedQuestions.push(processedQuestion);
        log.info(`Successfully processed question ${index + 1}`);
      } catch (error) {
        log.warn(`Error processing question ${index + 1}:`, error);
      }
    });

    log.info(`Validation complete. ${processedQuestions.length} questions processed successfully.`);

    if (processedQuestions.length === 0) {
      throw new Error('No valid questions were generated');
    }

    return processedQuestions;
  }

  /**
   * Extract text from PDF using the existing extractor
   * @param {Buffer} pdfBuffer - PDF buffer
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromPDF(pdfBuffer) {
    const PDFExtractor = require('./pdf-extractor');

    try {
      const extractor = new PDFExtractor();
      const text = await extractor.extractText(pdfBuffer);

      if (text && text.trim().length > 0) {
        return text;
      } else {
        throw new Error('No readable text found in PDF.');
      }

    } catch (error) {
      log.warn('PDF extraction failed:', error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Get cached API key for a provider
   * @param {string} providerName - Provider name
   * @returns {string|null} Cached API key
   */
  getCachedApiKey(providerName) {
    return this.apiKeyCache.getApiKey(providerName);
  }

  /**
   * Remove cached API key for a provider
   * @param {string} providerName - Provider name
   */
  removeCachedApiKey(providerName) {
    this.apiKeyCache.removeApiKey(providerName);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return this.apiKeyCache.getStats();
  }

  /**
   * Clear all cached API keys
   */
  clearCache() {
    this.apiKeyCache.clear();
  }

  /**
   * Get configuration value
   * @param {string} path - Configuration path
   * @returns {*} Configuration value
   */
  getConfig(path) {
    return this.configManager.get(path);
  }

  /**
   * Set configuration value
   * @param {string} path - Configuration path
   * @param {*} value - Configuration value
   */
  setConfig(path, value) {
    this.configManager.set(path, value);
  }

  /**
   * Update service configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.currentProvider) {
      this.currentProvider.destroy();
    }

    this.fallbackProviders.forEach(fallback => {
      fallback.provider.destroy();
    });

    if (this.apiKeyCache) {
      this.apiKeyCache.destroy();
    }

    this.currentProvider = null;
    this.fallbackProviders = [];
  }
}

export default LLMService;
