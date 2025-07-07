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

    // Step 1: Fix LaTeX-specific issues FIRST (before other repairs)
    repaired = this.fixLatexEscapes(repaired);

    // Step 2: Fix common structural issues
    repaired = repaired
      .replace(/,\s*}/g, '}')           // Remove trailing commas in objects
      .replace(/,\s*]/g, ']')           // Remove trailing commas in arrays
      .replace(/\n/g, '\\n')            // Escape newlines
      .replace(/\t/g, '\\t');           // Escape tabs

    // Step 3: Fix backslashes (but preserve LaTeX)
    repaired = this.fixBackslashes(repaired);

    return repaired.trim();
  }

  /**
   * Fix backslashes while preserving LaTeX syntax
   * @param {string} text - Text to fix
   * @returns {string} - Text with fixed backslashes
   */
  static fixBackslashes(text) {
    // Split by string boundaries to avoid touching LaTeX inside strings
    return text.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
      // Inside JSON strings, fix unescaped backslashes
      // But preserve LaTeX commands (single backslash followed by letter)
      const fixed = content
        // .replace(/\\(?![\\"/bfnrt]|u[0-9a-fA-F]{4}|[a-zA-Z])/g, '\\\\') // Fix unescaped backslashes
        .replace(/\\+/g, '\\')
        .replace(/([^\\])"/g, '$1\\"');
      return `"${fixed}"`;
    });
  }

  /**
   * Fix LaTeX escape sequences in JSON strings
   * @param {string} text - Text with potential LaTeX issues
   * @returns {string} - Text with fixed LaTeX escapes
   */
  static fixLatexEscapes(text) {
    let fixed = text;

    // Fix LaTeX expressions specifically - reduce double backslashes to single
    const mathPatterns = [
      // Single $ delimiters - fix backslashes inside
      {
        pattern: /"\$([^"]*?)\$"/g,
        fix: (match, content) => {
          const cleanContent = content.replace(/\\+/g, '\\'); // Multiple backslashes → single
          return `"$${cleanContent}$"`;
        }
      },
      // Double $$ delimiters - fix backslashes inside  
      {
        pattern: /"\$\$([^"]*?)\$\$"/g,
        fix: (match, content) => {
          const cleanContent = content.replace(/\\+/g, '\\'); // Multiple backslashes → single
          return `"$$${cleanContent}$$"`;
        }
      },
      // Unquoted LaTeX expressions
      {
        pattern: /\$([^$"]*?)\$/g,
        fix: (match, content) => {
          const cleanContent = content.replace(/\\+/g, '\\');
          return `"$${cleanContent}$"`;
        }
      }
    ];

    mathPatterns.forEach(({ pattern, fix }) => {
      fixed = fixed.replace(pattern, fix);
    });

    return fixed;
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
