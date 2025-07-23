import { GoogleGenAI } from '@google/genai';
import BaseLLMProvider from './base-llm-provider.js';
import JSONExtractor from './json-extractor.js';
import fs from 'fs';
import path from 'path';

const SUPPORTED_FILE_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".tex", "text/plain"],
  [".txt", "text/plain"],
])

const ERROR_MESSAGES = {
  FILE_NOT_FOUND: 'Attachment file not found:',
  UNSUPPORTED_FILE_TYPE: 'Unsupported file type. Supported:',
  MODEL_FAILURE: 'All Gemini models failed. Last error:',
  JSON_PARSE_FAILURE: 'Failed to parse LLM response as JSON:',
};

const MODELS_TO_TRY = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.0-flash',
  'gemini-2.5-pro-preview-tts',
  'gemini-2.0-flash'
]


/**
 * Google Gemini LLM Provider implementation
 * Follows Single Responsibility Principle (SRP) - only handles Gemini interactions
 */
class GeminiProvider extends BaseLLMProvider {
  constructor() {
    super('gemini', {
      models: MODELS_TO_TRY,
      debugdir: path.join(process.cwd(), 'llm-debug-logs'),
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
    } catch (error) {
      throw new Error(`Failed to initialize Gemini client: ${error.message}`);
    }
  }

  /**
   * Writes debug information to a file
   * @param {string} model - Model used for generation
   * @param {string} responseText - Raw response from LLM
   * @param {string} prompt - Original prompt
   * @param {Object} options - Generation options
   * @param {Error|null} error - Optional error object
   */
  async writeDebugFile(model, responseText, prompt, options, error = null) {
    try {
      await fs.promises.mkdir(this.config.debugdir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const status = error ? 'error' : 'success';
      const filename = `gemini-${model}-${timestamp}-${status}.json`;
      const filePath = path.join(this.config.debugdir, filename);

      const debugData = {
        metadata: {
          timestamp: new Date().toISOString(),
          model,
          status,
          error: error ? error.message : null,
          stack: error ? error.stack : null
        },
        input: {
          prompt: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''), // Truncated prompt
          attachments: options.attachments ? options.attachments.map(a => a.filePath) : [],
          options: { ...options, attachments: undefined } // Don't include full attachment objects
        },
        output: {
          rawResponse: responseText,
        }
      };

      await fs.promises.writeFile(filePath, JSON.stringify(debugData, null, 2));
      console.debug(`[GeminiDebug] Wrote debug file: ${filename}`);
    } catch (writeError) {
      console.error('[GeminiDebug] Failed to write debug file:', writeError);
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
      return uploadResult;
    } catch (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Determines MIME type from file extension
   * @param {string} filePath
   * @returns {string}
   * @throws {Error} For unsupported types
   */
  getMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    const mimeType = SUPPORTED_FILE_TYPES.get(extension);

    if (!mimeType) {
      const supportedTypes = [...SUPPORTED_FILE_TYPES.keys()].join(', ');
      throw new Error(`${ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE} ${supportedTypes}`);
    }

    return mimeType;
  }

  /**
   * Processes attachments for Gemini API
   * @param {Array<{filePath: string, type: string}>} attachments
   * @returns {Promise<Array<{fileData: {mimeType: string, fileUri: string}}>>}
   */
  async processAttachments(attachments) {
    return Promise.all(
      attachments.map(async ({ filePath }) => {
        await this.validateFileExists(filePath);
        const mimeType = this.getMimeType(filePath);
        const { uri, mimeType: verifiedMimeType } = await this.uploadFile(filePath, mimeType);

        return {
          fileData: {
            mimeType: verifiedMimeType,
            fileUri: uri,
          },
        };
      })
    );
  }

  /**
   * Validates file existence
   * @param {string} filePath
   * @throws {Error} If file doesn't exist
   */
  async validateFileExists(filePath) {
    try {
      await fs.promises.access(filePath);
    } catch {
      throw new Error(`${ERROR_MESSAGES.FILE_NOT_FOUND} ${filePath}`);
    }
  }

  /**
   * Creates content payload for Gemini API
   * @param {string} prompt
   * @param {Array} attachments
   * @returns {Array} Content array
   */
  createContentPayload(prompt, attachments) {
    const parts = [{ text: prompt }];
    if (attachments.length > 0) {
      parts.push(...attachments);
    }
    return [{ parts }];
  }

  /**
    * Executes content generation with model fallback
    * @param {string} prompt
    * @param {Object} options
    * @returns {Promise<Array>} Generated questions
    * @throws {Error} When all models fail
    */
  async performGeneration(prompt, options = {}) {
    const { attachments = [] } = options;
    const processedAttachments = attachments.length
      ? await this.processAttachments(attachments)
      : [];

    for (const [index, model] of this.config.models.entries()) {
      try {
        const contents = this.createContentPayload(prompt, processedAttachments);
        const result = await this.client.models.generateContent({ model, contents });

        await this.writeDebugFile(model, result.text, prompt, options);

        return this.parseModelResponse(result.text, model);
      } catch (error) {
        this.handleModelError(error, model, index);
      }
    }

    throw new Error(`${ERROR_MESSAGES.MODEL_FAILURE} ${lastError.message}`);
  }

  /**
    * Parses and validates model response
    * @param {string} responseText
    * @param {string} modelName
    * @returns {Array}
    * @throws {SyntaxError} For invalid JSON
    */
  parseModelResponse(responseText, modelName) {
    const cleanText = JSONExtractor.extractJSONFromResponse(responseText, 'Gemini');
    const parsedQuestions = JSONExtractor.validateQuestionsStructure(cleanText);
    return parsedQuestions.questions;
  }

  /**
   * Handles model errors during generation
   * @param {Error} error
   * @param {string} model
   * @param {number} index
   */
  handleModelError(error, model, index) {
    if (error instanceof SyntaxError) {
      throw new Error(`${ERROR_MESSAGES.JSON_PARSE_FAILURE} ${error.message}`);
    }

    if (index === this.config.models.length - 1) {
      lastError = error;
      throw new Error(`${ERROR_MESSAGES.MODEL_FAILURE} ${error.message}`);
    }
  }

  /**
   * Tests API key validity
   * @returns {Promise<boolean>}
   * @throws {Error} When all models fail
   */
  async performApiKeyTest() {
    const testPrompt = 'Respond with exactly: "API_KEY_VALID"';

    for (const model of this.config.models) {
      try {
        const result = await this.client.models.generateContent({
          model,
          contents: [{ parts: [{ text: testPrompt }] }],
        });

        if (result.text.trim() === 'API_KEY_VALID') {
          return true;
        }
      } catch (error) {
        if (model === this.config.models[this.config.models.length - 1]) {
          throw new Error(`API key test failed: ${error.message}`);
        }
      }
    }

    return false;
  }
}

export default GeminiProvider;
