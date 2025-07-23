import JSONExtractor from '../src/llm-providers/json-extractor.js';

// Mock electron-log to avoid dependency issues in tests
jest.mock('electron-log/main.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('JSONExtractor.repairJSON', () => {
  describe('Basic JSON repair scenarios', () => {
    test('should handle missing closing braces', () => {
      const incompleteJson = '{"questions": [{"type": "multiple_choice", "text": "What is 2+2?"';
      const result = JSONExtractor.repairJSON(incompleteJson, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.questions).toBeDefined();
      expect(Array.isArray(parsed.questions)).toBe(true);
    });

    test('should handle missing closing brackets in arrays', () => {
      const incompleteJson = '{"questions": [';
      const result = JSONExtractor.repairJSON(incompleteJson, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.questions).toBeDefined();
      expect(Array.isArray(parsed.questions)).toBe(true);
    });

    test('should handle missing quotes around property names', () => {
      const incompleteJson = '{questions: [{"type": "multiple_choice", "text": "What is 2+2?"}]}';
      const result = JSONExtractor.repairJSON(incompleteJson, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.questions).toBeDefined();
    });

    test('should handle incomplete structures with jsonrepair', () => {
      const incompleteJson = '{';
      const result = JSONExtractor.repairJSON(incompleteJson, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      expect(result).toBe('{}');
    });

    test('should handle trailing commas in objects', () => {
      const jsonWithTrailingCommas = `{
        "questions": [{
          "type": "multiple_choice",
          "text": "What is 2+2?",
        }]
      }`;
      const result = JSONExtractor.repairJSON(jsonWithTrailingCommas, 'TestProvider');
      
      expect(result).not.toContain(',}');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should handle trailing commas in arrays', () => {
      const jsonWithTrailingCommas = `{
        "questions": [
          {"type": "multiple_choice", "text": "Question 1"},
          {"type": "true_false", "text": "Question 2"},
        ]
      }`;
      const result = JSONExtractor.repairJSON(jsonWithTrailingCommas, 'TestProvider');
      
      expect(result).not.toContain(',]');
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('LaTeX-specific repair scenarios', () => {
    test('should fix over-escaped LaTeX commands', () => {
      const jsonWithOverEscapedLatex = `{
        "questions": [{
          "type": "multiple_choice",
          "text": "Solve \\\\\\\\\\\\\\\\frac{x}{2} = 5"
        }]
      }`;
      const result = JSONExtractor.repairJSON(jsonWithOverEscapedLatex, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      // Should reduce quadruple backslashes to double backslashes
      expect(parsed.questions[0].text).toContain('\\\\frac{x}{2}');
    });

    test('should preserve properly escaped LaTeX commands', () => {
      const jsonWithProperLatex = `{
        "questions": [{
          "type": "multiple_choice",
          "text": "Solve \\\\frac{x}{2} = 5"
        }]
      }`;
      const result = JSONExtractor.repairJSON(jsonWithProperLatex, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.questions[0].text).toContain('\\frac{x}{2}');
    });

    test('should handle multiple LaTeX expressions in one string', () => {
      const jsonWithMultipleLatex = `{
        "questions": [{
          "type": "multiple_choice",
          "text": "Given \\\\\\\\\\\\\\\\alpha = 30° and \\\\\\\\\\\\\\\\beta = 45°, find \\\\\\\\\\\\\\\\gamma"
        }]
      }`;
      const result = JSONExtractor.repairJSON(jsonWithMultipleLatex, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      const text = parsed.questions[0].text;
      expect(text).toContain('\\alpha');
      expect(text).toContain('\\beta');
      expect(text).toContain('\\gamma');
    });
  });

  describe('Newline and tab character handling', () => {
    test('should escape unescaped newlines', () => {
      const jsonWithNewlines = `{
        "questions": [{
          "type": "multiple_choice",
          "text": "Line 1\nLine 2"
        }]
      }`;
      const result = JSONExtractor.repairJSON(jsonWithNewlines, 'TestProvider');
      
      expect(result).toContain('\\n');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should escape unescaped tabs', () => {
      const jsonWithTabs = `{
        "questions": [{
          "type": "multiple_choice",
          "text": "Column 1\tColumn 2"
        }]
      }`;
      const result = JSONExtractor.repairJSON(jsonWithTabs, 'TestProvider');
      
      expect(result).toContain('\\t');
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('Backslash handling scenarios', () => {
    test('should handle backslashes in strings', () => {
      const jsonWithBackslashes = `{
        "questions": [{
          "type": "multiple_choice",
          "text": "Test backslash: \\\\"
        }]
      }`;
      const result = JSONExtractor.repairJSON(jsonWithBackslashes, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should handle mixed LaTeX and regular content', () => {
      const jsonWithMixedContent = `{
        "questions": [{
          "type": "multiple_choice",
          "text": "LaTeX: \\\\\\\\\\\\\\\\frac{1}{2} and regular text"
        }]
      }`;
      const result = JSONExtractor.repairJSON(jsonWithMixedContent, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.questions[0].text).toContain('\\frac{1}{2}');
    });
  });

  describe('Complex incomplete JSON scenarios', () => {
    test('should handle incomplete nested structures', () => {
      const incompleteJson = '{"questions": [{"type": "multiple_choice", "text": "Question"';
      const result = JSONExtractor.repairJSON(incompleteJson, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.questions).toBeDefined();
      expect(Array.isArray(parsed.questions)).toBe(true);
    });

    test('should handle multiple structural issues', () => {
      const complexJson = '{"questions": [{"type": "test", "incomplete": true';
      const result = JSONExtractor.repairJSON(complexJson, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should handle deeply nested incomplete structures', () => {
      const deeplyNestedIncomplete = '{"questions": [{"choices": [{"text": "Choice 1"';
      const result = JSONExtractor.repairJSON(deeplyNestedIncomplete, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.questions).toBeDefined();
    });
  });

  describe('Edge cases and error scenarios', () => {
    test('should handle completely malformed input gracefully', () => {
      const malformedJson = 'This is not JSON at all!';
      const result = JSONExtractor.repairJSON(malformedJson, 'TestProvider');
      
      // Should at least return a string
      expect(typeof result).toBe('string');
    });

    test('should handle empty string input', () => {
      const result = JSONExtractor.repairJSON('', 'TestProvider');
      
      expect(typeof result).toBe('string');
    });

    test('should preserve already valid JSON', () => {
      const validJson = `{
        "questions": [{
          "type": "multiple_choice",
          "text": "What is 2+2?",
          "choices": ["2", "3", "4", "5"]
        }]
      }`;
      const result = JSONExtractor.repairJSON(validJson, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].choices).toHaveLength(4);
    });

    test('should handle JSON with only whitespace', () => {
      const whitespaceJson = '   \n\t   ';
      const result = JSONExtractor.repairJSON(whitespaceJson, 'TestProvider');
      
      expect(typeof result).toBe('string');
      expect(result.trim()).not.toBe('');
    });
  });

  describe('Specific repairJSON functionality', () => {
    test('should call jsonrepair library for structural repairs', () => {
      const incompleteJson = '{"test": "value"';
      const result = JSONExtractor.repairJSON(incompleteJson, 'TestProvider');
      
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.test).toBe('value');
    });

    test('should apply post-processing after jsonrepair', () => {
      // This tests the specific post-processing steps in repairJSON
      const jsonWithTrailingComma = '{"test": "value",}';
      const result = JSONExtractor.repairJSON(jsonWithTrailingComma, 'TestProvider');
      
      expect(result).not.toContain(',}');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should trim whitespace from result', () => {
      const jsonWithWhitespace = '  {"test": "value"}  ';
      const result = JSONExtractor.repairJSON(jsonWithWhitespace, 'TestProvider');
      
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });
});