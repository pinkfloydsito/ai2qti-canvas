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

  // Question Generation
  async generateQuestions(params) {
    try {
      console.log('🤖 Starting question generation with params:', params);
      llmActions.setGenerating(true);
      llmActions.clearError();

      const {
        contextText,
        questionCount,
        difficultyLevel,
        questionTypes,
        includeMath,
        attachments = [],
        useAI = true
      } = params;

      console.log('🔧 Generating questions via IPC');
      if (attachments.length > 0) {
        console.log('📎 Including attachments:', attachments.map(f => f.name).join(', '));
      }

      let generatedQuestions = [];

      // Check if we have LaTeX files to parse
      const latexFiles = attachments.filter(file => file.type === 'tex');

      if (latexFiles.length > 0) {
        console.log('📝 Processing LaTeX files:', latexFiles.map(f => f.name).join(', '));

        // Parse LaTeX files first
        for (const latexFile of latexFiles) {
          try {
            let parsedQuestions;

            if (useAI) {
              console.log("using AI for LaTeX parsing");
              // Use AI-enhanced parsing (read file and parse in renderer)
              const fileContent = await window.electronAPI.readFile(latexFile.path);
              parsedQuestions = await this.latexParser.parseLatexFile(fileContent, useAI);
              console.log(`📚 Parsed ${parsedQuestions.length} questions from ${latexFile.name} with AI parsing`);

              if (parsedQuestions.some(q => q.needsAIGeneration)) {
                // Generate AI answers for questions that need them
                console.log('🤖 Generating AI answers for LaTeX questions...');
                const questionsNeedingAI = parsedQuestions.filter(q => q.needsAIGeneration);

                for (const question of questionsNeedingAI) {
                  try {
                    const aiResult = await window.electronAPI.generateQuestionAnswers(question.text, {
                      questionType: question.type,
                      difficulty: difficultyLevel,
                      includeMath
                    });

                    if (aiResult.success && aiResult.question) {
                      // Merge AI-generated answers with parsed question
                      Object.assign(question, aiResult.question, {
                        id: question.id, // Keep original ID
                        text: question.text, // Keep original text
                        source: 'latex_parser_ai'
                      });
                      delete question.needsAIGeneration;
                    }
                  } catch (aiError) {
                    console.warn(`⚠️ AI generation failed for question ${question.id}:`, aiError.message);
                    // Keep the question without AI-generated answers
                    delete question.needsAIGeneration;
                  }
                }
              }
            } else {
              console.log(`📝 Parsing LaTeX file ${latexFile.name} without AI...`);
              const result = await window.electronAPI.parseLatexQuestions(latexFile.path);

              if (!result.success) {
                throw new Error(result.error || 'Failed to parse LaTeX file');
              }

              parsedQuestions = result.questions;
              console.log(`📚 Parsed ${parsedQuestions.length} questions from ${latexFile.name} without AI`);
            }

            generatedQuestions.push(...parsedQuestions);
          } catch (parseError) {
            console.error(`❌ Failed to parse LaTeX file ${latexFile.name}:`, parseError.message);
            // Continue with other files
          }
        }
      }

      // If we have non-LaTeX files or contextText, use the regular LLM generation
      const nonLatexAttachments = attachments.filter(file => file.type !== 'tex');
      if (contextText || nonLatexAttachments.length > 0) {
        const result = await window.electronAPI.generateQuestions(contextText, {
          questionCount,
          difficulty: difficultyLevel,
          questionTypes,
          includeMath,
          attachments: nonLatexAttachments
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to generate questions');
        }

        generatedQuestions.push(...result.questions);
      }

      console.log('✅ Generated questions:', generatedQuestions);

      // Check if we actually generated any questions
      if (generatedQuestions.length === 0) {
        throw new Error('No questions were generated. Please check your LaTeX file format or try with AI enabled.');
      }

      // Add generated questions to assessment
      generatedQuestions.forEach(question => {
        console.log('➕ Adding question:', question);
        assessmentActions.addQuestion(question);
      });

      llmActions.setGenerating(false);

      return { success: true, questions: generatedQuestions };
    } catch (error) {
      console.error('❌ Question generation failed:', error);
      llmActions.setError(error.message);
      llmActions.setGenerating(false);
      return { success: false, error: error.message };
    }
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
