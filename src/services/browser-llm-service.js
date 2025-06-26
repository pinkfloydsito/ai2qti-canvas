/**
 * Browser-compatible LLM Service that calls real LLM providers
 * Converted from CommonJS to ES modules for Svelte compatibility
 */

// Browser-compatible Gemini Provider
class BrowserGeminiProvider {
  constructor() {
    this.apiKey = null;
    this.client = null;
    this.name = 'gemini';
    this.models = [
      'gemini-2.5-flash',
      'gemini-2.0-flash', 
      'gemini-2.5-pro-preview-tts'
    ];
  }

  async configure(apiKey) {
    this.apiKey = apiKey;
    if (typeof window !== 'undefined') {
      // In browser, we'll use dynamic import
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        this.client = new GoogleGenerativeAI(apiKey);
        console.log('✅ Gemini client initialized successfully');
        return true;
      } catch (error) {
        console.error('❌ Failed to initialize Gemini client:', error);
        return false;
      }
    }
    return false;
  }

  async testApiKey() {
    if (!this.client) return false;
    
    try {
      const model = this.client.getGenerativeModel({ model: this.models[0] });
      const result = await model.generateContent('Test');
      return !!result;
    } catch (error) {
      console.error('❌ Gemini API key test failed:', error);
      return false;
    }
  }

  async generateQuestions(context, options) {
    if (!this.client) {
      throw new Error('Gemini client not configured');
    }

    const prompt = this.buildPrompt(context, options);
    console.log('🤖 Gemini: Generated prompt:', prompt);

    for (const modelName of this.models) {
      try {
        console.log(`🤖 Gemini: Trying model ${modelName}`);
        const model = this.client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        console.log('🤖 Gemini: Raw response:', text);
        return this.parseResponse(text);
      } catch (error) {
        console.error(`❌ Gemini: Model ${modelName} failed:`, error);
        continue;
      }
    }
    
    throw new Error('All Gemini models failed');
  }

  buildPrompt(context, options) {
    const { questionCount, difficultyLevel, questionTypes, includeMath } = options;
    
    const mathInstruction = includeMath
      ? "Use LaTeX notation for mathematical expressions. Use double backslashes for LaTeX commands in JSON."
      : "Avoid complex mathematical notation.";

    const typeDescriptions = questionTypes.map(type => {
      switch (type) {
        case 'multiple_choice': return 'Multiple choice (4 options, only one correct)';
        case 'true_false': return 'True/False questions';
        case 'short_answer': return 'Short answer questions';
        case 'essay': return 'Essay questions';
        default: return type;
      }
    }).join(', ');

    return `Generate ${questionCount} questions based on the following content. 
Difficulty: ${difficultyLevel}. 
Question types: ${typeDescriptions}.
${mathInstruction}

Content:
${context}

Generate questions in this EXACT JSON format:
{
  "questions": [
    {
      "type": "multiple_choice",
      "text": "Question text here",
      "choices": [
        {"text": "Option A", "correct": true},
        {"text": "Option B", "correct": false},
        {"text": "Option C", "correct": false},
        {"text": "Option D", "correct": false}
      ],
      "points": 1,
      "explanation": "Why this answer is correct"
    }
  ]
}

For true_false questions, use: "correctAnswer": "true" or "false" instead of choices.
For short_answer and essay questions, omit choices and correctAnswer.
Ensure all JSON is properly formatted and valid.`;
  }

  parseResponse(text) {
    try {
      // Extract JSON from markdown code blocks if present
      let jsonText = text;
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      // Clean up any extra text before/after JSON
      const jsonStart = jsonText.indexOf('{');
      const jsonEnd = jsonText.lastIndexOf('}') + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonText = jsonText.substring(jsonStart, jsonEnd);
      }

      const parsed = JSON.parse(jsonText);
      
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed.questions.map(q => ({
          ...q,
          id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }));
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      console.error('❌ Failed to parse Gemini response:', error);
      console.error('Raw text:', text);
      
      // Fallback: create mock questions based on the context
      return this.createFallbackQuestions(options);
    }
  }

  createFallbackQuestions(options) {
    const { questionCount, questionTypes } = options;
    const questions = [];
    
    for (let i = 0; i < questionCount; i++) {
      const type = questionTypes[i % questionTypes.length];
      const question = {
        id: `q_fallback_${Date.now()}_${i}`,
        type,
        text: `Pregunta generada automáticamente ${i + 1} (fallo de análisis de respuesta)`,
        points: type === 'essay' ? 5 : 1
      };

      if (type === 'multiple_choice') {
        question.choices = [
          { text: 'Opción A', correct: true },
          { text: 'Opción B', correct: false },
          { text: 'Opción C', correct: false },
          { text: 'Opción D', correct: false }
        ];
      } else if (type === 'true_false') {
        question.correctAnswer = 'true';
      }

      questions.push(question);
    }
    
    return questions;
  }
}

// Browser-compatible Mistral Provider (simplified for now)
class BrowserMistralProvider {
  constructor() {
    this.apiKey = null;
    this.name = 'mistral';
  }

  async configure(apiKey) {
    this.apiKey = apiKey;
    return true; // Simple validation for now
  }

  async testApiKey() {
    return !!this.apiKey;
  }

  async generateQuestions(context, options) {
    // For now, return mock questions - can be enhanced with real Mistral API calls
    console.log('🤖 Mistral: Generating mock questions (real API implementation needed)');
    return this.createMockQuestions(options);
  }

  createMockQuestions(options) {
    const { questionCount, questionTypes } = options;
    const questions = [];
    
    for (let i = 0; i < questionCount; i++) {
      const type = questionTypes[i % questionTypes.length];
      questions.push({
        id: `q_mistral_${Date.now()}_${i}`,
        type,
        text: `Pregunta de Mistral ${i + 1}`,
        points: type === 'essay' ? 5 : 1,
        choices: type === 'multiple_choice' ? [
          { text: 'Opción A', correct: true },
          { text: 'Opción B', correct: false },
          { text: 'Opción C', correct: false },
          { text: 'Opción D', correct: false }
        ] : undefined,
        correctAnswer: type === 'true_false' ? 'true' : undefined
      });
    }
    
    return questions;
  }
}

// Main Browser LLM Service
export class BrowserLLMService {
  constructor() {
    this.providers = {
      gemini: new BrowserGeminiProvider(),
      mistral: new BrowserMistralProvider()
    };
    this.currentProvider = null;
    this.providerName = null;
    this.isConfigured = false;
  }

  async configure(providerName, apiKey) {
    try {
      console.log(`🔧 Configuring ${providerName} provider`);
      
      if (!this.providers[providerName]) {
        throw new Error(`Provider ${providerName} not supported`);
      }

      this.currentProvider = this.providers[providerName];
      this.providerName = providerName;
      
      const success = await this.currentProvider.configure(apiKey);
      
      if (success) {
        // Test the API key
        const keyValid = await this.currentProvider.testApiKey();
        this.isConfigured = keyValid;
        
        console.log(`✅ ${providerName} provider configured:`, { configured: success, keyValid, isConfigured: this.isConfigured });
        return keyValid;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Failed to configure ${providerName}:`, error);
      this.isConfigured = false;
      return false;
    }
  }

  async generateQuestions(params) {
    if (!this.isConfigured || !this.currentProvider) {
      throw new Error('LLM service not configured');
    }

    const { contextText, questionCount, difficultyLevel, questionTypes, includeMath } = params;
    
    console.log(`🤖 Generating ${questionCount} questions using ${this.providerName}`);
    
    try {
      const questions = await this.currentProvider.generateQuestions(contextText, {
        questionCount,
        difficultyLevel,
        questionTypes,
        includeMath
      });
      
      console.log(`✅ Generated ${questions.length} questions successfully`);
      return questions;
    } catch (error) {
      console.error(`❌ Question generation failed with ${this.providerName}:`, error);
      throw error;
    }
  }

  destroy() {
    this.currentProvider = null;
    this.isConfigured = false;
  }
}

export default BrowserLLMService;