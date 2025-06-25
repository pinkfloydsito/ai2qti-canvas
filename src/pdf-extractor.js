// Simple PDF text extraction for Electron
class PDFExtractor {
    constructor() {
        this.pdfParse = require('pdf-parse');
        this.setupPDFJS();
    }

    setupPDFJS() {
        try {
            // Configure PDFJS to work without external workers in Electron
            const pdfjs = require('pdfjs-dist');
            
            // Disable worker to avoid "workerSrc" issues in Electron
            pdfjs.GlobalWorkerOptions.workerSrc = null;
            
            // Use the legacy build that doesn't require workers
            this.pdfjs = pdfjs;
            
            console.log('PDF.js configured for Electron environment');
        } catch (error) {
            console.warn('PDF.js setup warning:', error.message);
        }
    }

    // Quick validation to avoid processing clearly invalid data
    isValidPDFBuffer(buffer) {
        if (!buffer || buffer.length < 10) {
            return false;
        }
        
        // Check for PDF header (%PDF-)
        const header = buffer.toString('ascii', 0, 5);
        if (!header.startsWith('%PDF-')) {
            return false;
        }
        
        // Check for EOF marker (%%EOF)
        const tail = buffer.toString('ascii', -10);
        if (!tail.includes('%%EOF')) {
            console.warn('PDF may be truncated or corrupted (no EOF marker)');
            // Don't fail here - some PDFs might still work
        }
        
        return true;
    }

    async extractText(pdfBuffer) {
        try {
            // Quick validation - check if buffer starts with PDF header
            if (!this.isValidPDFBuffer(pdfBuffer)) {
                throw new Error('Invalid PDF file format');
            }
            
            // Method 1: Direct PDFJS without pdf-parse wrapper
            const result = await this.directPDFJSParse(pdfBuffer);
            if (result) return result;
            
            // Method 2: Legacy PDF.js method (Mozilla GitHub implementation)
            const result2 = await this.legacyPDFJSParse(pdfBuffer);
            if (result2) return result2;
            
            // Method 3: Simple extraction without worker
            const result3 = await this.simpleParse(pdfBuffer);
            if (result3) return result3;
            
            // Method 4: Fallback with minimal options
            return await this.fallbackParse(pdfBuffer);
            
        } catch (error) {
            throw new Error(this.getHelpfulErrorMessage(error));
        }
    }

    async directPDFJSParse(pdfBuffer) {
        try {
            if (!this.pdfjs) {
                console.warn('PDF.js not available, skipping direct parse');
                return null;
            }

            // Convert Buffer to Uint8Array for PDF.js compatibility
            const uint8Array = new Uint8Array(pdfBuffer);
            
            const loadingTask = this.pdfjs.getDocument({
                data: uint8Array,
                disableWorker: true,
                isEvalSupported: false,
                disableCreateObjectURL: true,
                stopAtErrors: false
            });
            
            const pdf = await loadingTask.promise;
            let fullText = '';
            
            console.log(`Processing PDF with ${pdf.numPages} pages`);
            
            // Extract text from all pages (limit to first 20 pages for performance)
            const maxPages = Math.min(pdf.numPages, 20);
            for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
                try {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    
                    const pageText = textContent.items
                        .map(item => item.str)
                        .join(' ');
                    
                    fullText += pageText + '\n\n';
                    
                    // Clean up page resources
                    page.cleanup();
                } catch (pageError) {
                    console.warn(`Error processing page ${pageNum}:`, pageError.message);
                    continue;
                }
            }
            
            // Clean up PDF resources
            pdf.destroy();
            
            if (fullText.trim().length > 100) {
                console.log(`Direct PDFJS extraction successful: ${fullText.length} characters`);
                return this.cleanupText(fullText);
            }
            
            return null;
        } catch (error) {
            console.warn('Direct PDFJS parse failed:', error.message);
            return null;
        }
    }

    cleanupText(text) {
        return text
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            // Remove excessive newlines
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            // Clean up common PDF artifacts
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            // Remove page numbers and headers/footers (basic patterns)
            .replace(/^\d+\s*$/gm, '')
            .replace(/^Page \d+ of \d+\s*$/gm, '')
            .trim();
    }

    // Legacy PDF.js method using the GitHub Mozilla implementation
    async legacyPDFJSParse(pdfBuffer) {
        try {
            console.log('Attempting legacy PDF.js extraction...');
            
            // Use the older PDF.js version without worker requirements
            const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
            
            // Convert Buffer to ArrayBuffer for legacy PDF.js
            const arrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength);
            
            const loadingTask = pdfjs.getDocument({
                data: arrayBuffer,
                verbosity: 0, // Reduce console output
                fontExtraProperties: false
            });
            
            const pdf = await loadingTask.promise;
            let fullText = '';
            
            console.log(`Legacy PDF.js: Processing ${pdf.numPages} pages`);
            
            // Process pages with better error handling
            for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 15); pageNum++) {
                try {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    
                    // Extract text items and combine them intelligently
                    const textItems = textContent.items.map(item => {
                        // Handle different text item types
                        if (typeof item.str === 'string') {
                            return item.str;
                        }
                        return '';
                    }).filter(text => text.trim().length > 0);
                    
                    const pageText = textItems.join(' ');
                    if (pageText.trim()) {
                        fullText += pageText + '\n\n';
                    }
                    
                    console.log(`Legacy PDF.js: Page ${pageNum} extracted ${textItems.length} text items`);
                    
                } catch (pageError) {
                    console.warn(`Legacy PDF.js: Error on page ${pageNum}:`, pageError.message);
                    continue;
                }
            }
            
            if (fullText.trim().length > 200) {
                console.log(`Legacy PDF.js extraction successful: ${fullText.length} characters`);
                return this.cleanupText(fullText);
            }
            
            return null;
            
        } catch (error) {
            console.warn('Legacy PDF.js parse failed:', error.message);
            return null;
        }
    }

    async simpleParse(pdfBuffer) {
        try {
            const data = await this.pdfParse(pdfBuffer, {
                // Minimal configuration to avoid worker issues
                normalizeWhitespace: true,
                disableCombineTextItems: false,
                // Custom render options to avoid worker
                render_options: {
                    normalizeWhitespace: true,
                    disableCombineTextItems: false
                },
                // Force legacy mode
                max: 0
            });
            
            if (data.text && data.text.trim().length > 50) {
                console.log(`Simple parse successful: ${data.text.length} characters`);
                return this.cleanupText(data.text);
            }
            return null;
        } catch (error) {
            console.warn('Simple parse failed:', error.message);
            return null;
        }
    }

    async fallbackParse(pdfBuffer) {
        try {
            // Try with very basic options - last resort with pdf-parse
            const data = await this.pdfParse(pdfBuffer);
            
            if (data.text && data.text.trim()) {
                console.log(`Fallback parse successful: ${data.text.length} characters`);
                return this.cleanupText(data.text);
            } else {
                throw new Error('No text content found');
            }
        } catch (error) {
            // Final fallback - try to extract text using basic PDF structure parsing
            return await this.basicPDFTextExtraction(pdfBuffer);
        }
    }

    // Basic PDF text extraction as absolute last resort
    async basicPDFTextExtraction(pdfBuffer) {
        try {
            const pdfString = pdfBuffer.toString('latin1');
            
            // Look for text objects in PDF structure
            const textRegex = /\((.*?)\)\s*Tj/g;
            const texts = [];
            let match;
            
            while ((match = textRegex.exec(pdfString)) !== null) {
                if (match[1] && match[1].trim()) {
                    texts.push(match[1].trim());
                }
            }
            
            // Also look for BT...ET blocks (text blocks)
            const textBlockRegex = /BT\s+(.*?)\s+ET/gs;
            let blockMatch;
            
            while ((blockMatch = textBlockRegex.exec(pdfString)) !== null) {
                const block = blockMatch[1];
                const blockTexts = block.match(/\((.*?)\)/g);
                if (blockTexts) {
                    blockTexts.forEach(text => {
                        const cleanText = text.replace(/[()]/g, '').trim();
                        if (cleanText && cleanText.length > 2) {
                            texts.push(cleanText);
                        }
                    });
                }
            }
            
            if (texts.length > 0) {
                const extractedText = texts.join(' ');
                console.log(`Basic extraction found ${texts.length} text fragments`);
                
                if (extractedText.length > 100) {
                    return this.cleanupText(extractedText);
                }
            }
            
            throw new Error('No readable text found using basic extraction');
        } catch (error) {
            throw new Error('All PDF extraction methods failed. Please copy and paste the text manually.');
        }
    }

    getHelpfulErrorMessage(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('worker')) {
            return 'PDF worker error. Please copy and paste the text manually.';
        } else if (message.includes('invalid') || message.includes('corrupt')) {
            return 'Invalid or corrupted PDF file. Please try a different file.';
        } else if (message.includes('password') || message.includes('encrypted')) {
            return 'Password-protected PDF. Please unlock the PDF first or copy the text manually.';
        } else if (message.includes('no text')) {
            return 'No readable text found. This might be a scanned PDF - please copy the text manually.';
        } else {
            return 'Could not extract text from PDF. Please copy and paste the content manually into the text area.';
        }
    }

    // Static method for testing if PDF extraction is working
    static async test() {
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Create a simple test PDF buffer (minimal PDF)
            const testPDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000207 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n295\n%%EOF');
            
            const extractor = new PDFExtractor();
            await extractor.extractText(testPDF);
            return true;
        } catch (error) {
            console.warn('PDF extraction test failed:', error.message);
            return false;
        }
    }
}

module.exports = PDFExtractor;