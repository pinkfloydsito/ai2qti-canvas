import log from 'electron-log/main.js';

/**
 * Unified JSON extraction utility for all LLM providers
 * Handles common JSON parsing issues across different providers
 */
class JSONExtractor {
    
    /**
     * Extract and clean JSON from LLM response text
     * @param {string} text - Raw response text from LLM
     * @param {string} providerName - Name of the provider for logging
     * @returns {string} - Clean JSON string ready for parsing
     */
    static extractJSONFromResponse(text, providerName = 'LLM') {
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid response text provided to JSON extractor');
        }

        log.info(`[${providerName}] Extracting JSON from response: ${text.length} characters`);

        // Step 1: Remove markdown code blocks
        let cleaned = text.replace(/```json\s*|\s*```/g, '');
        
        // Step 2: Remove any text before the first { and after the last }
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No JSON object found in response');
        }

        cleaned = cleaned.substring(firstBrace, lastBrace + 1);

        // Step 3: Basic cleaning
        cleaned = cleaned
            .replace(/^\s*["']?json["']?\s*/, '') // Remove leading "json"
            .trim();

        log.info(`[${providerName}] Cleaned JSON candidate: ${cleaned.substring(0, 200)}...`);

        // Step 4: Try to parse as-is first
        try {
            const parsed = JSON.parse(cleaned);
            log.info(`[${providerName}] JSON parsed successfully on first attempt`);
            return cleaned;
        } catch (error) {
            log.warn(`[${providerName}] Initial JSON parse failed: ${error.message}`);
        }

        // Step 5: Apply systematic repair techniques
        const repaired = this.repairJSON(cleaned, providerName);
        
        // Step 6: Validate repaired JSON
        try {
            const parsed = JSON.parse(repaired);
            log.info(`[${providerName}] JSON repair successful`);
            return repaired;
        } catch (repairError) {
            log.error(`[${providerName}] JSON repair failed: ${repairError.message}`);
            throw new Error(`Invalid JSON format: ${repairError.message}. Original text: ${text.substring(0, 200)}...`);
        }
    }

    /**
     * Apply systematic JSON repair techniques
     * @param {string} jsonStr - JSON string to repair
     * @param {string} providerName - Provider name for logging
     * @returns {string} - Repaired JSON string
     */
    static repairJSON(jsonStr, providerName) {
        let repaired = jsonStr;

        log.info(`[${providerName}] Attempting to repair JSON...`);

        // Step 1: Fix common structural issues
        repaired = repaired
            .replace(/,\s*}/g, '}')           // Remove trailing commas in objects
            .replace(/,\s*]/g, ']')           // Remove trailing commas in arrays
            .replace(/([^\\])\\([^\\"])/g, '$1\\\\$2') // Fix unescaped backslashes
            .replace(/\\\"/g, '"')            // Fix over-escaped quotes
            .replace(/"{2,}/g, '"')           // Fix multiple consecutive quotes
            .replace(/\n/g, '\\n')            // Escape newlines
            .replace(/\t/g, '\\t');           // Escape tabs

        // Step 2: Fix LaTeX-specific issues (common in educational content)
        repaired = this.fixLatexEscapes(repaired);

        // Step 3: Final structural cleanup
        repaired = repaired
            .replace(/\\\\+/g, '\\\\')        // Normalize multiple backslashes
            .trim();

        return repaired;
    }

    /**
     * Fix LaTeX escape sequences in JSON strings
     * @param {string} text - Text with potential LaTeX issues
     * @returns {string} - Text with fixed LaTeX escapes
     */
    static fixLatexEscapes(text) {
        let fixed = text;

        // Handle LaTeX commands in math expressions
        const latexPatterns = [
            // Math expressions with single $
            {
                pattern: /\$([^$]*?)\$/g,
                fix: (match, content) => {
                    const fixedContent = this.escapeLatexInMath(content);
                    return `$${fixedContent}$`;
                }
            },
            // Math expressions with double $$
            {
                pattern: /\$\$([^$]*?)\$\$/g,
                fix: (match, content) => {
                    const fixedContent = this.escapeLatexInMath(content);
                    return `$$${fixedContent}$$`;
                }
            }
        ];

        latexPatterns.forEach(({ pattern, fix }) => {
            fixed = fixed.replace(pattern, fix);
        });

        return fixed;
    }

    /**
     * Escape LaTeX commands within math expressions
     * @param {string} mathContent - Content within LaTeX math delimiters
     * @returns {string} - Properly escaped LaTeX content
     */
    static escapeLatexInMath(mathContent) {
        return mathContent
            // Fix common LaTeX commands
            .replace(/\\([a-zA-Z]+)/g, '\\\\$1')
            // Fix specific symbols that need escaping
            .replace(/\\(\{|\}|\[|\]|\|)/g, '\\\\$1')
            // Fix already escaped sequences (avoid double escaping)
            .replace(/\\\\\\\\([a-zA-Z]+)/g, '\\\\$1')
            // Fix specific symbols
            .replace(/\\\\circ/g, '\\\\circ')
            // Fix text commands
            .replace(/\\\\text\{([^}]*)\}/g, '\\\\text{$1}')
            // Fix fractions
            .replace(/\\\\frac\{([^}]*)\}\{([^}]*)\}/g, '\\\\frac{$1}{$2}');
    }

    /**
     * Validate that extracted JSON has the expected structure for questions
     * @param {string} jsonStr - JSON string to validate
     * @returns {Object} - Parsed questions object
     * @throws {Error} - If validation fails
     */
    static validateQuestionsStructure(jsonStr) {
        try {
            const parsed = JSON.parse(jsonStr);
            
            if (!parsed.questions || !Array.isArray(parsed.questions)) {
                throw new Error('Response must contain a "questions" array');
            }

            if (parsed.questions.length === 0) {
                throw new Error('Questions array cannot be empty');
            }

            // Validate each question has required fields
            parsed.questions.forEach((question, index) => {
                if (!question.type) {
                    throw new Error(`Question ${index + 1} missing "type" field`);
                }
                if (!question.text) {
                    throw new Error(`Question ${index + 1} missing "text" field`);
                }
                if (question.type === 'multiple_choice' && (!question.choices || !Array.isArray(question.choices))) {
                    throw new Error(`Question ${index + 1} of type "multiple_choice" missing "choices" array`);
                }
            });

            return parsed;
        } catch (error) {
            throw new Error(`Invalid questions structure: ${error.message}`);
        }
    }
}

export default JSONExtractor;