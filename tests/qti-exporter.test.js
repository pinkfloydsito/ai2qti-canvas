import QTIExporter from '../src/qti-exporter.js';

describe('QTI Exporter', () => {
    let exporter;

    beforeEach(() => {
        exporter = new QTIExporter();
    });

    describe('Basic QTI Generation', () => {
        test('should generate valid QTI XML structure', () => {
            const assessment = {
                title: 'Test Assessment',
                description: 'A test assessment',
                timeLimit: 60,
                questions: [
                    {
                        id: 1,
                        type: 'multiple_choice',
                        text: 'What is 2 + 2?',
                        points: 1,
                        choices: [
                            { text: '3', correct: false },
                            { text: '4', correct: true },
                            { text: '5', correct: false }
                        ],
                        correctAnswer: 1
                    }
                ]
            };

            const qti = exporter.generateQTI(assessment);

            expect(qti).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(qti).toContain('<questestinterop');
            expect(qti).toContain('<assessment');
            expect(qti).toContain('Test Assessment');
            expect(qti).toContain('cc_timelimit');
            expect(qti).toContain('<fieldentry>60</fieldentry>');
            expect(qti).toContain('multiple_choice_question');
            expect(qti).toContain('What is 2 + 2?');
        });

        test('should handle assessment without time limit', () => {
            const assessment = {
                title: 'No Time Limit',
                description: 'Test',
                timeLimit: 0,
                questions: []
            };

            const qti = exporter.generateQTI(assessment);

            expect(qti).not.toContain('cc_timelimit');
            expect(qti).toContain('cc_maxattempts');
        });
    });

    describe('Question Types', () => {
        test('should generate multiple choice question XML', () => {
            const question = {
                id: 1,
                type: 'multiple_choice',
                text: 'Choose the correct answer',
                points: 2,
                choices: [
                    { text: 'Option A', correct: false },
                    { text: 'Option B', correct: true },
                    { text: 'Option C', correct: false }
                ],
                correctAnswer: 1
            };

            const xml = exporter.generateMultipleChoiceXML(question, 'test_q1');

            expect(xml).toContain('multiple_choice_question');
            expect(xml).toContain('Choose the correct answer');
            expect(xml).toContain('<fieldentry>2</fieldentry>');
            expect(xml).toContain('Option A');
            expect(xml).toContain('Option B');
            expect(xml).toContain('Option C');
            expect(xml).toContain('<varequal respident="response1">1</varequal>');
        });

        test('should generate true/false question XML', () => {
            const question = {
                id: 1,
                type: 'true_false',
                text: 'This is a true statement',
                points: 1,
                correctAnswer: 'true'
            };

            const xml = exporter.generateTrueFalseXML(question, 'test_q1');

            expect(xml).toContain('true_false_question');
            expect(xml).toContain('This is a true statement');
            expect(xml).toContain('<fieldentry>1</fieldentry>');
            expect(xml).toContain('response_label ident="True"');
            expect(xml).toContain('response_label ident="False"');
            expect(xml).toContain('<varequal respident="response1">True</varequal>');
        });

        test('should generate short answer question XML', () => {
            const question = {
                id: 1,
                type: 'short_answer',
                text: 'What is the capital of France?',
                points: 3
            };

            const xml = exporter.generateShortAnswerXML(question, 'test_q1');

            expect(xml).toContain('short_answer_question');
            expect(xml).toContain('What is the capital of France?');
            expect(xml).toContain('<fieldentry>3</fieldentry>');
            expect(xml).toContain('response_str ident="response1"');
        });

        test('should generate essay question XML', () => {
            const question = {
                id: 1,
                type: 'essay',
                text: 'Discuss the topic in detail',
                points: 10
            };

            const xml = exporter.generateEssayXML(question, 'test_q1');

            expect(xml).toContain('essay_question');
            expect(xml).toContain('Discuss the topic in detail');
            expect(xml).toContain('<fieldentry>10</fieldentry>');
            expect(xml).toContain('response_str ident="response1"');
        });

        test('should return empty string for unknown question type', () => {
            const question = {
                id: 1,
                type: 'unknown_type',
                text: 'Unknown question',
                points: 1
            };

            const xml = exporter.generateQuestionXML(question);

            expect(xml).toBe('');
        });
    });

    describe('IMG Tag Handling (Fixed Nested Issue)', () => {
        test('should properly escape img tag attributes without creating nested tags', () => {
            const textWithImg = 'The equation is <img class="equation_image" title="q(v) > 0" src="https://example.com/equation.png" alt="LaTeX: q(v) > 0" data-equation-content="q(v) > 0" /> for all values.';

            const escaped = exporter.escapeForHTML(textWithImg);

            // Should contain properly escaped attributes
            expect(escaped).toContain('title="q(v) &gt; 0"');
            expect(escaped).toContain('alt="LaTeX: q(v) &gt; 0"');
            expect(escaped).toContain('data-equation-content="q(v) &gt; 0"');
            
            // Should not have malformed attribute structures
            expect(escaped).not.toContain('title="q(v) > 0&quot; src=&quot;');
            
            // Should be valid XML-like structure
            const imgTagMatches = escaped.match(/<img[^>]*>/g);
            expect(imgTagMatches).toHaveLength(1);
        });

        test('should handle multiple img tags correctly', () => {
            const textWithMultipleImgs = 'First equation <img class="equation_image" title="a > b" src="url1" alt="test1" /> and second equation <img class="equation_image" title="x < y" src="url2" alt="test2" />.';

            const escaped = exporter.escapeForHTML(textWithMultipleImgs);

            expect(escaped).toContain('title="a &gt; b"');
            expect(escaped).toContain('title="x &lt; y"');
            
            const imgTagMatches = escaped.match(/<img[^>]*>/g);
            expect(imgTagMatches).toHaveLength(2);
        });

        test('should handle img tags with various quote characters', () => {
            const textWithQuotes = '<img title="Text with quotes and apostrophes" src="test.png" />';

            const escaped = exporter.escapeImgTag(textWithQuotes);

            expect(escaped).toContain('title="Text with quotes and apostrophes"');
            expect(escaped).toContain('src="test.png"');
        });

        test('should not process LaTeX if img tags already present', () => {
            const textWithExistingImg = 'Already has <img src="test.png" /> so no $x = 2$ processing.';

            const processed = exporter.latexRenderer.prepareForQTI(textWithExistingImg);

            // Should return unchanged since img tags are already present
            expect(processed).toBe(textWithExistingImg);
            expect(processed).not.toContain('equation_image');
        });

        test('should generate valid QTI with img tags in question text', () => {
            const assessment = {
                title: 'Math Assessment',
                description: 'Test with equations',
                timeLimit: 0,
                questions: [
                    {
                        id: 1,
                        type: 'multiple_choice',
                        text: 'Given <img class="equation_image" title="f(x) = x^2" src="https://example.com/eq.png" alt="f(x) = x^2" /> what is the derivative?',
                        points: 1,
                        choices: [
                            { text: '2x', correct: true },
                            { text: 'x', correct: false }
                        ],
                        correctAnswer: 0
                    }
                ]
            };

            const qti = exporter.generateQTI(assessment);
            const validation = exporter.validateXML(qti);

            expect(validation.isValid).toBe(true);
            expect(qti).toContain('title="f(x) = x^2"');
            expect(qti).not.toContain('title="f(x) = x^2&quot; src=&quot;');
        });
    });

    describe('XML Validation', () => {
        test('should validate correct XML structure', () => {
            const validXML = '<?xml version="1.0"?><root><child>content</child></root>';
            
            const result = exporter.validateXML(validXML);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should detect missing XML declaration', () => {
            const invalidXML = '<root><child>content</child></root>';
            
            const result = exporter.validateXML(invalidXML);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing XML declaration');
        });

        test('should detect unclosed tags', () => {
            const invalidXML = '<?xml version="1.0"?><root><child>content</root>';
            
            const result = exporter.validateXML(invalidXML);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.includes('Unclosed tags'))).toBe(true);
        });

        test('should detect mismatched tags', () => {
            const invalidXML = '<?xml version="1.0"?><root><child>content</wrong></root>';
            
            const result = exporter.validateXML(invalidXML);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.includes('Mismatched closing tag'))).toBe(true);
        });

        test('should handle self-closing tags correctly', () => {
            const xmlWithSelfClosing = '<?xml version="1.0"?><root><img src="test.png" /><br /></root>';
            
            const result = exporter.validateXML(xmlWithSelfClosing);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('Utility Functions', () => {
        test('should generate unique IDs', () => {
            const id1 = exporter.generateId();
            const id2 = exporter.generateId();

            expect(id1).toMatch(/^i[a-z0-9]+$/);
            expect(id2).toMatch(/^i[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });

        test('should generate proper question IDs', () => {
            const questionId = exporter.generateQuestionId(5);

            expect(questionId).toMatch(/^question_5_i[a-z0-9]+$/);
        });

        test('should escape basic XML characters', () => {
            const text = 'Test & <script>"alert"</script>';
            const escaped = exporter.escapeXML(text);

            expect(escaped).toBe('Test &amp; &lt;script&gt;&quot;alert&quot;&lt;/script&gt;');
        });

        test('should handle empty and null values in escaping', () => {
            expect(exporter.escapeXML('')).toBe('');
            expect(exporter.escapeXML(null)).toBe('');
            expect(exporter.escapeXML(undefined)).toBe('');
        });
    });

    describe('XML Attribute Parsing', () => {
        test('should properly parse img tag boundaries with quotes in attributes', () => {
            const text = 'Text <img title="Value with > and < chars" src="url" alt="More > chars" /> more text';
            
            const escaped = exporter.escapeXMLAttributes(text);

            expect(escaped).toContain('title="Value with &gt; and &lt; chars"');
            expect(escaped).toContain('alt="More &gt; chars"');
            expect(escaped).toContain('more text');
        });

        test('should handle mixed quotes in attributes', () => {
            const imgTag = '<img title="Value with \'apostrophe\'" alt=\'Value with "quote"\' />';
            
            const escaped = exporter.escapeImgTag(imgTag);

            expect(escaped).toContain('title="Value with &#39;apostrophe&#39;"');
            expect(escaped).toContain('alt="Value with &quot;quote&quot;"');
        });

        test('should handle complex attribute values', () => {
            const complexImg = '<img data-content="Formula: a > b && c < d" title="Math: x² + y² = z²" />';
            
            const escaped = exporter.escapeImgTag(complexImg);

            expect(escaped).toContain('data-content="Formula: a &gt; b &amp;&amp; c &lt; d"');
            expect(escaped).toContain('title="Math: x² + y² = z²"');
        });
    });
});