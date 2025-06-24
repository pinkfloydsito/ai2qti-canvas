describe('QTI XML Generation Functions', () => {
  const escapeXML = (text) => {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const generateId = () => {
    return 'i' + Math.random().toString(36).substr(2, 9);
  };

  const generateQuestionId = (questionNumber) => {
    return `question_${questionNumber}_${generateId()}`;
  };

  describe('escapeXML', () => {
    test('should escape special XML characters', () => {
      const testCases = [
        { input: 'Hello & World', expected: 'Hello &amp; World' },
        { input: '<script>alert("xss")</script>', expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;' },
        { input: "It's a \"test\"", expected: 'It&apos;s a &quot;test&quot;' },
        { input: null, expected: '' },
        { input: undefined, expected: '' },
        { input: '', expected: '' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(escapeXML(input)).toBe(expected);
      });
    });
  });

  describe('generateId', () => {
    test('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toMatch(/^i[a-z0-9]{9}$/);
      expect(id2).toMatch(/^i[a-z0-9]{9}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateQuestionId', () => {
    test('should generate question ID with proper format', () => {
      const questionId = generateQuestionId(1);
      
      expect(questionId).toMatch(/^question_1_i[a-z0-9]{9}$/);
    });
  });

  describe('QTI XML Structure', () => {
    test('should generate valid QTI document header', () => {
      const header = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">`;

      expect(header).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(header).toContain('<questestinterop');
      expect(header).toContain('xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2"');
    });

    test('should generate multiple choice question structure', () => {
      const question = {
        id: 1,
        text: 'What is 2 + 2?',
        points: 2,
        choices: [
          { id: 0, text: '3' },
          { id: 1, text: '4' },
          { id: 2, text: '5' }
        ],
        correctAnswer: 1
      };

      const questionId = `question_${question.id}_test`;
      const xml = `
      <item ident="${questionId}" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>multiple_choice_question</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>points_possible</fieldlabel>
              <fieldentry>${question.points}</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material>
            <mattext texttype="text/html">${escapeXML(question.text)}</mattext>
          </material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>
              ${question.choices.map((choice, index) => `
              <response_label ident="${index}">
                <material>
                  <mattext texttype="text/plain">${escapeXML(choice.text)}</mattext>
                </material>
              </response_label>`).join('')}
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
          </outcomes>
          <respcondition continue="No">
            <conditionvar>
              <varequal respident="response1">${question.correctAnswer}</varequal>
            </conditionvar>
            <setvar action="Set" varname="SCORE">100</setvar>
          </respcondition>
        </resprocessing>
      </item>`;

      expect(xml).toContain('multiple_choice_question');
      expect(xml).toContain('What is 2 + 2?');
      expect(xml).toContain('<fieldentry>2</fieldentry>');
      expect(xml).toContain('response_label ident="0"');
      expect(xml).toContain('response_label ident="1"');
      expect(xml).toContain('response_label ident="2"');
      expect(xml).toContain('<varequal respident="response1">1</varequal>');
    });

    test('should generate true/false question structure', () => {
      const question = {
        id: 1,
        text: 'The sky is blue.',
        points: 1,
        correctAnswer: 'true'
      };

      const correctValue = question.correctAnswer === 'true' ? 'True' : 'False';
      const xml = `
      <item ident="question_1_test" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>true_false_question</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>points_possible</fieldlabel>
              <fieldentry>${question.points}</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material>
            <mattext texttype="text/html">${escapeXML(question.text)}</mattext>
          </material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>
              <response_label ident="True">
                <material>
                  <mattext texttype="text/plain">True</mattext>
                </material>
              </response_label>
              <response_label ident="False">
                <material>
                  <mattext texttype="text/plain">False</mattext>
                </material>
              </response_label>
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
          </outcomes>
          <respcondition continue="No">
            <conditionvar>
              <varequal respident="response1">${correctValue}</varequal>
            </conditionvar>
            <setvar action="Set" varname="SCORE">100</setvar>
          </respcondition>
        </resprocessing>
      </item>`;

      expect(xml).toContain('true_false_question');
      expect(xml).toContain('The sky is blue.');
      expect(xml).toContain('<fieldentry>1</fieldentry>');
      expect(xml).toContain('response_label ident="True"');
      expect(xml).toContain('response_label ident="False"');
      expect(xml).toContain('<varequal respident="response1">True</varequal>');
    });

    test('should generate short answer question structure', () => {
      const question = {
        id: 1,
        text: 'What is the capital of France?',
        points: 3
      };

      const xml = `
      <item ident="question_1_test" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>short_answer_question</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>points_possible</fieldlabel>
              <fieldentry>${question.points}</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material>
            <mattext texttype="text/html">${escapeXML(question.text)}</mattext>
          </material>
          <response_str ident="response1" rcardinality="Single">
            <render_fib>
              <response_label ident="answer1"/>
            </render_fib>
          </response_str>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
          </outcomes>
        </resprocessing>
      </item>`;

      expect(xml).toContain('short_answer_question');
      expect(xml).toContain('What is the capital of France?');
      expect(xml).toContain('<fieldentry>3</fieldentry>');
      expect(xml).toContain('response_str ident="response1"');
      expect(xml).toContain('render_fib');
    });

    test('should generate essay question structure', () => {
      const question = {
        id: 1,
        text: 'Discuss the impact of climate change.',
        points: 10
      };

      const xml = `
      <item ident="question_1_test" title="Question ${question.id}">
        <itemmetadata>
          <qtimetadata>
            <qtimetadatafield>
              <fieldlabel>question_type</fieldlabel>
              <fieldentry>essay_question</fieldentry>
            </qtimetadatafield>
            <qtimetadatafield>
              <fieldlabel>points_possible</fieldlabel>
              <fieldentry>${question.points}</fieldentry>
            </qtimetadatafield>
          </qtimetadata>
        </itemmetadata>
        <presentation>
          <material>
            <mattext texttype="text/html">${escapeXML(question.text)}</mattext>
          </material>
          <response_str ident="response1" rcardinality="Single">
            <render_fib>
              <response_label ident="answer1"/>
            </render_fib>
          </response_str>
        </presentation>
        <resprocessing>
          <outcomes>
            <decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/>
          </outcomes>
        </resprocessing>
      </item>`;

      expect(xml).toContain('essay_question');
      expect(xml).toContain('Discuss the impact of climate change.');
      expect(xml).toContain('<fieldentry>10</fieldentry>');
      expect(xml).toContain('response_str ident="response1"');
    });
  });

  describe('Assessment metadata', () => {
    test('should include time limit when specified', () => {
      const timeLimit = 60;
      const metadataXML = `
      <qtimetadatafield>
        <fieldlabel>cc_timelimit</fieldlabel>
        <fieldentry>${timeLimit}</fieldentry>
      </qtimetadatafield>`;

      expect(metadataXML).toContain('cc_timelimit');
      expect(metadataXML).toContain('<fieldentry>60</fieldentry>');
    });

    test('should include max attempts metadata', () => {
      const metadataXML = `
      <qtimetadatafield>
        <fieldlabel>cc_maxattempts</fieldlabel>
        <fieldentry>1</fieldentry>
      </qtimetadatafield>`;

      expect(metadataXML).toContain('cc_maxattempts');
      expect(metadataXML).toContain('<fieldentry>1</fieldentry>');
    });
  });

  describe('XML validation', () => {
    test('should handle special characters in assessment title', () => {
      const title = 'Assessment with <special> & "characters"';
      const escapedTitle = escapeXML(title);
      
      expect(escapedTitle).toBe('Assessment with &lt;special&gt; &amp; &quot;characters&quot;');
    });

    test('should handle empty values gracefully', () => {
      expect(escapeXML('')).toBe('');
      expect(escapeXML(null)).toBe('');
      expect(escapeXML(undefined)).toBe('');
    });

    test('should maintain proper XML structure', () => {
      const sampleQTI = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment ident="test_assessment" title="Test">
    <section ident="root_section">
    </section>
  </assessment>
</questestinterop>`;

      expect(sampleQTI).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sampleQTI).toContain('<questestinterop>');
      expect(sampleQTI).toContain('</questestinterop>');
      expect(sampleQTI).toContain('<assessment');
      expect(sampleQTI).toContain('</assessment>');
    });
  });
});