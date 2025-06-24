const katex = require('katex');

class LaTeXRenderer {
    constructor() {
        this.katexOptions = {
            throwOnError: false,
            errorColor: '#cc0000',
            displayMode: false
        };
    }

    // Render LaTeX in text, handling both inline ($...$) and display ($$...$$) math
    renderMath(text) {
        if (!text) return '';
        
        let rendered = text;
        
        // First handle display math ($$...$$)
        rendered = rendered.replace(/\$\$(.*?)\$\$/g, (match, latex) => {
            try {
                return katex.renderToString(latex.trim(), {
                    ...this.katexOptions,
                    displayMode: true
                });
            } catch (error) {
                console.warn('LaTeX render error (display):', error);
                return `<span class="katex-error">$$${latex}$$</span>`;
            }
        });
        
        // Then handle inline math ($...$)
        rendered = rendered.replace(/\$([^$]+)\$/g, (match, latex) => {
            try {
                return katex.renderToString(latex.trim(), {
                    ...this.katexOptions,
                    displayMode: false
                });
            } catch (error) {
                console.warn('LaTeX render error (inline):', error);
                return `<span class="katex-error">$${latex}$</span>`;
            }
        });
        
        return rendered;
    }

    // Render math for DOM element
    renderMathInElement(element) {
        if (!element) return;
        
        const textNodes = this.getTextNodes(element);
        
        textNodes.forEach(node => {
            const text = node.textContent;
            if (text.includes('$')) {
                const rendered = this.renderMath(text);
                if (rendered !== text) {
                    const wrapper = document.createElement('span');
                    wrapper.innerHTML = rendered;
                    node.parentNode.replaceChild(wrapper, node);
                }
            }
        });
    }

    // Get all text nodes in an element
    getTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        return textNodes;
    }

    // Preview math as user types
    previewMath(inputText, previewElement) {
        if (!previewElement) return;
        
        if (inputText.includes('$')) {
            const rendered = this.renderMath(inputText);
            previewElement.innerHTML = `<div class="math-preview-content">${rendered}</div>`;
            previewElement.style.display = 'block';
        } else {
            previewElement.style.display = 'none';
        }
    }

    // Validate LaTeX syntax
    validateLaTeX(text) {
        const errors = [];
        
        // Check for unmatched delimiters
        const dollarsCount = (text.match(/\$/g) || []).length;
        if (dollarsCount % 2 !== 0) {
            errors.push('Unmatched $ delimiters');
        }
        
        // Check for unmatched $$ delimiters
        const doubleDollarsCount = (text.match(/\$\$/g) || []).length;
        if (doubleDollarsCount % 2 !== 0) {
            errors.push('Unmatched $$ delimiters');
        }
        
        // Try to render each math expression to catch syntax errors
        const mathExpressions = [
            ...text.match(/\$\$(.*?)\$\$/g) || [],
            ...text.match(/\$([^$]+)\$/g) || []
        ];
        
        mathExpressions.forEach((expr, index) => {
            const latex = expr.replace(/\$+/g, '');
            try {
                katex.renderToString(latex, { throwOnError: true });
            } catch (error) {
                errors.push(`Math expression ${index + 1}: ${error.message}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Convert LaTeX to MathML for QTI export
    latexToMathML(latex) {
        try {
            return katex.renderToString(latex, {
                output: 'mathml',
                throwOnError: true
            });
        } catch (error) {
            console.warn('LaTeX to MathML conversion error:', error);
            return `<math><merror><mtext>${latex}</mtext></merror></math>`;
        }
    }

    // Process text for QTI export (convert LaTeX to MathML)
    prepareForQTI(text) {
        if (!text) return '';
        
        let processed = text;
        
        // Convert display math ($$...$$) to MathML
        processed = processed.replace(/\$\$(.*?)\$\$/g, (match, latex) => {
            const mathml = this.latexToMathML(latex.trim());
            return `<div class="math-display">${mathml}</div>`;
        });
        
        // Convert inline math ($...$) to MathML
        processed = processed.replace(/\$([^$]+)\$/g, (match, latex) => {
            const mathml = this.latexToMathML(latex.trim());
            return `<span class="math-inline">${mathml}</span>`;
        });
        
        return processed;
    }

    // Common math symbols and their LaTeX codes for help
    getMathSymbols() {
        return {
            'Greek Letters': {
                'α': '\\alpha',
                'β': '\\beta',
                'γ': '\\gamma',
                'δ': '\\delta',
                'ε': '\\epsilon',
                'θ': '\\theta',
                'λ': '\\lambda',
                'μ': '\\mu',
                'π': '\\pi',
                'σ': '\\sigma',
                'φ': '\\phi',
                'ω': '\\omega'
            },
            'Operators': {
                '±': '\\pm',
                '∓': '\\mp',
                '×': '\\times',
                '÷': '\\div',
                '≠': '\\neq',
                '≤': '\\leq',
                '≥': '\\geq',
                '∞': '\\infty',
                '∂': '\\partial',
                '∇': '\\nabla',
                '∫': '\\int',
                '∑': '\\sum',
                '∏': '\\prod'
            },
            'Fractions & Powers': {
                'Fraction': '\\frac{a}{b}',
                'Square root': '\\sqrt{x}',
                'Nth root': '\\sqrt[n]{x}',
                'Superscript': 'x^{2}',
                'Subscript': 'x_{1}'
            },
            'Calculus': {
                'Integral': '\\int_{a}^{b} f(x) dx',
                'Limit': '\\lim_{x \\to \\infty}',
                'Derivative': '\\frac{d}{dx}',
                'Partial': '\\frac{\\partial f}{\\partial x}'
            }
        };
    }
}

module.exports = LaTeXRenderer;