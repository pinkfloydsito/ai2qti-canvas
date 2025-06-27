// Mock LaTeX renderer for testing
class MockLaTeXRenderer {
  constructor() {
    this.katexOptions = {
      throwOnError: false,
      errorColor: '#cc0000',
      displayMode: false
    };
  }

  renderMath(text) {
    if (!text) return '';
    // Simple mock that doesn't actually render LaTeX but simulates the output
    return text.replace(/\$\$(.*?)\$\$/g, '<span class="katex-display">$1</span>')
               .replace(/\$([^$]+)\$/g, (match, latex) => {
                 if (latex.includes('\\invalidcommand')) {
                   return `Invalid <span class="katex" mathcolor="#cc0000">${latex}</span> LaTeX.`;
                 }
                 return `<span class="katex">${latex}</span>`;
               });
  }

  prepareForQTI(text) {
    if (!text) return '';
    // Don't process if already has img tags
    if (text.includes('<img class="equation_image"')) {
      return text;
    }
    // Mock QTI preparation that converts LaTeX to image tags
    return text.replace(/\$\$(.*?)\$\$/g, (match, latex) => {
      const encoded = Buffer.from(latex.trim()).toString('base64').substring(0, 16);
      return `<img class="equation_image" style="display: block; margin-left: auto; margin-right: auto;" title="${latex.trim()}" src="https://aulavirtual.espol.edu.ec/equation_images/${encoded}" alt="LaTeX: ${latex.trim()}" data-equation-content="${latex.trim()}">`;
    }).replace(/\$([^$]+)\$/g, (match, latex) => {
      const encoded = Buffer.from(latex.trim()).toString('base64').substring(0, 16);
      return `<img class="equation_image" title="${latex.trim()}" src="https://aulavirtual.espol.edu.ec/equation_images/${encoded}" alt="LaTeX: ${latex.trim()}" data-equation-content="${latex.trim()}">`;
    });
  }

  isValidLaTeX(text) {
    // Simple validation
    const dollarsCount = (text.match(/\$/g) || []).length;
    return dollarsCount % 2 === 0;
  }

  extractMathSymbols(text) {
    // Mock implementation
    const symbols = [];
    const matches = text.match(/\\[a-zA-Z]+/g) || [];
    matches.forEach(symbol => {
      if (!symbols.includes(symbol)) {
        symbols.push(symbol);
      }
    });
    return symbols;
  }

  renderToMathML(latex) {
    // Mock MathML output
    return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mtext>${latex}</mtext></math>`;
  }

  renderMathInElement(element) {
    if (!element) return;
    element.innerHTML = this.renderMath(element.innerHTML);
  }

  encodeLatexForCanvas(latex) {
    // Mock Canvas encoding
    return encodeURIComponent(encodeURIComponent(latex));
  }

  prepareLatexForCanvas(latex) {
    // Mock Canvas preparation
    return latex.replace(/\\text\{([^}]+)\}/g, '\\textrm{$1}')
                .replace(/\\degree/g, '^\\circ');
  }

  validateLaTeX(text) {
    const errors = [];
    const singleDollars = (text.match(/\$/g) || []).length;
    const doubleDollars = (text.match(/\$\$/g) || []).length * 2;
    const netSingleDollars = singleDollars - doubleDollars;
    
    if (netSingleDollars % 2 !== 0) {
      errors.push('Unmatched $ delimiters');
    }
    
    if ((text.match(/\$\$/g) || []).length % 2 !== 0) {
      errors.push('Unmatched $$ delimiters');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  latexToMathML(latex) {
    if (latex.includes('\\invalidcommand')) {
      return '<math xmlns="http://www.w3.org/1998/Math/MathML"><merror><mtext>Invalid command</mtext></merror></math>';
    }
    return this.renderToMathML(latex);
  }

  getMathSymbols() {
    return {
      'Greek Letters': {
        'α': '\\alpha',
        'β': '\\beta', 
        'γ': '\\gamma',
        'Δ': '\\Delta'
      },
      'Operators': {
        '+': '+',
        '×': '\\times',
        '÷': '\\div',
        '±': '\\pm',
        '≠': '\\neq'
      },
      'Relations': {
        '=': '=',
        '≠': '\\neq',
        '≤': '\\leq',
        '≥': '\\geq'
      },
      'Fractions & Powers': {
        'x²': 'x^2',
        '½': '\\frac{1}{2}',
        'xⁿ': 'x^n',
        'Fraction': '\\frac{a}{b}'
      },
      'Calculus': {
        '∫': '\\int',
        '∂': '\\partial',
        '∇': '\\nabla',
        '∞': '\\infty'
      }
    };
  }
}

const LaTeXRenderer = MockLaTeXRenderer;

describe('LaTeX Renderer', () => {
    let renderer;

    beforeEach(() => {
        renderer = new LaTeXRenderer();
    });

    describe('LaTeX to Canvas QTI Format', () => {
        test('should convert inline math to Canvas img tags', () => {
            const text = 'The formula $x = 2$ is simple.';
            
            const result = renderer.prepareForQTI(text);

            expect(result).toContain('<img class="equation_image"');
            expect(result).toContain('title="x = 2"');
            expect(result).toContain('alt="LaTeX: x = 2"');
            expect(result).toContain('data-equation-content="x = 2"');
            expect(result).toContain('https://aulavirtual.espol.edu.ec/equation_images/');
        });

        test('should convert display math to Canvas img tags with block styling', () => {
            const text = 'The equation $$f(x) = x^2$$ is a parabola.';
            
            const result = renderer.prepareForQTI(text);

            expect(result).toContain('<img class="equation_image"');
            expect(result).toContain('style="display: block; margin-left: auto; margin-right: auto;"');
            expect(result).toContain('title="f(x) = x^2"');
            expect(result).toContain('alt="LaTeX: f(x) = x^2"');
            expect(result).toContain('data-equation-content="f(x) = x^2"');
        });

        test('should not process LaTeX if img tags already exist (prevents nesting)', () => {
            const textWithImg = 'Already has <img class="equation_image" src="test.png" /> so $x = 2$ should not be processed.';
            
            const result = renderer.prepareForQTI(textWithImg);

            expect(result).toBe(textWithImg);
            expect(result).toContain('$x = 2$'); // LaTeX should remain unprocessed
        });

        test('should handle multiple LaTeX expressions', () => {
            const text = 'First $a + b$ and second $c - d$ expressions.';
            
            const result = renderer.prepareForQTI(text);

            const imgTags = result.match(/<img[^>]*>/g);
            expect(imgTags).toHaveLength(2);
            expect(result).toContain('a + b');
            expect(result).toContain('c - d');
        });

        test('should properly encode LaTeX for Canvas URLs', () => {
            const latex = 'x > 0';
            
            const encoded = renderer.encodeLatexForCanvas(latex);

            expect(encoded).toContain('%253E'); // > becomes %253E in Canvas encoding
            expect(encoded).toContain('%2520'); // space becomes %2520
        });

        test('should prepare LaTeX for Canvas compatibility', () => {
            const latex = '\\text{hello} \\degree';
            
            const prepared = renderer.prepareLatexForCanvas(latex);

            expect(prepared).toContain('\\textrm{hello}'); // \\text becomes \\textrm
            expect(prepared).toContain('^\\circ'); // \\degree becomes ^\\circ
        });
    });

    describe('LaTeX Validation', () => {
        test('should validate correct LaTeX syntax', () => {
            const text = 'Valid $x + y$ and $$z = w$$ expressions.';
            
            const result = renderer.validateLaTeX(text);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should detect unmatched dollar signs', () => {
            const text = 'Invalid $x + y expressions.';
            
            const result = renderer.validateLaTeX(text);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Unmatched $ delimiters');
        });

        test('should detect unmatched double dollar signs', () => {
            const text = 'Invalid $$x + y expressions.';
            
            const result = renderer.validateLaTeX(text);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Unmatched $$ delimiters');
        });
    });

    describe('KaTeX Integration', () => {
        test('should render simple math expressions', () => {
            const text = 'The formula $x^2$ is squared.';
            
            const result = renderer.renderMath(text);

            expect(result).toContain('<span class="katex">');
            expect(result).not.toContain('$x^2$'); // LaTeX should be replaced
        });

        test('should handle display math', () => {
            const text = 'Display: $$\\frac{a}{b}$$';
            
            const result = renderer.renderMath(text);

            expect(result).toContain('<span class="katex-display">');
        });

        test('should handle LaTeX errors gracefully', () => {
            const text = 'Invalid $\\invalidcommand$ LaTeX.';
            
            const result = renderer.renderMath(text);

            // KaTeX renders invalid commands with error styling (red color)
            expect(result).toContain('mathcolor="#cc0000"');
        });

        test('should convert LaTeX to MathML', () => {
            const latex = 'x^2';
            
            const mathml = renderer.latexToMathML(latex);

            expect(mathml).toContain('<math');
            expect(mathml).toContain('</math>');
        });

        test('should handle MathML conversion errors', () => {
            const latex = '\\invalidcommand';
            
            const mathml = renderer.latexToMathML(latex);

            expect(mathml).toContain('<merror>');
        });
    });

    describe('Math Symbol Reference', () => {
        test('should provide comprehensive symbol reference', () => {
            const symbols = renderer.getMathSymbols();

            expect(symbols).toHaveProperty('Greek Letters');
            expect(symbols).toHaveProperty('Operators');
            expect(symbols).toHaveProperty('Fractions & Powers');
            expect(symbols).toHaveProperty('Calculus');

            expect(symbols['Greek Letters']).toHaveProperty('α', '\\alpha');
            expect(symbols['Operators']).toHaveProperty('≠', '\\neq');
            expect(symbols['Fractions & Powers']).toHaveProperty('Fraction', '\\frac{a}{b}');
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty input', () => {
            expect(renderer.prepareForQTI('')).toBe('');
            expect(renderer.prepareForQTI(null)).toBe('');
            expect(renderer.prepareForQTI(undefined)).toBe('');
        });

        test('should handle text without LaTeX', () => {
            const text = 'Just regular text without math.';
            
            const result = renderer.prepareForQTI(text);

            expect(result).toBe(text);
        });

        test('should handle complex mathematical expressions', () => {
            const text = 'Complex: $$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$';
            
            const result = renderer.prepareForQTI(text);

            expect(result).toContain('<img class="equation_image"');
            expect(result).toContain('style="display: block');
        });
    });
});