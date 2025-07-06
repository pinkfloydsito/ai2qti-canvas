import LLMService from '../src/llm-service-v2.js';
import JSONExtractor from '../src/llm-providers/json-extractor.js';

describe('Gemini Response Processing', () => {

  describe('Complex LaTeX JSON Parsing', () => {
    test('should handle real Gemini response with complex LaTeX', () => {
      const realGeminiResponse = '```json\n{\n  "questions": [\n    {\n      "type": "multiple_choice",\n      "text": "What is 2+2?",\n      "points": 1,\n      "choices": [\n        {"id": 0, "text": "3"},\n        {"id": 1, "text": "4"},\n        {"id": 2, "text": "5"},\n        {"id": 3, "text": "6"}\n      ],\n      "correctAnswer": 1\n    }\n  ]\n}\n```';

      expect(() => {
        const cleaned = JSONExtractor.extractJSONFromResponse(realGeminiResponse, 'Test');
        JSON.parse(cleaned);
      }).not.toThrow();
    });

    test('should handle various LaTeX escape sequences', () => {
      const testCases = [
        {
          input: 'Text with $90^\\circ$ angle',
          description: 'degree symbol with single backslash'
        },
        {
          input: 'Formula $\\frac{a}{b}$ with fraction',
          description: 'fraction with single backslash'
        },
        {
          input: 'Expression $x^2 + y^2 = r^2$',
          description: 'simple equation'
        },
        {
          input: 'Complex $\\int_0^1 x^2 dx = \\frac{1}{3}$',
          description: 'integral with fraction'
        }
      ];

      const llmService = new LLMService();

      testCases.forEach(({ input, description }) => {
        const jsonString = `{"text": "${input}"}`;
        
        expect(() => {
          const repaired = llmService.repairJSON(jsonString);
          JSON.parse(repaired);
        }).not.toThrow(`Failed for: ${description}`);
      });
    });

    test('should extract JSON from response with markdown blocks', () => {
      const response = `Here is the JSON response:

\`\`\`json
{
  "questions": [
    {
      "type": "multiple_choice",
      "text": "What is $2^3$?",
      "points": 1,
      "choices": [
        {"id": 0, "text": "6"},
        {"id": 1, "text": "8"}
      ],
      "correctAnswer": 1
    }
  ]
}
\`\`\`

That's all!`;

      const cleaned = JSONExtractor.extractJSONFromResponse(response, 'Test');
      const parsed = JSON.parse(cleaned);

      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].text).toBe("What is $2^3$?");
    });

    test('should handle valid JSON and parse successfully', () => {
      const validJson = `{
        "questions": [
          {
            "type": "multiple_choice",
            "text": "What is the angle measure?",
            "points": 1,
            "choices": [{"id": 0, "text": "Right angle"}],
            "correctAnswer": 0
          }
        ]
      }`;

      expect(() => {
        const cleaned = JSONExtractor.extractJSONFromResponse(validJson, 'Test');
        JSON.parse(cleaned);
      }).not.toThrow();
    });

    test('should handle edge cases gracefully', () => {
      // Test empty response
      expect(() => {
        JSONExtractor.extractJSONFromResponse('', 'Test');
      }).toThrow('Invalid response text provided to JSON extractor');

      // Test response without JSON
      expect(() => {
        JSONExtractor.extractJSONFromResponse('This is just text with no JSON', 'Test');
      }).toThrow('No JSON object found in response');

      // Test response with only partial JSON
      expect(() => {
        JSONExtractor.extractJSONFromResponse('{ "incomplete": ', 'Test');
      }).toThrow();
    });
  });

  describe('Question Validation Edge Cases', () => {
    test('should handle questions with missing fields', () => {
      const incompleteQuestions = [
        {
          type: 'multiple_choice',
          text: 'Question without choices'
        },
        {
          type: 'true_false',
          text: 'Question without correct answer'
        },
        {
          type: 'invalid_type',
          text: 'Question with invalid type'
        }
      ];

      const llmService = new LLMService();
      
      // Should throw error when no valid questions are found
      expect(() => {
        llmService.validateAndProcessQuestions(incompleteQuestions);
      }).toThrow('No valid questions were generated');
    });

    test('should handle questions with extra fields', () => {
      const questionsWithExtras = [
        {
          type: 'multiple_choice',
          text: 'Valid question',
          points: 2,
          choices: [
            { id: 0, text: 'A' },
            { id: 1, text: 'B' },
            { id: 2, text: 'C' },
            { id: 3, text: 'D' }
          ],
          correctAnswer: 1,
          extraField: 'should be ignored',
          anotherExtra: 123
        }
      ];

      const llmService = new LLMService();
      const processed = llmService.validateAndProcessQuestions(questionsWithExtras);

      expect(processed).toHaveLength(1);
      expect(processed[0].extraField).toBeUndefined();
      expect(processed[0].anotherExtra).toBeUndefined();
    });
  });
});