// Import stores
import { assessmentActions } from '../stores/assessment.js';
import { llmActions, aiGenerationActions } from '../stores/llm.js';

// Import proper non-browser services
import QTIExporter from '../qti-exporter.js';
import LaTeXRenderer from '../latex-renderer.js';
import LaTeXParser from './latex-parser.js';


class QTIGeneratorService {
  constructor() {
    // LLM service will be accessed via IPC - no direct instantiation needed
    this.qtiExporter = new QTIExporter();
    this.latexRenderer = new LaTeXRenderer();
    this.latexParser = new LaTeXParser();
    this.currentProvider = 'gemini';
    this.initialized = true;
  }

  async ensureInitialized() {
    return true; // Always initialized now
  }

  destroy() {
    // No cleanup needed for IPC-based services
  }

  // LLM Configuration
  async configureLLM(provider, apiKey) {
    try {
      console.log('🔧 Configuring LLM:', { provider, apiKey: apiKey ? '***masked***' : 'empty' });
      this.currentProvider = provider;

      // Configure LLM service via IPC
      const result = await window.electronAPI.configureLLM(provider, apiKey);
      console.log('🔧 LLM Configuration result:', result);

      if (result.success) {
        llmActions.updateConfig({
          provider,
          apiKey,
          isConfigured: true
        });
        console.log('✅ LLM configured successfully');
        return { success: true };
      } else {
        throw new Error(result.error || 'Fallo al configurar el proveedor de LLM');
      }
    } catch (error) {
      console.error('❌ LLM configuration failed:', error);
      llmActions.setError(error.message);
      return { success: false, error: error.message };
    }
  }

  // PDF Processing
  async processPDF(file) {
    try {
      aiGenerationActions.setExtracting(true, 0);

      // Convert file to ArrayBuffer for IPC transfer
      const arrayBuffer = await file.arrayBuffer();

      // Update progress
      aiGenerationActions.setExtracting(true, 25);

      // Extract text using existing PDF extraction logic (pass ArrayBuffer directly)
      const extractedText = await this.extractPDFText(arrayBuffer);

      // Update progress
      aiGenerationActions.setExtracting(true, 100);

      // Update store with extracted text
      aiGenerationActions.updateParams({ contextText: extractedText });

      // Clear extraction state
      setTimeout(() => {
        aiGenerationActions.setExtracting(false, 0);
      }, 500);

      return { success: true, text: extractedText };
    } catch (error) {
      aiGenerationActions.setExtracting(false, 0);
      throw error;
    }
  }

  async extractPDFText(arrayBuffer) {
    const result = await window.electronAPI.extractText(arrayBuffer);
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  }

  /**
   * Generates assessment questions based on provided parameters.
   * Handles LaTeX file parsing and AI question generation.
   * @param {Object} params Generation parameters
   * @return {Promise<{success: boolean, questions?: Array, error?: string}>} Result object
   */
  async generateQuestions(params) {
    console.log('🤖 Starting question generation with params:', params);
    llmActions.setGenerating(true);
    llmActions.clearError();

    try {
      const {
        contextText,
        // questionCount,
        // difficultyLevel,
        // questionTypes,
        // includeMath,
        attachments = [],
        useAttachmentOnly = false,
        useAI = true
      } = params;

      const generatedQuestions = await this.processAttachments(
        attachments,
        params,
        useAI
      );

      const aiGeneratedQuestions = useAttachmentOnly ? [] : await this.generateAIBasedQuestions(
        contextText,
        attachments,
        params,
        useAI
      );
      generatedQuestions.push(...aiGeneratedQuestions);

      this.validateQuestionCount(generatedQuestions);
      this.addQuestionsToAssessment(generatedQuestions);

      return { success: true, questions: generatedQuestions };
    } catch (error) {
      console.error('❌ Question generation failed:', error);
      llmActions.setError(error.message);
      return { success: false, error: error.message };
    } finally {
      llmActions.setGenerating(false);
    }
  }

  // Helper methods ------------------------------------------------------------

  /**
   * Processes LaTeX attachments to generate questions.
   * @private
   */
  async processLatexFile(latexFile, params, useAI) {
    console.log('📝 Processing LaTeX file:', latexFile.name);

    if (useAI) {
      return this.processLatexWithAI(latexFile, params);
    }
    return this.processLatexWithoutAI(latexFile);
  }

  /**
   * Processes LaTeX file using AI-enhanced parsing.
   * @private
   */
  async processLatexWithAI(latexFile, params) {
    console.log('🤖 Using AI for LaTeX parsing');
    const fileContent = await window.electronAPI.readFile(latexFile.path);
    const parsedQuestions = await this.latexParser.parseLatexFile(fileContent, true);

    console.log(`📚 Parsed ${parsedQuestions.length} questions from ${latexFile.name} with AI`);

    await this.generateAIAnswersForQuestions(
      parsedQuestions.filter(q => q.needsAIGeneration),
      params
    );

    return parsedQuestions;
  }

  /**
   * Processes LaTeX file without AI assistance.
   * @private
   */
  async processLatexWithoutAI(latexFile) {
    console.log(`📝 Parsing ${latexFile.name} without AI...`);
    const result = await window.electronAPI.parseLatexQuestions(latexFile.path);

    if (!result.success) {
      throw new Error(result.error || 'LaTeX parsing failed');
    }

    console.log(`📚 Parsed ${result.questions.length} questions from ${latexFile.name}`);
    return result.questions;
  }

  /**
   * Generates AI answers for questions requiring augmentation.
   * @private
   */
  async generateAIAnswersForQuestions(questions, params) {
    if (!questions.length) return;

    console.log('🤖 Generating AI answers for LaTeX questions...');

    for (const question of questions) {
      try {
        const aiResult = await window.electronAPI.generateQuestionAnswers(
          question.text,
          {
            questionType: question.type,
            difficulty: params.difficultyLevel,
            includeMath: params.includeMath
          }
        );

        if (aiResult.success && aiResult.question) {
          Object.assign(question, aiResult.question, {
            id: question.id, // Preserve original ID
            text: question.text, // Preserve original text
            source: 'latex_parser_ai'
          });
        }
      } catch (aiError) {
        console.warn(`⚠️ AI generation failed: ${aiError.message}`);
      } finally {
        delete question.needsAIGeneration;
      }
    }
  }

  /**
   * Processes all attachments and returns generated questions.
   * @private
   */
  async processAttachments(attachments, params, useAI) {
    if (!attachments.length) return [];

    const generatedQuestions = [];
    const latexFiles = attachments.filter(file => file.type === 'tex');

    for (const latexFile of latexFiles) {
      try {
        const questions = await this.processLatexFile(latexFile, params, useAI);
        generatedQuestions.push(...questions);
      } catch (error) {
        console.error(`❌ LaTeX processing failed for ${latexFile.name}: ${error.message}`);
      }
    }

    return generatedQuestions;
  }

  /**
   * Generates AI-based questions from context and non-LaTeX attachments.
   * @private
   */
  async generateAIBasedQuestions(contextText, attachments, params, useAI) {
    if (!useAI) return [];

    const nonLatexAttachments = attachments.filter(file => file.type !== 'tex');
    const hasValidInput = contextText || nonLatexAttachments.length > 0;

    if (!hasValidInput) return [];

    const result = await window.electronAPI.generateQuestions(
      contextText,
      {
        questionCount: params.questionCount,
        difficulty: params.difficultyLevel,
        questionTypes: params.questionTypes,
        includeMath: params.includeMath,
        attachments: nonLatexAttachments
      }
    );

    if (!result.success) {
      throw new Error(result.error || 'AI question generation failed');
    }

    return result.questions;
  }

  /**
   * Validates at least one question was generated.
   * @throws {Error} If no questions generated
   * @private
   */
  validateQuestionCount(questions) {
    if (questions.length === 0) {
      throw new Error('No questions generated. Check LaTeX format or enable AI.');
    }
  }

  /**
   * Adds questions to assessment store.
   * @private
   */
  addQuestionsToAssessment(questions) {
    questions.forEach(question => {
      console.log('➕ Adding question:', question.id);
      assessmentActions.addQuestion(question);
    });
  }

  // Assessment Operations
  newAssessment() {
    assessmentActions.clearAssessment();
  }

  async saveAssessment(assessment) {
    try {
      // Use Electron's file system to save
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.saveAssessment(assessment);
        return result;
      }

      // Fallback: download as JSON
      this.downloadAsJSON(assessment, 'assessment.json');
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to save assessment: ${error.message}`);
    }
  }

  async exportQTI(assessment) {
    try {
      // Generate QTI XML
      const qtiXML = this.qtiExporter.generateQTI(assessment);

      // Validate the XML
      const validation = this.qtiExporter.validateXML(qtiXML);
      if (!validation.isValid) {
        throw new Error(`Invalid QTI XML: ${validation.errors.join(', ')}`);
      }

      // Save or download the QTI file
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.exportQTI(qtiXML);
        return result;
      }

      // Fallback: download as XML
      this.downloadAsFile(qtiXML, 'assessment.xml', 'application/xml');
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to export QTI: ${error.message}`);
    }
  }

  // Utility methods
  downloadAsJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, filename);
  }

  downloadAsFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // LaTeX rendering
  renderMath(text) {
    return this.latexRenderer.renderMath(text);
  }

  previewMath(inputText, previewElement) {
    return this.latexRenderer.previewMath(inputText, previewElement);
  }
}

// Create singleton instance
export const qtiGenerator = new QTIGeneratorService();
