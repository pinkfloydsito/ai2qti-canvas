// Import stores
import { assessmentActions } from '../stores/assessment.js';
import { llmActions, aiGenerationActions } from '../stores/llm.js';

// Import existing services - use dynamic imports for Node.js modules
let LLMService, QTIExporter, LaTeXRenderer, LocalizationManager, PDFExtractor;

async function loadNodeModules() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    // In Electron renderer process, we'll need to communicate with main process
    // For now, create placeholder classes
    return {
      LLMService: class { async configure() { return true; } async generateQuestions() { return []; } destroy() {} },
      QTIExporter: class { generateQTI() { return ''; } validateXML() { return { isValid: true, errors: [] }; } },
      LaTeXRenderer: class { renderMath(text) { return text; } previewMath() {} },
      LocalizationManager: class { init() {} },
      PDFExtractor: class { async extractText() { return ''; } }
    };
  } else {
    // In Node.js environment (tests, etc.)
    const modules = await Promise.all([
      import('../llm-service-v2.js'),
      import('../qti-exporter.js'),
      import('../latex-renderer.js'),
      import('../localization/localization.js'),
      import('../pdf-extractor.js')
    ]);
    
    return {
      LLMService: modules[0].default,
      QTIExporter: modules[1].default,
      LaTeXRenderer: modules[2].default,
      LocalizationManager: modules[3].default,
      PDFExtractor: modules[4].default
    };
  }
}

class QTIGeneratorService {
  constructor() {
    this.llmService = null;
    this.qtiExporter = null;
    this.latexRenderer = null;
    this.localization = null;
    this.currentProvider = 'gemini';
    this.initialized = false;
    
    // Initialize asynchronously
    this.init();
    
    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.destroy();
      });
    }
  }
  
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }
  
  async init() {
    try {
      const modules = await loadNodeModules();
      
      this.llmService = new modules.LLMService();
      this.qtiExporter = new modules.QTIExporter();
      this.latexRenderer = new modules.LaTeXRenderer();
      this.localization = new modules.LocalizationManager();
      
      // Initialize localization
      setTimeout(() => {
        this.localization.init();
      }, 100);
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize QTI Generator service:', error);
    }
  }
  
  destroy() {
    if (this.llmService) {
      this.llmService.destroy();
    }
  }
  
  // LLM Configuration
  async configureLLM(provider, apiKey) {
    try {
      await this.ensureInitialized();
      this.currentProvider = provider;
      
      // Configure the LLM service
      const success = await this.llmService.configure(provider, apiKey);
      
      if (success) {
        llmActions.updateConfig({
          provider,
          apiKey,
          isConfigured: true
        });
        return { success: true };
      } else {
        throw new Error('Failed to configure LLM provider');
      }
    } catch (error) {
      llmActions.setError(error.message);
      return { success: false, error: error.message };
    }
  }
  
  // PDF Processing
  async processPDF(file) {
    try {
      aiGenerationActions.setExtracting(true, 0);
      
      // Convert file to buffer for processing
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Update progress
      aiGenerationActions.setExtracting(true, 25);
      
      // Extract text using existing PDF extraction logic
      const extractedText = await this.extractPDFText(buffer);
      
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
  
  async extractPDFText(buffer) {
    // Use the existing PDF extraction logic
    const PDFExtractor = require('../pdf-extractor');
    const pdfExtractor = new PDFExtractor();
    
    const result = await pdfExtractor.extractText(buffer);
    return result;
  }
  
  // Question Generation
  async generateQuestions(params) {
    try {
      llmActions.setGenerating(true);
      llmActions.clearError();
      
      const {
        contextText,
        questionCount,
        difficultyLevel,
        questionTypes,
        includeMath
      } = params;
      
      // Use the existing LLM service to generate questions
      const generatedQuestions = await this.llmService.generateQuestions({
        context: contextText,
        questionCount,
        difficulty: difficultyLevel,
        questionTypes,
        includeMath
      });
      
      // Add generated questions to assessment
      generatedQuestions.forEach(question => {
        assessmentActions.addQuestion(question);
      });
      
      llmActions.setGenerating(false);
      
      return { success: true, questions: generatedQuestions };
    } catch (error) {
      llmActions.setError(error.message);
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