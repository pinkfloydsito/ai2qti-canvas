import { GoogleGenAI } from '@google/genai';
import BaseLLMProvider from './base-llm-provider.js';
import JSONExtractor from './json-extractor.js';
import fs from 'fs';
import path from 'path';

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
      this.client = new GoogleGenAI({
        apiKey: this.apiKey
      });
      console.log('Gemini client initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize Gemini client: ${error.message}`);
    }
  }

  /**
   * Upload a file to Gemini AI
   * @param {string} filePath - Path to the file to upload
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<Object>} Upload result with file URI
   */
  async uploadFile(filePath, mimeType) {
    try {
      const uploadResult = await this.client.files.upload({
        file: filePath,
        config: { mimeType }
      });

      console.log(`✅ File uploaded successfully: ${uploadResult.name}`);
      console.log(`   URI: ${uploadResult.uri}`);

      return uploadResult;
    } catch (error) {
      console.error(`❌ Failed to upload file ${filePath}:`, error.message);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Process attachments for Gemini AI
   * @param {Array} attachments - Array of attachment objects with filePath and type
   * @returns {Promise<Array>} Array of processed attachment objects for Gemini
   */
  async processAttachments(attachments) {
    const processedAttachments = [];

    for (const attachment of attachments) {
      const { filePath, type } = attachment;

      if (!fs.existsSync(filePath)) {
        throw new Error(`Attachment file not found: ${filePath}`);
      }

      let mimeType;
      const ext = path.extname(filePath).toLowerCase();

      switch (ext) {
        case '.pdf':
          mimeType = 'application/pdf';
          break;
        case '.tex':
        case '.txt':
          mimeType = 'text/plain';
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}. Supported: .pdf, .tex, .txt`);
      }

      try {
        const uploadedFile = await this.uploadFile(filePath, mimeType);
        processedAttachments.push({
          fileData: {
            mimeType: uploadedFile.mimeType,
            fileUri: uploadedFile.uri
          }
        });
      } catch (error) {
        console.error(`Failed to process attachment ${filePath}:`, error.message);
        throw error;
      }
    }

    return processedAttachments;
  }

  async performGeneration(prompt, options = {}) {
    const { model = this.config.models[0], maxRetries = 3, attachments = [] } = options;

    let lastError = null;
    const modelsToTry = this.config.models;

    // Process attachments if provided
    let processedAttachments = [];
    if (attachments && attachments.length > 0) {
      try {
        console.log(`Processing ${attachments.length} attachment(s)...`);
        processedAttachments = await this.processAttachments(attachments);
        console.log(`✅ Successfully processed ${processedAttachments.length} attachment(s)`);
      } catch (error) {
        console.error('❌ Failed to process attachments:', error.message);
        throw new Error(`Attachment processing failed: ${error.message}`);
      }
    }

    // Try each model in sequence until one works (Open/Closed Principle)
    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];

      try {
        console.log(`Attempting generation with Gemini model: ${currentModel} (${i + 1}/${modelsToTry.length})`);

        // Prepare content with attachments
        let contents;
        if (processedAttachments.length > 0) {
          const parts = [
            { text: prompt },
            ...processedAttachments
          ];
          contents = [{ parts }];
        } else {
          contents = [{ parts: [{ text: prompt }] }];
        }

        const result = await this.client.models.generateContent({
          model: currentModel,
          contents
        });
        const text = result.text;

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

        const model = this.client.models.get(modelName);
        const result = await model.generateContent({
          contents: [{ parts: [{ text: 'Say "API key is working" in exactly those words.' }] }]
        });
        const text = result.text.trim();

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
