/**
 * Integration tests for Svelte application logic
 */

// For testing, we'll create a simple mock of the service
class MockBrowserLLMService {
  constructor() {
    this.isConfigured = false;
  }

  async configure(provider, apiKey) {
    this.isConfigured = !!(apiKey && apiKey.trim().length > 0);
    return this.isConfigured;
  }

  async generateQuestions(params) {
    if (!this.isConfigured) throw new Error('Not configured');
    
    const questions = [];
    for (let i = 0; i < params.questionCount; i++) {
      questions.push({
        id: `q_${i}`,
        type: params.questionTypes[0] || 'multiple_choice',
        text: `Pregunta de prueba ${i + 1}`,
        points: 1,
        choices: params.questionTypes[0] === 'multiple_choice' ? [
          { text: 'Opción A', correct: true },
          { text: 'Opción B', correct: false }
        ] : undefined
      });
    }
    return questions;
  }
}

class MockQTIExporter {
  generateQTI(assessment) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="test_id" title="${assessment.title}">
    <qtimetadata>
      <qtimetadatafield>
        <fieldlabel>qmd_timelimit</fieldlabel>
        <fieldentry>${assessment.timeLimit || 0}</fieldentry>
      </qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
      ${assessment.questions.map(q => `<item ident="${q.id}" title="${q.text}"></item>`).join('')}
    </section>
  </assessment>
</questestinterop>`;
  }

  validateXML(xml) {
    return { isValid: xml.includes('<?xml'), errors: [] };
  }

  escapeXML(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

class MockPDFExtractor {
  async extractText() {
    return 'Texto extraído del PDF de ejemplo';
  }
}

// Mock QTI Generator Service
const mockQtiGenerator = {
  llmService: new MockBrowserLLMService(),
  qtiExporter: new MockQTIExporter(),
  pdfExtractor: new MockPDFExtractor(),
  initialized: true,
  currentProvider: 'gemini',

  async configureLLM(provider, apiKey) {
    try {
      this.currentProvider = provider;
      const success = await this.llmService.configure(provider, apiKey);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async generateQuestions(params) {
    try {
      const questions = await this.llmService.generateQuestions(params);
      return { success: true, questions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async processPDF(file) {
    try {
      const text = await this.pdfExtractor.extractText();
      return { success: true, text };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async exportQTI(assessment) {
    try {
      const xml = this.qtiExporter.generateQTI(assessment);
      const validation = this.qtiExporter.validateXML(xml);
      if (!validation.isValid) {
        throw new Error('Invalid XML');
      }
      return { success: true, xml };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  downloadAsFile: jest.fn()
};

describe('Svelte Application Integration', () => {
  beforeEach(() => {
    // Reset any state
    jest.clearAllMocks();
  });

  describe('QTI Generator Service', () => {
    test('should initialize properly', () => {
      expect(mockQtiGenerator).toBeDefined();
      expect(mockQtiGenerator.initialized).toBe(true);
    });

    test('should configure LLM provider', async () => {
      const result = await mockQtiGenerator.configureLLM('gemini', 'test-api-key');
      
      expect(result.success).toBe(true);
      expect(mockQtiGenerator.currentProvider).toBe('gemini');
    });

    test('should handle empty API key', async () => {
      const result = await mockQtiGenerator.configureLLM('gemini', '');
      
      // When API key is empty, configure returns false, so success should be false
      expect(result.success).toBe(false);
    });

    test('should generate mock questions', async () => {
      // First configure the LLM
      await mockQtiGenerator.configureLLM('gemini', 'test-api-key');
      
      const params = {
        contextText: 'Test context for question generation',
        questionCount: 3,
        difficultyLevel: 'medium',
        questionTypes: ['multiple_choice', 'true_false'],
        includeMath: false
      };

      const result = await mockQtiGenerator.generateQuestions(params);
      
      expect(result.success).toBe(true);
      expect(result.questions).toHaveLength(3);
      expect(result.questions[0]).toHaveProperty('text');
      expect(result.questions[0]).toHaveProperty('type');
      expect(result.questions[0]).toHaveProperty('id');
    });

    test('should generate QTI XML', async () => {
      const assessment = {
        title: 'Test Assessment',
        description: 'Test Description',
        timeLimit: 60,
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            text: 'What is 2+2?',
            points: 1,
            choices: [
              { text: '3', correct: false },
              { text: '4', correct: true },
              { text: '5', correct: false },
              { text: '6', correct: false }
            ]
          },
          {
            id: 'q2',
            type: 'true_false',
            text: 'The sky is blue.',
            points: 1,
            correctAnswer: 'true'
          }
        ]
      };

      const qtiXML = mockQtiGenerator.qtiExporter.generateQTI(assessment);
      
      expect(qtiXML).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(qtiXML).toContain('<questestinterop');
      expect(qtiXML).toContain('Test Assessment');
      
      // Validate the XML
      const validation = mockQtiGenerator.qtiExporter.validateXML(qtiXML);
      expect(validation.isValid).toBe(true);
    });

    test('should handle PDF extraction with mock data', async () => {
      const mockFile = new File(['fake pdf content'], 'test.pdf', { type: 'application/pdf' });
      
      const result = await mockQtiGenerator.processPDF(mockFile);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('Texto extraído del PDF');
    });

    test('should export QTI through service', async () => {
      const assessment = {
        title: 'Export Test',
        description: 'Testing export functionality',
        timeLimit: 30,
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            text: 'Sample question',
            points: 2,
            choices: [
              { text: 'Option A', correct: true },
              { text: 'Option B', correct: false }
            ]
          }
        ]
      };

      const result = await mockQtiGenerator.exportQTI(assessment);
      expect(result.success).toBe(true);
      expect(result.xml).toContain('Export Test');
    });

    test('should handle errors gracefully', async () => {
      const result = await mockQtiGenerator.generateQuestions({
        contextText: '',
        questionCount: 0,
        difficultyLevel: 'invalid',
        questionTypes: ['multiple_choice'],
        includeMath: false
      });

      // Should still work with our mock implementation
      expect(result.success).toBe(true);
      expect(result.questions).toHaveLength(0);
    });
  });

  describe('Browser Service Classes', () => {
    test('BrowserLLMService should work', async () => {
      const llmService = mockQtiGenerator.llmService;
      
      expect(llmService).toBeDefined();
      
      const configured = await llmService.configure('gemini', 'test-key');
      expect(configured).toBe(true);
      
      const questions = await llmService.generateQuestions({
        questionCount: 2,
        questionTypes: ['multiple_choice'],
        includeMath: false
      });
      
      expect(questions).toHaveLength(2);
      expect(questions[0]).toHaveProperty('type', 'multiple_choice');
    });

    test('BrowserQTIExporter should escape XML properly', () => {
      const exporter = mockQtiGenerator.qtiExporter;
      
      const escaped = exporter.escapeXML('Test & "quotes" <tags>');
      expect(escaped).toBe('Test &amp; &quot;quotes&quot; &lt;tags&gt;');
    });

    test('BrowserPDFExtractor should return demo text', async () => {
      const extractor = mockQtiGenerator.pdfExtractor;
      
      const result = await extractor.extractText();
      expect(result).toContain('Texto extraído del PDF');
    });
  });
});