const LaTeXRenderer = require('../src/latex-renderer');

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