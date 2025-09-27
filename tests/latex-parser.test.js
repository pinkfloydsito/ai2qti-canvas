import { describe, test, expect, beforeEach } from '@jest/globals';
import LaTeXParser from '../src/services/latex-parser.js';

describe('LaTeXParser', () => {
  let parser;

  beforeEach(() => {
    parser = new LaTeXParser();
  });

  describe('extractAnswerMarker', () => {
    test('should detect (R) marker at the beginning and return correct flag', () => {
      const result = parser.extractAnswerMarker('(R) $[-5, 3]$');
      expect(result.text).toBe('$[-5, 3]$');
      expect(result.isCorrect).toBe(true);
    });

    test('should detect (R) marker with spaces and return correct flag', () => {
      const result = parser.extractAnswerMarker('(R)    $T=4\\pi$');
      expect(result.text).toBe('$T=4\\pi$');
      expect(result.isCorrect).toBe(true);
    });

    test('should return false for choices without (R) marker', () => {
      const result = parser.extractAnswerMarker('$\\{-1, 3\\}$');
      expect(result.text).toBe('$\\{-1, 3\\}$');
      expect(result.isCorrect).toBe(false);
    });

    test('should handle empty text', () => {
      const result = parser.extractAnswerMarker('');
      expect(result.text).toBe('');
      expect(result.isCorrect).toBe(false);
    });

    test('should not detect (R) marker in the middle of text', () => {
      const result = parser.extractAnswerMarker('This is (R) not at the beginning');
      expect(result.text).toBe('This is (R) not at the beginning');
      expect(result.isCorrect).toBe(false);
    });
  });

  describe('extractChoicesFromEnumerate', () => {
    test('should extract choices and identify correct answer with (R) marker', () => {
      const enumerateContent = `
        \\item $\\{-1, 3\\}$
        \\item $\\{-5, 3\\}$
        \\item $[-1, 3]$
        \\item $\\mathbb{R}$
        \\item (R) $[-5, 3]$
      `;

      const choices = parser.extractChoicesFromEnumerate(enumerateContent);
      
      expect(choices).toHaveLength(5);
      expect(choices[0].correct).toBe(false);
      expect(choices[1].correct).toBe(false);
      expect(choices[2].correct).toBe(false);
      expect(choices[3].correct).toBe(false);
      expect(choices[4].correct).toBe(true);
      expect(choices[4].text).toBe('$[-5, 3]$'); // (R) should be removed
    });

    test('should handle multiple (R) markers (only first one should be true)', () => {
      const enumerateContent = `
        \\item (R) First correct answer
        \\item Wrong answer
        \\item (R) Second marked answer
      `;

      const choices = parser.extractChoicesFromEnumerate(enumerateContent);
      
      expect(choices).toHaveLength(3);
      expect(choices[0].correct).toBe(true);
      expect(choices[0].text).toBe('First correct answer');
      expect(choices[1].correct).toBe(false);
      expect(choices[2].correct).toBe(true);
      expect(choices[2].text).toBe('Second marked answer');
    });
  });

  describe('parseQuestionWithChoices', () => {
    test('should parse question with enumerate and (R) marker correctly', () => {
      const latexContent = `
El rango de la función $f:[-1, 3]\\to \\mathbb{R}$ definida como $f(x)=2x-3$ es igual a:
\\begin{enumerate}[a)]
  \\item $\\{-1, 3\\}$
  \\item $\\{-5, 3\\}$
  \\item $[-1, 3]$
  \\item $\\mathbb{R}$
  \\item (R) $[-5, 3]$
\\end{enumerate}
      `;

      const result = parser.parseQuestionWithChoices(latexContent);
      
      expect(result).not.toBeNull();
      expect(result.type).toBe('multiple_choice');
      expect(result.questionText).toContain('El rango de la función');
      expect(result.choices).toHaveLength(5);
      
      // Check that the correct answer is marked
      const correctChoice = result.choices.find(choice => choice.correct);
      expect(correctChoice).toBeDefined();
      expect(correctChoice.text).toBe('$[-5, 3]$');
    });

    test('should parse trigonometric function question with (R) marker', () => {
      const latexContent = `
Si $f$ es una función de $ \\mathbb{R}$ en $\\mathbb{R}$ definida por $f(x)=6cos^2\\left(\\frac{x}{4}\\right)-1$, entonces el periodo fundamental de $f$ es:

\\begin{enumerate}[a)]
  \\item $T=2\\pi$
  \\item $T=3\\pi$
  \\item (R) $T=4\\pi$
  \\item $T=6\\pi$
  \\item $T=8\\pi$
\\end{enumerate}
      `;

      const result = parser.parseQuestionWithChoices(latexContent);
      
      expect(result).not.toBeNull();
      expect(result.type).toBe('multiple_choice');
      expect(result.questionText).toContain('periodo fundamental');
      expect(result.choices).toHaveLength(5);
      
      // Check that the correct answer is marked (should be index 2)
      const correctChoice = result.choices.find(choice => choice.correct);
      expect(correctChoice).toBeDefined();
      expect(correctChoice.text).toBe('$T=4\\pi$');
    });
  });

  describe('createQuestionFromParsedContent', () => {
    test('should set correctAnswer index based on (R) marker', async () => {
      const parsedContent = {
        questionText: 'Test question',
        type: 'multiple_choice',
        choices: [
          { text: 'Option A', correct: false },
          { text: 'Option B', correct: false },
          { text: 'Option C', correct: true }, // This should be index 2
          { text: 'Option D', correct: false }
        ]
      };

      const question = await parser.createQuestionFromParsedContent(parsedContent, 1, false);
      
      expect(question.correctAnswer).toBe(2);
      expect(question.choices[2].correct).toBe(true);
    });

    test('should default to 0 if no correct answer is marked', async () => {
      const parsedContent = {
        questionText: 'Test question',
        type: 'multiple_choice',
        choices: [
          { text: 'Option A', correct: false },
          { text: 'Option B', correct: false },
          { text: 'Option C', correct: false },
          { text: 'Option D', correct: false }
        ]
      };

      const question = await parser.createQuestionFromParsedContent(parsedContent, 1, false);
      
      expect(question.correctAnswer).toBe(0);
    });
  });

  describe('convertGraveAccents', () => {
    test('should convert grave accents in question text', () => {
      const result = parser.convertGraveAccents("¿Cuál es la función correcta?");
      expect(result).toBe("¿Cuál es la función correcta?");
    });

    test('should convert LaTeX grave accent notation', () => {
      const result = parser.convertGraveAccents("La funci\\'on tiene un per\\'iodo");
      expect(result).toBe("La función tiene un período");
    });

    test('should handle empty or null content', () => {
      expect(parser.convertGraveAccents('')).toBe('');
      expect(parser.convertGraveAccents(null)).toBe('');
      expect(parser.convertGraveAccents(undefined)).toBe('');
    });

    test('should convert multiple accents in same text', () => {
      const result = parser.convertGraveAccents("La soluci\\'on es \\'optima");
      expect(result).toBe("La solución es óptima");
    });
  });

  describe('extractChoicesFromEnumerate with grave accents', () => {
    test('should convert grave accents in choices and handle (R) marker', () => {
      const enumerateContent = `
        \\item La soluci\\'on es correcta
        \\item Es una funci\\'on lineal
        \\item (R) La respuesta \\'optima es esta opci\\'on
        \\item No es v\\'alida
      `;

      const choices = parser.extractChoicesFromEnumerate(enumerateContent);
      
      expect(choices).toHaveLength(4);
      expect(choices[0].text).toBe('La solución es correcta');
      expect(choices[0].correct).toBe(false);
      expect(choices[1].text).toBe('Es una función lineal');
      expect(choices[1].correct).toBe(false);
      expect(choices[2].text).toBe('La respuesta óptima es esta opción');
      expect(choices[2].correct).toBe(true);
      expect(choices[3].text).toBe('No es válida');
      expect(choices[3].correct).toBe(false);
    });
  });

  describe('Full integration test', () => {
    test('should parse complete ejerc block with (R) markers', async () => {
      const latexContent = `
\\begin{ejerc}{\\puntospoptb}
El rango de la función $f:[-1, 3]\\to \\mathbb{R}$ definida como $f(x)=2x-3$ es igual a:
\\begin{enumerate}[a)]
  \\item $\\{-1, 3\\}$
  \\item $\\{-5, 3\\}$
  \\item $[-1, 3]$
  \\item $\\mathbb{R}$
  \\item (R) $[-5, 3]$
\\end{enumerate}
\\end{ejerc}

\\begin{ejerc}{\\puntospoptb}
Si $f$ es una función de $ \\mathbb{R}$ en $\\mathbb{R}$ definida por $f(x)=6cos^2\\left(\\frac{x}{4}\\right)-1$, entonces el periodo fundamental de $f$ es:
\\begin{enumerate}[a)]
  \\item $T=2\\pi$
  \\item $T=3\\pi$
  \\item (R) $T=4\\pi$
  \\item $T=6\\pi$
  \\item $T=8\\pi$
\\end{enumerate} 
\\end{ejerc}
      `;

      const questions = await parser.parseLatexFile(latexContent, false);
      
      expect(questions).toHaveLength(2);
      
      // First question
      expect(questions[0].type).toBe('multiple_choice');
      expect(questions[0].correctAnswer).toBe(4); // Index of (R) marked answer
      expect(questions[0].choices[4].text).toBe('$[-5, 3]$');
      expect(questions[0].choices[4].correct).toBe(true);
      
      // Second question
      expect(questions[1].type).toBe('multiple_choice');
      expect(questions[1].correctAnswer).toBe(2); // Index of (R) marked answer
      expect(questions[1].choices[2].text).toBe('$T=4\\pi$');
      expect(questions[1].choices[2].correct).toBe(true);
    });

    test('should parse ejerc with Spanish accents and (R) markers', async () => {
      const latexContent = `
\\begin{ejerc}{\\puntospoptb}
¿Cu\\'al es la soluci\\'on \\'optima para esta ecuaci\\'on?
\\begin{enumerate}[a)]
  \\item La funci\\'on no tiene soluci\\'on
  \\item Es una funci\\'on peri\\'odica
  \\item (R) La soluci\\'on \\'unica es \\'optima
  \\item No es v\\'alida esta opci\\'on
\\end{enumerate}
\\end{ejerc}
      `;

      const questions = await parser.parseLatexFile(latexContent, false);
      
      expect(questions).toHaveLength(1);
      expect(questions[0].type).toBe('multiple_choice');
      expect(questions[0].text).toContain('¿Cuál es la solución óptima para esta ecuación?');
      expect(questions[0].correctAnswer).toBe(2); // Index of (R) marked answer
      
      // Check that all choices have converted accents
      expect(questions[0].choices[0].text).toBe('La función no tiene solución');
      expect(questions[0].choices[1].text).toBe('Es una función periódica');
      expect(questions[0].choices[2].text).toBe('La solución única es óptima');
      expect(questions[0].choices[2].correct).toBe(true);
      expect(questions[0].choices[3].text).toBe('No es válida esta opción');
    });
  });
});