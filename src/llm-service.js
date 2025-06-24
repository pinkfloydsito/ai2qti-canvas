const { GoogleGenerativeAI } = require('@google/generative-ai');

class LLMService {
    constructor() {
        this.geminiClient = null;
        this.openaiClient = null;
        this.currentProvider = 'gemini';
    }

    setProvider(provider, apiKey) {
        this.currentProvider = provider;
        
        if (provider === 'gemini') {
            this.geminiClient = new GoogleGenerativeAI(apiKey);
        } else if (provider === 'openai') {
            // OpenAI client setup would go here
            this.openaiClient = { apiKey };
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
            ? "Use LaTeX notation for mathematical expressions (e.g., $x^2 + 3x - 5 = 0$ for inline math, $$\\int_0^1 x^2 dx$$ for display math)."
            : "Avoid complex mathematical notation.";

        const questionTypesList = questionTypes.map(type => {
            switch(type) {
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

Important: Return ONLY the JSON object, no additional text or formatting.
        `;
    }

    async generateWithGemini(prompt) {
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized. Please set API key.');
        }

        try {
            const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Clean up the response - remove any markdown formatting
            const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
            
            const parsedQuestions = JSON.parse(cleanText);
            
            if (!parsedQuestions.questions || !Array.isArray(parsedQuestions.questions)) {
                throw new Error('Invalid response format from Gemini API');
            }

            return this.validateAndProcessQuestions(parsedQuestions.questions);
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error('Failed to parse LLM response as JSON');
            }
            throw error;
        }
    }

    async generateWithOpenAI(prompt) {
        // Placeholder for OpenAI implementation
        throw new Error('OpenAI integration not yet implemented. Please use Google Gemini.');
    }

    validateAndProcessQuestions(questions) {
        const processedQuestions = [];
        
        questions.forEach((question, index) => {
            try {
                const processedQuestion = {
                    id: index + 1,
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
                        console.warn(`Skipping question ${index + 1}: Multiple choice must have exactly 4 choices`);
                        return;
                    }
                    processedQuestion.choices = question.choices.map((choice, i) => ({
                        id: i,
                        text: choice.text
                    }));
                    processedQuestion.correctAnswer = question.correctAnswer;
                } else if (question.type === 'true_false') {
                    if (!['true', 'false'].includes(question.correctAnswer)) {
                        console.warn(`Skipping question ${index + 1}: True/false must have 'true' or 'false' as correct answer`);
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
            } catch (error) {
                console.warn(`Error processing question ${index + 1}:`, error);
            }
        });

        if (processedQuestions.length === 0) {
            throw new Error('No valid questions were generated');
        }

        return processedQuestions;
    }

    async extractTextFromPDF(pdfBuffer) {
        const pdfParse = require('pdf-parse');
        
        try {
            const data = await pdfParse(pdfBuffer);
            return data.text;
        } catch (error) {
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
    }

    // Test the API key validity
    async testApiKey(provider, apiKey) {
        try {
            this.setProvider(provider, apiKey);
            
            if (provider === 'gemini') {
                const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
                const result = await model.generateContent('Say "API key is working" in exactly those words.');
                const response = await result.response;
                const text = response.text().trim();
                return text.includes('API key is working');
            }
            
            return false;
        } catch (error) {
            console.error('API key test failed:', error);
            return false;
        }
    }
}

module.exports = LLMService;