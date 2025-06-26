const LaTeXRenderer = require('./latex-renderer');

/**
 * QTI Exporter - Handles QTI XML generation and validation
 * Decoupled from the renderer for better separation of concerns
 */
class QTIExporter {
    constructor() {
        this.latexRenderer = new LaTeXRenderer();
    }

    /**
     * Generate QTI XML from assessment data
     * @param {Object} assessment - Assessment object with title, description, timeLimit, questions
     * @returns {string} QTI XML string
     */
    generateQTI(assessment) {
        const assessmentId = this.generateId();
        const timestamp = new Date().toISOString();
        
        let qti = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <assessment ident="${assessmentId}" title="${this.escapeXML(assessment.title)}">
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

        // Add Canvas-specific metadata for math support
        qti += `
      <qtimetadatafield>
        <fieldlabel>cc_canvas_math_rendering</fieldlabel>
        <fieldentry>true</fieldentry>
      </qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
      <qtimetadata>
        <qtimetadatafield>
          <fieldlabel>question_references</fieldlabel>
          <fieldentry>${assessment.questions.map(q => this.generateQuestionId(q.id)).join(',')}</fieldentry>
        </qtimetadatafield>
      </qtimetadata>`;

        assessment.questions.forEach(question => {
            qti += this.generateQuestionXML(question);
        });

        qti += `
    </section>
  </assessment>
</questestinterop>`;

        return qti;
    }

    /**
     * Generate XML for a single question
     * @param {Object} question - Question object
     * @returns {string} Question XML
     */
    generateQuestionXML(question) {
        const questionId = this.generateQuestionId(question.id);
        
        switch (question.type) {
            case 'multiple_choice':
                return this.generateMultipleChoiceXML(question, questionId);
            case 'true_false':
                return this.generateTrueFalseXML(question, questionId);
            case 'short_answer':
            case 'fill_in_blank':
                return this.generateShortAnswerXML(question, questionId);
            case 'essay':
                return this.generateEssayXML(question, questionId);
            default:
                return '';
        }
    }

    /**
     * Generate multiple choice question XML
     */
    generateMultipleChoiceXML(question, questionId) {
        let xml = `
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
            <mattext texttype="text/html">${this.escapeForHTML(question.text)}</mattext>
          </material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>`;

        question.choices.forEach((choice, index) => {
            xml += `
              <response_label ident="${index}">
                <material>
                  <mattext texttype="text/html">${this.escapeForHTML(choice.text)}</mattext>
                </material>
              </response_label>`;
        });

        xml += `
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

        return xml;
    }

    /**
     * Generate true/false question XML
     */
    generateTrueFalseXML(question, questionId) {
        const correctValue = question.correctAnswer === 'true' ? 'True' : 'False';
        
        return `
      <item ident="${questionId}" title="Question ${question.id}">
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
            <mattext texttype="text/html">${this.escapeForHTML(question.text)}</mattext>
          </material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>
              <response_label ident="True">
                <material>
                  <mattext texttype="text/html">True</mattext>
                </material>
              </response_label>
              <response_label ident="False">
                <material>
                  <mattext texttype="text/html">False</mattext>
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
    }

    /**
     * Generate short answer question XML
     */
    generateShortAnswerXML(question, questionId) {
        return `
      <item ident="${questionId}" title="Question ${question.id}">
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
            <mattext texttype="text/html">${this.escapeForHTML(question.text)}</mattext>
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
    }

    /**
     * Generate essay question XML
     */
    generateEssayXML(question, questionId) {
        return `
      <item ident="${questionId}" title="Question ${question.id}">
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
            <mattext texttype="text/html">${this.escapeForHTML(question.text)}</mattext>
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
    }

    /**
     * Validate XML structure - FIXED to handle XML entities properly
     */
    validateXML(xmlString) {
        const errors = [];
        
        try {
            // Basic XML structure validation
            if (!xmlString.trim().startsWith('<?xml')) {
                errors.push('Missing XML declaration');
            }
            
            // 1. First, temporarily replace all valid XML entities to avoid false positives
            const entityPlaceholders = {
                '&amp;': '___AMP___',
                '&lt;': '___LT___',
                '&gt;': '___GT___',
                '&quot;': '___QUOT___',
                '&#39;': '___APOS___'
            };
            
            let tempXML = xmlString;
            Object.entries(entityPlaceholders).forEach(([entity, placeholder]) => {
                tempXML = tempXML.replace(new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), placeholder);
            });
            
            // 2. Now check for truly problematic patterns in the cleaned XML
            const problematicPatterns = [
                { 
                    pattern: /[^_]&[^_]/g, 
                    message: 'Unescaped ampersand'
                },
                { 
                    pattern: /="[^"]*'[^"]*"/g, 
                    message: 'Unescaped single quote in double-quoted attribute'
                },
                { 
                    pattern: /='[^']*"[^']*'/g, 
                    message: 'Unescaped double quote in single-quoted attribute'
                }
            ];
            
            problematicPatterns.forEach(({ pattern, message }) => {
                const matches = tempXML.match(pattern);
                if (matches) {
                    errors.push(`${message}: Found ${matches.length} instances`);
                }
            });
            
            // 3. Check for proper tag nesting using a more robust approach
            const tagStack = [];
            const selfClosingTags = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
            
            // More precise tag pattern that handles self-closing tags and attributes properly
            const tagPattern = /<(\/)?([\w:-]+)(?:\s[^>]*?)?(\/)?>/g;
            let match;
            
            while ((match = tagPattern.exec(xmlString)) !== null) {
                const isClosing = !!match[1];
                const tagName = match[2].toLowerCase();
                const isSelfClosing = !!match[3] || selfClosingTags.has(tagName);
                
                if (isClosing) {
                    if (tagStack.length === 0) {
                        errors.push(`Unexpected closing tag: ${tagName}`);
                    } else {
                        const expectedTag = tagStack.pop();
                        if (expectedTag !== tagName) {
                            errors.push(`Mismatched closing tag: expected ${expectedTag}, got ${tagName}`);
                            // Try to recover by putting the expected tag back
                            tagStack.push(expectedTag);
                        }
                    }
                } else if (!isSelfClosing) {
                    tagStack.push(tagName);
                }
            }
            
            if (tagStack.length > 0) {
                errors.push(`Unclosed tags: ${tagStack.join(', ')}`);
            }
            
        } catch (error) {
            errors.push(`XML parsing error: ${error.message}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Escape text for HTML content while preserving LaTeX img tags
     */
    escapeForHTML(text) {
        if (!text) return '';
        
        // First process LaTeX for QTI - this generates HTML img tags
        const processedText = this.latexRenderer.prepareForQTI(text);
        
        // Comprehensive XML attribute escaping
        return this.escapeXMLAttributes(processedText);
    }

    /**
     * Properly escape XML attributes while preserving HTML structure
     */
    escapeXMLAttributes(text) {
        if (!text) return '';
        
        // Split text into parts: img tags and regular text
        const parts = [];
        let currentPos = 0;
        
        while (currentPos < text.length) {
            const imgStart = text.indexOf('<img', currentPos);
            if (imgStart === -1) {
                // No more img tags, add remaining text
                parts.push({
                    type: 'text',
                    content: text.substring(currentPos)
                });
                break;
            }
            
            // Add text before img tag
            if (imgStart > currentPos) {
                parts.push({
                    type: 'text',
                    content: text.substring(currentPos, imgStart)
                });
            }
            
            // Find img tag end properly, considering quotes and self-closing tags
            let imgEnd = imgStart;
            let inQuotes = false;
            let quoteChar = '';
            
            for (let i = imgStart + 4; i < text.length; i++) {
                const char = text[i];
                
                if (!inQuotes && (char === '"' || char === "'")) {
                    inQuotes = true;
                    quoteChar = char;
                } else if (inQuotes && char === quoteChar) {
                    inQuotes = false;
                    quoteChar = '';
                } else if (!inQuotes && char === '>') {
                    imgEnd = i;
                    break;
                }
            }
            
            if (imgEnd === imgStart) {
                // Couldn't find proper end, treat as text
                parts.push({
                    type: 'text',
                    content: text.substring(currentPos, imgStart + 4)
                });
                currentPos = imgStart + 4;
                continue;
            }
            
            // Add img tag
            parts.push({
                type: 'img',
                content: text.substring(imgStart, imgEnd + 1)
            });
            
            currentPos = imgEnd + 1;
        }
        
        // Process each part
        return parts.map(part => {
            if (part.type === 'img') {
                // For img tags, escape attribute values properly
                return this.escapeImgTag(part.content);
            } else {
                // For regular text, escape XML characters
                return part.content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }
        }).join('');
    }

    /**
     * Escape img tag attributes properly
     */
    escapeImgTag(imgTag) {
        // Simple and robust approach: parse attributes with a more permissive regex
        const attributes = [];
        
        // Extract tag name
        const tagNameMatch = imgTag.match(/^<(\w+)/);
        if (!tagNameMatch) return imgTag;
        const tagName = tagNameMatch[1];
        
        // Find all attributes using a simple pattern that handles quotes better
        const attrPattern = /(\w+(?:-\w+)*)=(['"])(.*?)\2/g;
        let match;
        
        while ((match = attrPattern.exec(imgTag)) !== null) {
            const [, attrName, , attrValue] = match;
            
            // Escape the attribute value for XML
            const escapedValue = attrValue
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            
            attributes.push(`${attrName}="${escapedValue}"`);
        }
        
        // Reconstruct the tag
        const selfClosing = imgTag.includes('/>') ? ' />' : '>';
        return `<${tagName} ${attributes.join(' ')}${selfClosing}`;
    }

    /**
     * Basic XML escaping for simple text
     */
    escapeXML(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return 'i' + Math.random().toString(36).substring(2, 15);
    }

    /**
     * Generate question ID
     */
    generateQuestionId(questionNum) {
        return `question_${questionNum}_${this.generateId()}`;
    }
}

module.exports = QTIExporter;