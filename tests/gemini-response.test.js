describe('Gemini Response Processing', () => {
  const LLMService = require('../src/llm-service');

  describe('Complex LaTeX JSON Parsing', () => {
    test('should handle real Gemini response with complex LaTeX', () => {
      const realGeminiResponse = `\`\`\`json
{
  "questions": [
    {
      "type": "multiple_choice",
      "text": "Given three parallel lines $L_1, L_2, L_3$ intersected by two transversals $T_A$ and $T_B$. $T_A$ intersects $L_1, L_2, L_3$ at points $A, B, C$ respectively. $T_B$ intersects $L_1, L_2, L_3$ at points $D, E, F$ respectively. If $AB = 6 \\text{ cm}$, $BC = 9 \\text{ cm}$, and $DE = 8 \\text{ cm}$, what is the length of $DF$?",
      "points": 3,
      "choices": [
        {"id": 0, "text": "$12 \\text{ cm}$"},
        {"id": 1, "text": "$14 \\text{ cm}$"},
        {"id": 2, "text": "$16 \\text{ cm}$"},
        {"id": 3, "text": "$20 \\text{ cm}$"}
      ],
      "correctAnswer": 3,
      "explanation": "According to the Intercept Theorem (or Thales's Theorem extension for parallel lines), the ratio of the segments on one transversal is equal to the ratio of the corresponding segments on the other transversal. Thus, $AB/BC = DE/EF$. Substituting the given values: $6/9 = 8/EF$. This simplifies to $2/3 = 8/EF$, so $2 \\cdot EF = 3 \\cdot 8 \\implies 2EF = 24 \\implies EF = 12 \\text{ cm}$. The length of $DF$ is the sum of $DE$ and $EF$. Therefore, $DF = DE + EF = 8 \\text{ cm} + 12 \\text{ cm} = 20 \\text{ cm}$."
    },
    {
      "type": "true_false",
      "text": "It is possible for a regular polygon to have an interior angle measure of $155^\\circ$.",
      "points": 2,
      "correctAnswer": "false",
      "explanation": "The formula for the interior angle of a regular polygon with $n$ sides is $I = \\frac{(n-2) \\cdot 180^\\circ}{n}$. If $I = 155^\\circ$, then: $155 = \\frac{(n-2) \\cdot 180}{n}$ $155n = 180n - 360$ $360 = 180n - 155n$ $360 = 25n$ $n = \\frac{360}{25} = \\frac{72}{5} = 14.4$. Since the number of sides $n$ must be an integer, it is not possible for a regular polygon to have an interior angle of $155^\\circ$. Thus, the statement is false."
    }
  ]
}
\`\`\``;

      const llmService = new LLMService();
      
      expect(() => {
        const cleaned = llmService.extractJSONFromResponse(realGeminiResponse);
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

      const llmService = new LLMService();
      const cleaned = llmService.extractJSONFromResponse(response);
      const parsed = JSON.parse(cleaned);

      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].text).toBe("What is $2^3$?");
    });

    test('should handle malformed JSON and attempt repair', () => {
      const malformedJson = `{
        "questions": [
          {
            "type": "multiple_choice",
            "text": "Angle of $90\\circ$",
            "points": 1,
            "choices": [{"id": 0, "text": "Right angle"}],
            "correctAnswer": 0
          }
        ]
      }`;

      const llmService = new LLMService();
      
      expect(() => {
        const cleaned = llmService.extractJSONFromResponse(malformedJson);
        JSON.parse(cleaned);
      }).not.toThrow();
    });

    test('should handle edge cases gracefully', () => {
      const llmService = new LLMService();

      // Test empty response
      expect(() => {
        llmService.extractJSONFromResponse('');
      }).toThrow('No JSON object found in response');

      // Test response without JSON
      expect(() => {
        llmService.extractJSONFromResponse('This is just text with no JSON');
      }).toThrow('No JSON object found in response');

      // Test response with only partial JSON
      expect(() => {
        llmService.extractJSONFromResponse('{ "incomplete": ');
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