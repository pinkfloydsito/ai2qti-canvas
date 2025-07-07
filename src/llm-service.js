const { GoogleGenerativeAI } = require('@google/generative-ai');
const ConfigManager = require('./config/config-manager');
const ApiKeyCache = require('./services/api-key-cache');

const GEMINI_MODELS = ['gemini-2.5-flash',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.0-flash',
  'gemini-2.5-pro-preview-tts',
  'gemini-2.0-flash'
]

class LLMService {
  constructor() {
    this.geminiClient = null;
    this.openaiClient = null;
    this.currentProvider = 'gemini';
    this.configManager = new ConfigManager();
    this.apiKeyCache = new ApiKeyCache(this.configManager);
  }

  async setProvider(provider, apiKey) {
    this.currentProvider = provider;

    // Check cache first if no API key provided
    if (!apiKey) {
      apiKey = this.apiKeyCache.getApiKey(provider);
      if (!apiKey) {
        throw new Error(`No API key provided and none cached for provider: ${provider}`);
      }
    }

    // Set up the client
    if (provider === 'gemini') {
      this.geminiClient = new GoogleGenerativeAI(apiKey);
    } else if (provider === 'openai') {
      // OpenAI client setup would go here
      this.openaiClient = { apiKey };
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    // Cache the API key if not already cached
    if (apiKey !== this.apiKeyCache.getApiKey(provider)) {
      await this.apiKeyCache.setApiKey(provider, apiKey, this.testApiKey.bind(this));
    }
  }

  async generateQuestions(context, options = {}) {
    const {
      questionCount = 5,
      difficulty = 'medium',
      questionTypes = ['multiple_choice'],
      includeMath = true
    } = options;

    const prompt = this.buildPrompt(context, {
      questionCount,
      difficulty,
      questionTypes,
      includeMath
    });

    try {
      if (this.currentProvider === 'gemini') {
        return await this.generateWithGemini(prompt);
      } else if (this.currentProvider === 'openai') {
        return await this.generateWithOpenAI(prompt);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      throw new Error(`Failed to generate questions: ${error.message}`);
    }
  }

  buildPrompt(context, options) {
    const { questionCount, difficulty, questionTypes, includeMath } = options;

    const mathInstruction = includeMath
      ? "Use LaTeX notation for mathematical expressions. IMPORTANT: Use double backslashes for LaTeX commands in JSON (e.g., $x^2 + 3x - 5 = 0$ for inline math, $$\\\\int_0^1 x^2 dx$$ for display math, $90^\\\\circ$ for degrees)."
      : "Avoid complex mathematical notation.";

    const questionTypesList = questionTypes.map(type => {
      switch (type) {
        case 'multiple_choice': return 'multiple choice (4 options)';
        case 'true_false': return 'true/false';
        case 'short_answer': return 'short answer';
        case 'essay': return 'essay';
        default: return type;
      }
    }).join(', ');

    return `
Based on the following content, generate ${questionCount} high-quality ${difficulty} level questions.

Content:
${context}

Instructions:
- Create questions of these types: ${questionTypesList}
- Difficulty level: ${difficulty}
- ${mathInstruction}
- For multiple choice questions, provide exactly 4 options with only one correct answer
- For true/false questions, provide the correct answer (true or false)
- For short answer questions, provide a sample correct answer
- For essay questions, provide grading criteria

Return the response as a valid JSON object with this exact structure:
{
  "questions": [
    {
      "type": "multiple_choice",
      "text": "Question text here",
      "points": 2,
      "choices": [
        {"id": 0, "text": "Option A"},
        {"id": 1, "text": "Option B"},
        {"id": 2, "text": "Option C"},
        {"id": 3, "text": "Option D"}
      ],
      "correctAnswer": 1,
      "explanation": "Why this answer is correct"
    },
    {
      "type": "true_false",
      "text": "True/false question text",
      "points": 1,
      "correctAnswer": "true",
      "explanation": "Explanation"
    },
    {
      "type": "short_answer",
      "text": "Short answer question text",
      "points": 3,
      "sampleAnswer": "Sample correct answer",
      "explanation": "Explanation"
    },
    {
      "type": "essay",
      "text": "Essay question text",
      "points": 10,
      "gradingRubric": "Grading criteria",
      "explanation": "What students should address"
    }
  ]
}

Important: 
- Return ONLY the JSON object, no additional text or formatting
- Use double backslashes (\\\\) for LaTeX commands in JSON strings
- Ensure all JSON is properly escaped and valid
        `;
  }

  async generateWithGemini(prompt) {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized. Please set API key.');
    }

    let lastError = null;
    
    // Try each model in sequence until one works
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const modelName = GEMINI_MODELS[i];
      
      try {
        console.info(`Attempting generation with model: ${modelName} (${i + 1}/${GEMINI_MODELS.length})`);
        
        const model = this.geminiClient.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        console.info(`✅ ${modelName} - Response received: ${text.length} characters`);

        // More robust JSON extraction
        const cleanText = this.extractJSONFromResponse(text);
        console.info(`✅ ${modelName} - JSON extraction successful`);

        const parsedQuestions = JSON.parse(cleanText);

        if (!parsedQuestions.questions || !Array.isArray(parsedQuestions.questions)) {
          throw new Error('Invalid response format from Gemini API');
        }

        console.info(`✅ ${modelName} - Successfully parsed ${parsedQuestions.questions.length} questions`);
        return this.validateAndProcessQuestions(parsedQuestions.questions);
        
      } catch (error) {
        lastError = error;
        console.warn(`❌ ${modelName} failed: ${error.message}`);
        
        // If this is the last model, we'll throw the error
        if (i === GEMINI_MODELS.length - 1) {
          console.error('🚨 All Gemini models failed. Throwing last error.');
          break;
        }
        
        // For other errors, continue to next model
        console.info(`⏭️  Trying next model...`);
        continue;
      }
    }
    
    // If we get here, all models failed
    console.error('💥 All Gemini models exhausted');
    if (lastError instanceof SyntaxError) {
      throw new Error(`Failed to parse LLM response as JSON (tried ${GEMINI_MODELS.length} models): ${lastError.message}`);
    }
    throw new Error(`All Gemini models failed (tried ${GEMINI_MODELS.length} models). Last error: ${lastError.message}`);
  }

  extractJSONFromResponse(text) {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\s*|\s*```/g, '');

    // Remove any text before the first { and after the last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object found in response');
    }

    cleaned = cleaned.substring(firstBrace, lastBrace + 1);

    // Fix LaTeX escape sequences that might be broken
    cleaned = cleaned
      .replace(/\\\\(\w+)/g, '\\\\$1') // Ensure double backslashes for LaTeX commands
      .replace(/([^\\])\\([a-zA-Z])/g, '$1\\\\$2') // Fix single backslashes before letters
      .replace(/\\\"/g, '\\\\"') // Fix escaped quotes
      .replace(/^\s*["']?json["']?\s*/, '') // Remove leading "json"
      .trim();

    // Validate that we can parse it
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch (error) {
      console.warn('Initial JSON parse failed, attempting repair...');

      // Try to repair common JSON issues
      const repaired = this.repairJSON(cleaned);

      // Test the repair
      try {
        JSON.parse(repaired);
        console.info('JSON repair successful');
        return repaired;
      } catch (repairError) {
        console.error('JSON repair failed:', repairError.message);
        throw new Error(`Invalid JSON format: ${error.message}`);
      }
    }
  }

  repairJSON(jsonStr) {
    let repaired = jsonStr;

    // Step 1: Fix LaTeX escape sequences systematically
    repaired = this.fixLatexEscapes(repaired);

    // Step 2: Fix other common JSON issues
    repaired = repaired
      // Fix line breaks within strings
      .replace(/\\n/g, '\\\\n')
      .replace(/\\t/g, '\\\\t')
      // Fix unescaped quotes (but not already escaped ones)
      .replace(/(?<!\\)\\(?!\\)/g, '\\\\')
      // Clean up multiple backslashes
      .replace(/\\\\+/g, '\\\\');

    return repaired;
  }

  fixLatexEscapes(text) {
    let fixed = text;

    // Handle different LaTeX contexts
    const latexPatterns = [
      // Math expressions with single $
      {
        pattern: /\$([^$]*?)\$/g,
        fix: (match, content) => {
          const fixedContent = this.escapeLatexInMath(content);
          return `$${fixedContent}$`;
        }
      },
      // Math expressions with double $$
      {
        pattern: /\$\$([^$]*?)\$\$/g,
        fix: (match, content) => {
          const fixedContent = this.escapeLatexInMath(content);
          return `$$${fixedContent}$$`;
        }
      }
    ];

    latexPatterns.forEach(({ pattern, fix }) => {
      fixed = fixed.replace(pattern, fix);
    });

    return fixed;
  }

  escapeLatexInMath(mathContent) {
    return mathContent
      // Fix common LaTeX commands
      .replace(/\\([a-zA-Z]+)/g, '\\\\$1')
      // Fix specific symbols that need escaping
      .replace(/\\(\{|\}|\[|\]|\|)/g, '\\\\$1')
      // Fix already escaped sequences (avoid double escaping)
      .replace(/\\\\\\\\([a-zA-Z]+)/g, '\\\\$1')
      // Fix degree symbol specifically
      .replace(/\\\\circ/g, '\\\\circ')
      // Fix text commands
      .replace(/\\\\text\{([^}]*)\}/g, '\\\\text{$1}')
      // Fix fractions
      .replace(/\\\\frac\{([^}]*)\}\{([^}]*)\}/g, '\\\\frac{$1}{$2}');
  }

  async generateWithOpenAI(prompt) {
    // Placeholder for OpenAI implementation
    throw new Error('OpenAI integration not yet implemented. Please use Google Gemini.');
  }

  validateAndProcessQuestions(questions) {
    console.info(`Starting validation of ${questions.length} questions`);
    const processedQuestions = [];

    questions.forEach((question, index) => {
      try {
        console.info(`Processing question ${index + 1}:`, {
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
          console.warn(`Skipping question ${index + 1}: Invalid type ${question.type}`);
          return;
        }

        // Type-specific validation and processing
        if (question.type === 'multiple_choice') {
          if (!question.choices || !Array.isArray(question.choices) || question.choices.length !== 4) {
            console.warn(`Skipping question ${index + 1}: Multiple choice must have exactly 4 choices. Got:`, question.choices);
            return;
          }
          processedQuestion.choices = question.choices.map((choice, i) => ({
            id: i,
            text: choice.text
          }));
          processedQuestion.correctAnswer = question.correctAnswer;
          console.info(`Multiple choice question processed. Correct answer: ${question.correctAnswer}`);
        } else if (question.type === 'true_false') {
          if (!['true', 'false'].includes(question.correctAnswer)) {
            console.warn(`Skipping question ${index + 1}: True/false must have 'true' or 'false' as correct answer. Got: ${question.correctAnswer}`);
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
        console.info(`Successfully processed question ${index + 1}`);
      } catch (error) {
        console.warn(`Error processing question ${index + 1}:`, error);
      }
    });

    console.info(`Validation complete. ${processedQuestions.length} questions processed successfully.`);

    if (processedQuestions.length === 0) {
      throw new Error('No valid questions were generated');
    }

    return processedQuestions;
  }

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
      console.warn('PDF extraction failed:', error.message);
      throw new Error(error.message);
    }
  }

  // Test the API key validity
  async testApiKey(provider, apiKey) {
    try {
      // Create temporary client for testing without affecting current state
      let testClient = null;

      if (provider === 'gemini') {
        testClient = new GoogleGenerativeAI(apiKey);
        
        // Try each model until one works
        for (let i = 0; i < GEMINI_MODELS.length; i++) {
          const modelName = GEMINI_MODELS[i];
          
          try {
            console.info(`Testing API key with model: ${modelName} (${i + 1}/${GEMINI_MODELS.length})`);
            
            const model = testClient.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Say "API key is working" in exactly those words.');
            const response = await result.response;
            const text = response.text().trim();
            
            const isWorking = text.includes('API key is working');
            
            if (isWorking) {
              console.info(`✅ API key validated successfully with ${modelName}`);
              return true;
            } else {
              console.warn(`⚠️  ${modelName} responded but with unexpected text: "${text}"`);
              // Continue to next model if response doesn't match expected text
            }
            
          } catch (modelError) {
            console.warn(`❌ ${modelName} test failed: ${modelError.message}`);
            
            // If this is the last model, continue to outer catch
            if (i === GEMINI_MODELS.length - 1) {
              throw modelError;
            }
            
            // Continue to next model
            continue;
          }
        }
        
        // If we get here, no model worked properly
        return false;
        
      } else if (provider === 'openai') {
        // OpenAI validation would go here
        console.warn('OpenAI API key validation not implemented yet');
        return false;
      }

      return false;
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }

  // Get cached API key if available
  getCachedApiKey(provider) {
    return this.apiKeyCache.getApiKey(provider);
  }

  // Remove API key from cache
  removeCachedApiKey(provider) {
    this.apiKeyCache.removeApiKey(provider);
  }

  // Get cache statistics
  getCacheStats() {
    return this.apiKeyCache.getStats();
  }

  // Clear all cached API keys
  clearCache() {
    this.apiKeyCache.clear();
  }

  // Get configuration
  getConfig(path) {
    return this.configManager.get(path);
  }

  // Set configuration
  setConfig(path, value) {
    this.configManager.set(path, value);
  }

  // Validate cached API key
  async validateCachedKey(provider) {
    return await this.apiKeyCache.validateCachedKey(provider);
  }

  // Cleanup method
  destroy() {
    if (this.apiKeyCache) {
      this.apiKeyCache.destroy();
    }
  }
}

module.exports = LLMService;
