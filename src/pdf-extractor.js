// PDF EXTRACTOR DISABLED - This entire file is disabled to avoid DOMMatrix issues on Windows
// All PDF functionality has been removed to prevent compatibility issues

// Simple disabled PDF text extraction for Electron
class PDFExtractor {
  constructor() {
    console.warn('PDF Extractor has been disabled');
  }

  async extractText(pdfBuffer) {
    throw new Error('PDF extraction is disabled. Please paste text directly into the text area.');
  }

  isValidPDFBuffer(buffer) {
    return false;
  }

  cleanupText(text) {
    return text;
  }

  getHelpfulErrorMessage(error) {
    return 'PDF extraction is disabled. Please paste text directly into the text area.';
  }
}

export default PDFExtractor;