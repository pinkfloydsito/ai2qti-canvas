import { v4 as randomUUID } from 'uuid'
import { latexParser } from 'latex-utensils';

/**
 * LaTeX Parser Service for extracting questions from LaTeX files
 * Supports parsing exercises marked with \begin{ejerc} ... \end{ejerc}
 */
class LaTeXParser {
  constructor() {
    this.exercisePattern = /\\begin\{ejerc\}(.*?)\\end\{ejerc\}/gs;
    this.questionPattern = /\\item\s+(.*?)(?=\\item|$)/gs;
    this.mathInlinePattern = /\$([^$]*)\$/g;
    this.mathDisplayPattern = /\$\$([^$]*)\$\$/g;
    this.enumeratePattern = /\\begin\{enumerate\}(?:\[[^\]]*\])?\s*(.*?)\\end\{enumerate\}/gs;
    this.itemChoicePattern = /\\item\s+(.*?)(?=\\item|\\end\{enumerate\}|$)/gs;
  }

  /**
   * Parse LaTeX file content and extract questions
   * @param {string} latexContent - Raw LaTeX file content
   * @param {boolean} useAI - Whether to use AI for generating answers
   * @returns {Array} Array of question objects
   */
  async parseLatexFile(latexContent, useAI = false) {
    try {
      console.log('🔍 Starting LaTeX parsing...');

      // Extract all exercises using regex pattern
      const exercises = this.extractExercises(latexContent);
      console.log(`📚 Found ${exercises.length} exercises`);

      const questions = [];
      let questionId = randomUUID();

      for (const exercise of exercises) {
        // Parse each exercise for questions/items
        const exerciseQuestions = await this.parseExercise(exercise, questionId, useAI);
        questions.push(...exerciseQuestions);
        questionId += exerciseQuestions.length;
      }

      console.log(`✅ Parsed ${questions.length} questions from LaTeX`);
      return questions;

    } catch (error) {
      console.error('❌ LaTeX parsing failed:', error);
      throw new Error(`LaTeX parsing failed: ${error.message}`);
    }
  }

  /**
   * Extract exercise blocks from LaTeX content
   * @param {string} content - LaTeX content
   * @returns {Array} Array of exercise content strings
   */
  extractExercises(content) {
    const exercises = [];
    let match;

    // Reset regex state
    this.exercisePattern.lastIndex = 0;

    while ((match = this.exercisePattern.exec(content)) !== null) {
      const exerciseContent = match[1].trim();
      if (exerciseContent) {
        exercises.push(exerciseContent);
      }
    }

    return exercises;
  }

  /**
   * Parse individual exercise and extract questions
   * @param {string} exerciseContent - Content of single exercise
   * @param {number} startId - Starting question ID
   * @param {boolean} useAI - Whether to use AI for answer generation
   * @returns {Array} Array of question objects
   */
  async parseExercise(exerciseContent, startId, useAI) {
    const questions = [];

    // First check if this exercise contains answer choices in enumerate blocks
    const questionWithChoices = this.parseQuestionWithChoices(exerciseContent);

    if (questionWithChoices) {
      // Found a question with enumerate choices
      const question = await this.createQuestionFromParsedContent(questionWithChoices, startId, useAI);
      questions.push(question);
      return questions;
    }

    // Try to parse with latex-utensils for better structure analysis
    try {
      const ast = latexParser.parse(exerciseContent);
      const items = this.extractItemsFromAST(ast);

      if (items.length > 0) {
        // Use structured parsing
        for (let i = 0; i < items.length; i++) {
          const question = await this.createQuestionFromItem(items[i], randomUUID(), useAI);
          questions.push(question);
        }
      } else {
        // Fallback: treat entire exercise as single question
        const question = await this.createQuestionFromText(exerciseContent, startId, useAI);
        questions.push(question);
      }

    } catch (parseError) {
      console.warn('⚠️ AST parsing failed, using regex fallback:', parseError.message);

      // Fallback to regex-based parsing
      const items = this.extractItemsWithRegex(exerciseContent);

      if (items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const question = await this.createQuestionFromText(items[i], startId + i, useAI);
          questions.push(question);
        }
      } else {
        // Single question from entire exercise
        const question = await this.createQuestionFromText(exerciseContent, startId, useAI);
        questions.push(question);
      }
    }

    return questions;
  }

  /**
   * Parse question with multiple choice answers from enumerate blocks
   * @param {string} content - Exercise content
   * @returns {Object|null} Parsed question object with choices or null if no enumerate found
   */
  parseQuestionWithChoices(content) {
    // Check if content contains enumerate block
    this.enumeratePattern.lastIndex = 0;
    const enumerateMatch = this.enumeratePattern.exec(content);

    if (!enumerateMatch) {
      return null;
    }

    // Extract question text (everything before enumerate block)
    const questionText = content.substring(0, enumerateMatch.index).trim();

    // Extract choices from enumerate block
    const enumerateContent = enumerateMatch[1];
    const choices = this.extractChoicesFromEnumerate(enumerateContent);

    if (choices.length === 0) {
      return null;
    }

    return {
      questionText: this.convertGraveAccents(this.cleanLatexContent(questionText)),
      choices: choices,
      type: 'multiple_choice'
    };
  }

  /**
   * Extract answer choices from enumerate content
   * @param {string} enumerateContent - Content inside enumerate block
   * @returns {Array} Array of choice objects
   */
  extractChoicesFromEnumerate(enumerateContent) {
    const choices = [];
    this.itemChoicePattern.lastIndex = 0;

    let match;
    while ((match = this.itemChoicePattern.exec(enumerateContent)) !== null) {
      const choiceText = match[1].trim();
      if (choiceText) {
        choices.push({
          text: this.cleanLatexContent(choiceText),
          correct: false // We'll determine correct answer later or leave for manual setting
        });
      }
    }

    return choices;
  }

  /**
   * Create question object from parsed content with choices
   * @param {Object} parsedContent - Parsed question with choices
   * @param {number} id - Question ID
   * @param {boolean} useAI - Whether to use AI for answer generation
   * @returns {Object} Question object
   */
  async createQuestionFromParsedContent(parsedContent, id, useAI) {
    const question = {
      id: `latex_q_${randomUUID()}`,
      type: parsedContent.type,
      text: parsedContent.questionText,
      choices: parsedContent.choices,
      points: 1,
      source: 'latex_parser',
      correctAnswer: 0 // Default to first choice, can be adjusted manually
    };

    if (useAI) {
      question.needsAIGeneration = true;
    }

    return question;
  }

  /**
   * Extract items from LaTeX AST
   * @param {Object} ast - LaTeX AST
   * @returns {Array} Array of item content strings
   */
  extractItemsFromAST(ast) {
    const items = [];

    const traverse = (node) => {
      if (node.kind === 'env.generic' && node.name === 'enumerate') {
        // Found enumerate environment, extract items
        for (const child of node.content || []) {
          if (child.kind === 'command' && child.name === 'item') {
            const itemContent = this.nodeToText(child);
            if (itemContent.trim()) {
              items.push(itemContent.trim());
            }
          }
        }
      } else if (node.kind === 'command' && node.name === 'item') {
        // Direct item command
        const itemContent = this.nodeToText(node);
        if (itemContent.trim()) {
          items.push(itemContent.trim());
        }
      }

      // Recursively traverse children
      if (node.content) {
        for (const child of node.content) {
          traverse(child);
        }
      }
    };

    traverse(ast);
    return items;
  }

  /**
   * Extract items using regex as fallback
   * @param {string} content - Exercise content
   * @returns {Array} Array of item content strings
   */
  extractItemsWithRegex(content) {
    const items = [];

    // Reset regex state
    this.questionPattern.lastIndex = 0;

    let match;
    while ((match = this.questionPattern.exec(content)) !== null) {
      const itemContent = match[1].trim();
      if (itemContent) {
        items.push(itemContent);
      }
    }

    return items;
  }

  /**
   * Convert LaTeX AST node to text
   * @param {Object} node - AST node
   * @returns {string} Text content
   */
  nodeToText(node) {
    if (typeof node === 'string') {
      return node;
    }

    if (node.kind === 'text.string') {
      return node.content;
    }

    if (node.content) {
      return node.content.map(child => this.nodeToText(child)).join('');
    }

    return '';
  }

  /**
   * Create question object from item content
   * @param {string} itemContent - Item text content
   * @param {number} id - Question ID
   * @param {boolean} useAI - Whether to use AI for answer generation
   * @returns {Object} Question object
   */
  async createQuestionFromItem(itemContent, id, useAI) {
    return this.createQuestionFromText(itemContent, id, useAI);
  }

  /**
   * Create question object from text content
   * @param {string} content - Question text content
   * @param {number} id - Question ID
   * @param {boolean} useAI - Whether to use AI for answer generation
   * @returns {Object} Question object
   */
  async createQuestionFromText(content, id, useAI) {
    // Clean and process the content
    const questionText = this.cleanLatexContent(content);

    // Determine question type based on content analysis
    const questionType = this.determineQuestionType(questionText);

    const question = {
      id: `latex_q_${id}`,
      type: questionType,
      text: questionText,
      points: 1,
      source: 'latex_parser'
    };

    if (useAI) {
      // If AI is enabled, we'll let the AI service generate the answers
      // The question structure will be completed by the AI generation workflow
      question.needsAIGeneration = true;
    } else {
      // Add basic structure based on question type
      this.addBasicQuestionStructure(question, questionType);
    }

    return question;
  }

  /**
   * Clean LaTeX content for display
   * @param {string} content - Raw LaTeX content
   * @returns {string} Cleaned content
   */
  cleanLatexContent(content) {
    // Remove common LaTeX commands that don't render well
    let cleaned = content
      .replace(/\\label\{[^}]*\}/g, '') // Remove labels
      .replace(/\\ref\{[^}]*\}/g, '') // Remove references
      .replace(/\\cite\{[^}]*\}/g, '') // Remove citations
      .replace(/\\index\{[^}]*\}/g, '') // Remove index entries
      .replace(/\\item\s*/, '') // Remove \item command
      .replace(/{\\puntos[^}]*}/g, '')
      .replace(/\\begin\{minipage\}\{[^}]*\}/g, '')
      .replace(/\\hspace\{[^}]*\}/g, '')
      .replace(/\\end\{minipage\}/g, '')
      .replace(/\\end\{hspace\}/g, '')
      .replace(/\\begin\{enumerate\}(?:\[[^\]]*\])?[\s\S]*?\\end\{enumerate\}/g, '') // Remove enumerate blocks from question text
      .trim();

    return cleaned;
  }

  convertGraveAccents = (content) => {
    if (!content || typeof content !== 'string') {
      return '';
    }

    const graveAccentMap = {
      'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú',
    }

    return content.replace(
      /\\'\{?([aeiouAEIOU])\}?/g,
      (match, letter) => graveAccentMap[letter] || match
    );
  };

  /**
   * Determine question type based on content analysis
   * @param {string} content - Question content
   * @returns {string} Question type
   */
  determineQuestionType(content) {
    const lowerContent = content.toLowerCase();

    // Look for indicators of different question types
    if (lowerContent.includes('verdadero') || lowerContent.includes('falso') ||
      lowerContent.includes('true') || lowerContent.includes('false') ||
      lowerContent.includes('cierto') || lowerContent.includes('v/f')) {
      return 'true_false';
    }

    if (lowerContent.includes('opción') || lowerContent.includes('opciones') ||
      lowerContent.includes('choice') || lowerContent.includes('choose') ||
      lowerContent.includes('selecciona') || lowerContent.includes('marca')) {
      return 'multiple_choice';
    }

    if (lowerContent.includes('explica') || lowerContent.includes('describe') ||
      lowerContent.includes('analiza') || lowerContent.includes('discute') ||
      lowerContent.includes('justify') || lowerContent.includes('explain')) {
      return 'essay';
    }

    // Default to short answer for mathematical/technical content
    return 'short_answer';
  }

  /**
   * Add basic question structure when not using AI
   * @param {Object} question - Question object to modify
   * @param {string} type - Question type
   */
  addBasicQuestionStructure(question, type) {
    switch (type) {
      case 'multiple_choice':
        question.choices = [
          { text: '', correct: true },
          { text: '', correct: false },
          { text: '', correct: false },
          { text: '', correct: false }
        ];
        question.correctAnswer = 0;
        break;

      case 'true_false':
        question.choices = [
          { text: 'Verdadero', correct: true },
          { text: 'Falso', correct: false }
        ];
        question.correctAnswer = 0;
        break;

      case 'short_answer':
        question.correctAnswer = '';
        break;

      case 'essay':
        question.correctAnswer = '';
        question.rubric = '';
        break;

      default:
        question.correctAnswer = '';
    }
  }

  /**
   * Validate if content appears to be a LaTeX exercise file
   * @param {string} content - File content to validate
   * @returns {boolean} True if content appears to be LaTeX with exercises
   */
  validateLatexContent(content) {
    // Check for basic LaTeX structure
    const hasLatexStructure = content.includes('\\') &&
      (content.includes('\\begin') || content.includes('\\documentclass'));

    // Check for exercise markers
    const hasExercises = content.includes('\\begin{ejerc}') ||
      content.includes('\\item') ||
      content.includes('\\begin{enumerate}');

    return hasLatexStructure || hasExercises;
  }
}

export default LaTeXParser;
