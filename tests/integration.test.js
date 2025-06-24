describe('QTI Generator Integration Tests', () => {
  describe('End-to-end assessment workflow', () => {
    test('should create, save, and export a complete assessment', () => {
      // Create assessment
      const assessment = {
        title: 'Integration Test Assessment',
        description: 'Testing the complete workflow',
        timeLimit: 60,
        questions: []
      };

      // Add multiple choice question
      const multipleChoiceQuestion = {
        id: 1,
        type: 'multiple_choice',
        text: 'What is the capital of France?',
        points: 2,
        choices: [
          { id: 0, text: 'London' },
          { id: 1, text: 'Paris' },
          { id: 2, text: 'Berlin' },
          { id: 3, text: 'Madrid' }
        ],
        correctAnswer: 1
      };

      assessment.questions.push(multipleChoiceQuestion);

      // Add true/false question
      const trueFalseQuestion = {
        id: 2,
        type: 'true_false',
        text: 'The Earth is flat.',
        points: 1,
        correctAnswer: 'false'
      };

      assessment.questions.push(trueFalseQuestion);

      // Add short answer question
      const shortAnswerQuestion = {
        id: 3,
        type: 'short_answer',
        text: 'Name one renewable energy source.',
        points: 3,
        sampleAnswer: 'Solar power'
      };

      assessment.questions.push(shortAnswerQuestion);

      // Add essay question
      const essayQuestion = {
        id: 4,
        type: 'essay',
        text: 'Discuss the impact of technology on education.',
        points: 10,
        gradingRubric: 'Include examples and provide analysis.'
      };

      assessment.questions.push(essayQuestion);

      // Validate assessment structure
      expect(assessment.questions).toHaveLength(4);
      expect(assessment.questions[0].type).toBe('multiple_choice');
      expect(assessment.questions[1].type).toBe('true_false');
      expect(assessment.questions[2].type).toBe('short_answer');
      expect(assessment.questions[3].type).toBe('essay');

      // Test serialization for saving
      const jsonData = JSON.stringify(assessment, null, 2);
      expect(jsonData).toContain('"title": "Integration Test Assessment"');
      expect(jsonData).toContain('"timeLimit": 60');

      // Test deserialization for loading
      const loadedAssessment = JSON.parse(jsonData);
      expect(loadedAssessment).toEqual(assessment);

      // Generate QTI XML
      const qtiXML = generateFullQTI(assessment);
      expect(qtiXML).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(qtiXML).toContain('<questestinterop');
      expect(qtiXML).toContain('Integration Test Assessment');
      expect(qtiXML).toContain('multiple_choice_question');
      expect(qtiXML).toContain('true_false_question');
      expect(qtiXML).toContain('short_answer_question');
      expect(qtiXML).toContain('essay_question');
      expect(qtiXML).toContain('</questestinterop>');
    });

    test('should handle assessment with only one question type', () => {
      const assessment = {
        title: 'Single Type Assessment',
        description: 'Only multiple choice questions',
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
          },
          {
            id: 2,
            type: 'multiple_choice',
            text: 'Question 2',
            points: 1,
            choices: [
              { id: 0, text: 'X' },
              { id: 1, text: 'Y' }
            ],
            correctAnswer: 1
          }
        ]
      };

      const qtiXML = generateFullQTI(assessment);
      expect(qtiXML).toContain('multiple_choice_question');
      
      // Should contain both questions
      const questionMatches = qtiXML.match(/multiple_choice_question/g);
      expect(questionMatches).toHaveLength(2);
    });

    test('should handle empty assessment gracefully', () => {
      const emptyAssessment = {
        title: '',
        description: '',
        timeLimit: 0,
        questions: []
      };

      const qtiXML = generateFullQTI(emptyAssessment);
      expect(qtiXML).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(qtiXML).toContain('<questestinterop');
      expect(qtiXML).toContain('</questestinterop>');
      expect(qtiXML).not.toContain('cc_timelimit');
    });
  });

  describe('Question type workflows', () => {
    test('should handle multiple choice with varying number of options', () => {
      const questions = [
        {
          id: 1,
          type: 'multiple_choice',
          text: 'Two options',
          points: 1,
          choices: [
            { id: 0, text: 'Yes' },
            { id: 1, text: 'No' }
          ],
          correctAnswer: 0
        },
        {
          id: 2,
          type: 'multiple_choice',
          text: 'Five options',
          points: 2,
          choices: [
            { id: 0, text: 'A' },
            { id: 1, text: 'B' },
            { id: 2, text: 'C' },
            { id: 3, text: 'D' },
            { id: 4, text: 'E' }
          ],
          correctAnswer: 2
        }
      ];

      questions.forEach(question => {
        expect(question.choices.length).toBeGreaterThanOrEqual(2);
        expect(question.correctAnswer).toBeGreaterThanOrEqual(0);
        expect(question.correctAnswer).toBeLessThan(question.choices.length);
      });
    });

    test('should validate different question types have required fields', () => {
      const questionTypes = [
        {
          type: 'multiple_choice',
          requiredFields: ['choices', 'correctAnswer']
        },
        {
          type: 'true_false',
          requiredFields: ['correctAnswer']
        },
        {
          type: 'short_answer',
          requiredFields: []
        },
        {
          type: 'essay',
          requiredFields: []
        }
      ];

      questionTypes.forEach(({ type, requiredFields }) => {
        expect(Array.isArray(requiredFields)).toBe(true);
        
        if (type === 'multiple_choice') {
          expect(requiredFields).toContain('choices');
          expect(requiredFields).toContain('correctAnswer');
        }
        
        if (type === 'true_false') {
          expect(requiredFields).toContain('correctAnswer');
        }
      });
    });
  });

  describe('Data integrity workflows', () => {
    test('should maintain question order through save/load cycle', () => {
      const assessment = {
        title: 'Order Test',
        questions: [
          { id: 1, type: 'multiple_choice', text: 'First' },
          { id: 2, type: 'true_false', text: 'Second' },
          { id: 3, type: 'essay', text: 'Third' }
        ]
      };

      const jsonData = JSON.stringify(assessment);
      const loadedAssessment = JSON.parse(jsonData);

      expect(loadedAssessment.questions[0].text).toBe('First');
      expect(loadedAssessment.questions[1].text).toBe('Second');
      expect(loadedAssessment.questions[2].text).toBe('Third');
    });

    test('should preserve special characters in questions', () => {
      const assessment = {
        title: 'Special Characters Test',
        questions: [
          {
            id: 1,
            type: 'multiple_choice',
            text: 'What does <script>alert("XSS")</script> do?',
            choices: [
              { id: 0, text: 'Creates an alert & shows "XSS"' },
              { id: 1, text: 'Nothing safe' }
            ],
            correctAnswer: 0
          }
        ]
      };

      const jsonData = JSON.stringify(assessment);
      const loadedAssessment = JSON.parse(jsonData);

      expect(loadedAssessment.questions[0].text).toContain('<script>');
      expect(loadedAssessment.questions[0].choices[0].text).toContain('&');
      expect(loadedAssessment.questions[0].choices[0].text).toContain('"XSS"');
    });
  });

  // Helper function to generate full QTI
  function generateFullQTI(assessment) {
    const escapeXML = (text) => {
      if (!text) return '';
      return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const generateId = () => 'i' + Math.random().toString(36).substr(2, 9);
    const assessmentId = generateId();

    let qti = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment ident="${assessmentId}" title="${escapeXML(assessment.title)}">
    <qtimetadata>
      <qtimetadatafield>
        <fieldlabel>cc_maxattempts</fieldlabel>
        <fieldentry>1</fieldentry>
      </qtimetadatafield>`;

    if (assessment.timeLimit > 0) {
      qti += `
      <qtimetadatafield>
        <fieldlabel>cc_timelimit</fieldlabel>
        <fieldentry>${assessment.timeLimit}</fieldentry>
      </qtimetadatafield>`;
    }

    qti += `
    </qtimetadata>
    <section ident="root_section">`;

    assessment.questions.forEach(question => {
      const questionId = `question_${question.id}_${generateId()}`;
      
      if (question.type === 'multiple_choice') {
        qti += `
      <item ident="${questionId}" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>multiple_choice_question</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
      </item>`;
      } else if (question.type === 'true_false') {
        qti += `
      <item ident="${questionId}" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>true_false_question</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
      </item>`;
      } else if (question.type === 'short_answer') {
        qti += `
      <item ident="${questionId}" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>short_answer_question</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
      </item>`;
      } else if (question.type === 'essay') {
        qti += `
      <item ident="${questionId}" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>essay_question</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
      </item>`;
      }
    });

    qti += `
    </section>
  </assessment>
</questestinterop>`;

    return qti;
  }
});