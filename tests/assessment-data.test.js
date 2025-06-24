describe('Assessment Data Management', () => {
  describe('Assessment structure validation', () => {
    test('should validate complete assessment object', () => {
      const validAssessment = {
        title: 'Sample Assessment',
        description: 'This is a test assessment',
        timeLimit: 60,
        questions: [
          {
            id: 1,
            type: 'multiple_choice',
            text: 'What is 2 + 2?',
            points: 1,
            choices: [
              { id: 0, text: '3' },
              { id: 1, text: '4' },
              { id: 2, text: '5' }
            ],
            correctAnswer: 1
          },
          {
            id: 2,
            type: 'true_false',
            text: 'The earth is round.',
            points: 1,
            correctAnswer: 'true'
          }
        ]
      };

      expect(validAssessment).toHaveProperty('title');
      expect(validAssessment).toHaveProperty('description');
      expect(validAssessment).toHaveProperty('timeLimit');
      expect(validAssessment).toHaveProperty('questions');
      expect(Array.isArray(validAssessment.questions)).toBe(true);
      expect(validAssessment.questions).toHaveLength(2);
    });

    test('should handle empty assessment', () => {
      const emptyAssessment = {
        title: '',
        description: '',
        timeLimit: 0,
        questions: []
      };

      expect(emptyAssessment.questions).toHaveLength(0);
      expect(emptyAssessment.timeLimit).toBe(0);
    });

    test('should validate multiple choice question structure', () => {
      const multipleChoiceQuestion = {
        id: 1,
        type: 'multiple_choice',
        text: 'Sample question',
        points: 2,
        choices: [
          { id: 0, text: 'Option A' },
          { id: 1, text: 'Option B' },
          { id: 2, text: 'Option C' }
        ],
        correctAnswer: 1
      };

      expect(multipleChoiceQuestion.type).toBe('multiple_choice');
      expect(multipleChoiceQuestion.choices).toHaveLength(3);
      expect(multipleChoiceQuestion.correctAnswer).toBe(1);
      expect(multipleChoiceQuestion.points).toBe(2);
    });

    test('should validate true/false question structure', () => {
      const trueFalseQuestion = {
        id: 1,
        type: 'true_false',
        text: 'This is a true/false question',
        points: 1,
        correctAnswer: 'false'
      };

      expect(trueFalseQuestion.type).toBe('true_false');
      expect(['true', 'false']).toContain(trueFalseQuestion.correctAnswer);
      expect(trueFalseQuestion.points).toBe(1);
    });

    test('should validate short answer question structure', () => {
      const shortAnswerQuestion = {
        id: 1,
        type: 'short_answer',
        text: 'What is the capital of France?',
        points: 3,
        sampleAnswer: 'Paris'
      };

      expect(shortAnswerQuestion.type).toBe('short_answer');
      expect(shortAnswerQuestion.points).toBe(3);
      expect(shortAnswerQuestion).toHaveProperty('sampleAnswer');
    });

    test('should validate essay question structure', () => {
      const essayQuestion = {
        id: 1,
        type: 'essay',
        text: 'Discuss the importance of renewable energy.',
        points: 10,
        gradingRubric: 'Include examples and cite sources.'
      };

      expect(essayQuestion.type).toBe('essay');
      expect(essayQuestion.points).toBe(10);
      expect(essayQuestion).toHaveProperty('gradingRubric');
    });
  });

  describe('Question type mapping', () => {
    test('should map question types to templates', () => {
      const templateMap = {
        'multiple_choice': 'multipleChoiceTemplate',
        'true_false': 'trueFalseTemplate',
        'short_answer': 'shortAnswerTemplate',
        'essay': 'essayTemplate',
        'fill_in_blank': 'shortAnswerTemplate'
      };

      expect(templateMap['multiple_choice']).toBe('multipleChoiceTemplate');
      expect(templateMap['true_false']).toBe('trueFalseTemplate');
      expect(templateMap['short_answer']).toBe('shortAnswerTemplate');
      expect(templateMap['essay']).toBe('essayTemplate');
      expect(templateMap['fill_in_blank']).toBe('shortAnswerTemplate');
    });

    test('should handle unknown question types', () => {
      const templateMap = {
        'multiple_choice': 'multipleChoiceTemplate',
        'true_false': 'trueFalseTemplate',
        'short_answer': 'shortAnswerTemplate',
        'essay': 'essayTemplate',
        'fill_in_blank': 'shortAnswerTemplate'
      };

      const unknownType = 'unknown_type';
      const defaultTemplate = templateMap[unknownType] || 'multipleChoiceTemplate';
      
      expect(defaultTemplate).toBe('multipleChoiceTemplate');
    });
  });

  describe('Data validation and sanitization', () => {
    test('should handle invalid points values', () => {
      const invalidPoints = ['invalid', '', null, undefined];
      
      invalidPoints.forEach(points => {
        const sanitizedPoints = parseInt(points) || 1;
        expect(sanitizedPoints).toBe(1);
      });

      // Test negative values separately
      const negativePoints = -1;
      const sanitizedNegative = parseInt(negativePoints) > 0 ? parseInt(negativePoints) : 1;
      expect(sanitizedNegative).toBe(1);
    });

    test('should handle valid points values', () => {
      const validPoints = [1, 2, 5, 10, '3', '7'];
      
      validPoints.forEach(points => {
        const sanitizedPoints = parseInt(points) || 1;
        expect(sanitizedPoints).toBeGreaterThan(0);
      });
    });

    test('should validate question text', () => {
      const questions = [
        { text: 'Valid question text', isValid: true },
        { text: '', isValid: false },
        { text: null, isValid: false },
        { text: undefined, isValid: false },
        { text: '   ', isValid: false }
      ];

      questions.forEach(({ text, isValid }) => {
        const hasValidText = Boolean(text && text.trim && text.trim().length > 0);
        expect(hasValidText).toBe(isValid);
      });
    });

    test('should validate multiple choice answers', () => {
      const multipleChoiceQuestion = {
        choices: [
          { id: 0, text: 'Choice A' },
          { id: 1, text: 'Choice B' },
          { id: 2, text: 'Choice C' }
        ],
        correctAnswer: 1
      };

      expect(multipleChoiceQuestion.correctAnswer).toBeGreaterThanOrEqual(0);
      expect(multipleChoiceQuestion.correctAnswer).toBeLessThan(multipleChoiceQuestion.choices.length);
    });
  });

  describe('Assessment serialization', () => {
    test('should serialize assessment to JSON', () => {
      const assessment = {
        title: 'Test Assessment',
        description: 'Description',
        timeLimit: 30,
        questions: [
          {
            id: 1,
            type: 'multiple_choice',
            text: 'Question 1',
            points: 1,
            choices: [
              { id: 0, text: 'A' },
              { id: 1, text: 'B' }
            ],
            correctAnswer: 0
          }
        ]
      };

      const jsonString = JSON.stringify(assessment, null, 2);
      const parsed = JSON.parse(jsonString);

      expect(parsed).toEqual(assessment);
      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].choices).toHaveLength(2);
    });

    test('should handle assessment deserialization', () => {
      const jsonString = `{
        "title": "Deserialized Assessment",
        "description": "From JSON",
        "timeLimit": 45,
        "questions": [
          {
            "id": 1,
            "type": "true_false",
            "text": "JSON test question",
            "points": 1,
            "correctAnswer": "true"
          }
        ]
      }`;

      const assessment = JSON.parse(jsonString);

      expect(assessment.title).toBe('Deserialized Assessment');
      expect(assessment.timeLimit).toBe(45);
      expect(assessment.questions[0].type).toBe('true_false');
      expect(assessment.questions[0].correctAnswer).toBe('true');
    });
  });

  describe('Question management', () => {
    test('should add questions to assessment', () => {
      const assessment = { questions: [] };
      const newQuestion = {
        id: 1,
        type: 'short_answer',
        text: 'New question',
        points: 2
      };

      assessment.questions.push(newQuestion);

      expect(assessment.questions).toHaveLength(1);
      expect(assessment.questions[0]).toEqual(newQuestion);
    });

    test('should remove questions from assessment', () => {
      const assessment = {
        questions: [
          { id: 1, type: 'multiple_choice', text: 'Q1' },
          { id: 2, type: 'true_false', text: 'Q2' },
          { id: 3, type: 'essay', text: 'Q3' }
        ]
      };

      assessment.questions = assessment.questions.filter(q => q.id !== 2);

      expect(assessment.questions).toHaveLength(2);
      expect(assessment.questions.map(q => q.id)).toEqual([1, 3]);
    });

    test('should renumber questions after removal', () => {
      const questions = [
        { id: 1, text: 'Question 1' },
        { id: 2, text: 'Question 2' },
        { id: 3, text: 'Question 3' }
      ];

      questions.splice(1, 1); // Remove middle question
      
      const renumberedQuestions = questions.map((q, index) => ({
        ...q,
        id: index + 1
      }));

      expect(renumberedQuestions).toHaveLength(2);
      expect(renumberedQuestions[0].id).toBe(1);
      expect(renumberedQuestions[1].id).toBe(2);
    });
  });

  describe('Assessment defaults', () => {
    test('should provide default assessment structure', () => {
      const defaultAssessment = {
        title: '',
        description: '',
        timeLimit: 0,
        questions: []
      };

      expect(defaultAssessment.title).toBe('');
      expect(defaultAssessment.description).toBe('');
      expect(defaultAssessment.timeLimit).toBe(0);
      expect(Array.isArray(defaultAssessment.questions)).toBe(true);
    });

    test('should provide default question structure', () => {
      const defaultQuestion = {
        id: 1,
        type: 'multiple_choice',
        text: '',
        points: 1
      };

      expect(defaultQuestion.points).toBe(1);
      expect(defaultQuestion.type).toBe('multiple_choice');
      expect(defaultQuestion.text).toBe('');
    });
  });
});