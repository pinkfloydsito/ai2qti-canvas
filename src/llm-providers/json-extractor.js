import log from 'electron-log/main.js';
import { jsonrepair } from 'jsonrepair'

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

      // Even if JSON is valid, we still need to apply LaTeX fixes for double backslashes
      const latexFixed = this.fixLatexEscapes(cleaned);
      if (latexFixed !== cleaned) {
        log.info(`[${providerName}] Applied LaTeX fixes to valid JSON`);
        return latexFixed;
      }

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
  static repairJSON(jsonStr, providerName = 'unknown') {
    const original = String(jsonStr ?? '');

    log.info(`[${providerName}] Attempting to repair JSON...`);

    // Handle empty or whitespace-only strings
    if (!original.trim()) {
      return '{}';
    }

    return pipe(
      original,
      jsonrepair,                    // structural repair
      s => s.trim()
    );
  }

  static stripLeadingJunk(s) {
    const match = s.match(/[{[]/);
    return match ? s.slice(match.index) : s;
  }

  /** Strip UTF-8 BOM if present */
  static removeByteOrderMark(s) {
    return s.replace(/^\uFEFF/, '');
  }

  /** Turn the literal two-char sequence “\n” into a real line-feed etc. */
  static unescapeLiteralEscapes(s) {
    return s
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  /** Remove trailing commas before ] or } */
  static removeTrailingCommas(s) {
    return s
      .replace(/,(\s*[\]}])/g, '$1');
  }

  /** Turn real control chars into safe JSON escapes */
  static escapeControlChars(s) {
    return s
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');
  }

  /** Ensure LaTeX commands are single-escaped (\\cmd, not \\\cmd) */
  static fixLatexEscapes(s) {
    return s
      .replace(/(^|[^\\])(\\\\)+([a-zA-Z]+)/g, '$1\\$3');
  }

  /** Deduplicate backslashes that are *not* part of LaTeX */
  static fixBackslashes(s) {
    // naive: collapse >2 backslashes down to 2, leave LaTeX alone
    return s
      .replace(/(\\{3,})(?=[^a-zA-Z]|$)/g, '\\\\');
  }

  /* ---------------------------------------------------------------------- */
  /* tiny helper – left-to-right compose                                    */
  /* ---------------------------------------------------------------------- */

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

const pipe = (x, ...fns) => fns.reduce((v, f) => f(v), x);

export default JSONExtractor;
