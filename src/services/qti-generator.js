// Import stores
import { assessmentActions } from '../stores/assessment.js';
import { llmActions, aiGenerationActions } from '../stores/llm.js';

// Import the real browser LLM service
import { BrowserLLMService } from './browser-llm-service.js';

// Browser-compatible LaTeX renderer
class BrowserLaTeXRenderer {
  renderMath(text) {
    if (!text) return '';

    // Regex to find LaTeX math: inline ($...$) or display ($...$)
    const latexRegex = /(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g;
    let lastIndex = 0;
    let html = '';

    text.replace(latexRegex, (match, latex, offset) => {
      // Add preceding non-LaTeX text
      html += text.substring(lastIndex, offset);

      const isDisplayMode = latex.startsWith('$') && latex.endsWith('$');
      const latexContent = latex.substring(isDisplayMode ? 2 : 1, latex.length - (isDisplayMode ? 2 : 1)).trim();
      
      // Generate a simple hash for the src attribute (in a real app, this would be a server-generated image URL)
      const srcHash = btoa(latexContent).substring(0, 16); 
      const imageUrl = `https://aulavirtual.espol.edu.ec/equation_images/${srcHash}`; // Placeholder URL

      const style = isDisplayMode ? 'display: block; margin-left: auto; margin-right: auto;' : '';
      const cls = 'equation_image';
      const title = this._escapeHtmlAttribute(latexContent);
      const alt = `LaTeX: ${this._escapeHtmlAttribute(latexContent)}`;
      const dataEquationContent = this._escapeHtmlAttribute(latexContent);

      html += `<img class="${cls}" style="${style}" title="${title}" src="${imageUrl}" alt="${alt}" data-equation-content="${dataEquationContent}">`;
      
      lastIndex = offset + match.length;
      return match; // Return match to satisfy replace callback, but we build html separately
    });

    html += text.substring(lastIndex); // Add any remaining text after the last LaTeX
    return html;
  }

  _escapeHtmlAttribute(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  
  previewMath(inputText, previewElement) {
    if (previewElement) {
      previewElement.textContent = inputText;
    }
  }
}

// Browser-compatible QTI exporter
class BrowserQTIExporter {
  generateQTI(assessment) {
    const assessmentId = this.generateId();
    const timestamp = new Date().toISOString();
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="${assessmentId}" title="${this.escapeXML(assessment.title)}">
    <qtimetadata>
      <qtimetadatafield>
        <fieldlabel>qmd_timelimit</fieldlabel>
        <fieldentry>${assessment.timeLimit || 0}</fieldentry>
      </qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
      ${assessment.questions.map((question, index) => this.generateQuestionXML(question, index)).join('\n')}
    </section>
  </assessment>
</questestinterop>`;
    
    return xml;
  }

  generateQuestionXML(question, index) {
    const questionId = this.generateId();
    
    return `<item ident="${questionId}" title="Pregunta ${index + 1}">
      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield>
            <fieldlabel>question_type</fieldlabel>
            <fieldentry>${question.type}</fieldentry>
          </qtimetadatafield>
          <qtimetadatafield>
            <fieldlabel>points_possible</fieldlabel>
            <fieldentry>${question.points || 1}</fieldentry>
          </qtimetadatafield>
        </qtimetadata>
      </itemmetadata>
      <presentation>
        <material>
          <mattext texttype="text/html">&lt;div&gt;${this.escapeXML(this.latexRenderer.renderMath(question.text))}&lt;/div&gt;</mattext>
        </material>
        ${this.generateResponseXML(question)}
      </presentation>
      ${this.generateProcessingXML(question)}
    </item>`;
  }

  generateResponseXML(question) {
    if (question.type === 'multiple_choice') {
      return `<response_lid ident="response1" rcardinality="Single">
        <render_choice>
          ${question.choices.map((choice, index) => `
            <response_label ident="${index}">
              <material>
                <mattext texttype="text/html">&lt;p&gt;${this.escapeXML(this.latexRenderer.renderMath(choice.text))}&lt;/p&gt;</mattext>
              </material>
            </response_label>
          `).join('')}
        </render_choice>
      </response_lid>`;
    }
    return '';
  }

  generateProcessingXML(question) {
    if (question.type === 'multiple_choice') {
      const correctIndex = question.choices.findIndex(choice => choice.correct);
      return `<resprocessing>
        <outcomes>
          <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
        </outcomes>
        <respcondition continue="No">
          <conditionvar>
            <varequal respident="response1">${correctIndex}</varequal>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>
        </respcondition>
      </resprocessing>`;
    }
    return '';
  }

  generateId() {
    return 'g' + Math.random().toString(36).substr(2, 16);
  }

  escapeXML(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  validateXML(xml) {
    // Basic validation - just check if it's well-formed
    try {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');
        const errors = doc.getElementsByTagName('parsererror');
        return {
          isValid: errors.length === 0,
          errors: Array.from(errors).map(e => e.textContent)
        };
      }
      return { isValid: true, errors: [] };
    } catch (error) {
      return { isValid: false, errors: [error.message] };
    }
  }
}

// Browser-compatible PDF extractor
class BrowserPDFExtractor {
  async extractText(buffer) {
    // For demo purposes, return placeholder text
    // In a real implementation, you'd use PDF.js
    return "Texto extraído del PDF de ejemplo. Esta es una funcionalidad de demostración.";
  }
}

// The real LLM service is now imported from browser-llm-service.js

class QTIGeneratorService {
  constructor() {
    this.llmService = new BrowserLLMService();
    this.qtiExporter = new BrowserQTIExporter();
    this.latexRenderer = new BrowserLaTeXRenderer();
    this.pdfExtractor = new BrowserPDFExtractor();
    this.currentProvider = 'gemini';
    this.initialized = true;
    
    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.destroy();
      });
    }
  }
  
  async ensureInitialized() {
    return true; // Always initialized now
  }
  
  destroy() {
    if (this.llmService) {
      this.llmService.destroy();
    }
  }
  
  // LLM Configuration
  async configureLLM(provider, apiKey) {
    try {
      console.log('🔧 Configuring LLM:', { provider, apiKey: apiKey ? '***masked***' : 'empty' });
      this.currentProvider = provider;
      
      // Configure the LLM service
      const success = await this.llmService.configure(provider, apiKey);
      console.log('🔧 LLM Configuration result:', success);
      
      if (success) {
        llmActions.updateConfig({
          provider,
          apiKey,
          isConfigured: true
        });
        console.log('✅ LLM configured successfully');
        return { success: true };
      } else {
        throw new Error('Fallo al configurar el proveedor de LLM');
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
    // Use the PDF extractor instance
    const result = await this.pdfExtractor.extractText(buffer);
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
        includeMath
      } = params;
      
      console.log('🔧 LLM Service configured:', this.llmService.isConfigured);
      
      // Use the existing LLM service to generate questions
      const generatedQuestions = await this.llmService.generateQuestions({
        contextText,
        questionCount,
        difficultyLevel,
        questionTypes,
        includeMath
      });
      
      console.log('✅ Generated questions:', generatedQuestions);
      
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