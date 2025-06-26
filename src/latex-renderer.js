import katex from 'katex';

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

  // Process text for QTI export (Canvas LMS compatible format)
  prepareForQTI(text) {
    if (!text) return '';

    let processed = text;

    // Skip processing if text already contains img tags to prevent nesting
    if (processed.includes('<img')) {
      return processed;
    }

    // Canvas LMS expects LaTeX in img tags with equation_image class
    // Convert display math ($$...$$) to Canvas-compatible format
    processed = processed.replace(/\$\$(.*?)\$\$/g, (match, latex) => {
      const cleanLatex = this.prepareLatexForCanvas(latex.trim());
      const encodedLatex = this.encodeLatexForCanvas(cleanLatex);
      const baseUrl = 'https://aulavirtual.espol.edu.ec/equation_images/';

      return `<img class="equation_image" style="display: block; margin-left: auto; margin-right: auto;" title="${cleanLatex}" src="${baseUrl}${encodedLatex}" alt="LaTeX: ${cleanLatex}" data-equation-content="${cleanLatex}" />`;
    });

    // Convert inline math ($...$) to Canvas-compatible format  
    processed = processed.replace(/\$([^$]+)\$/g, (match, latex) => {
      const cleanLatex = this.prepareLatexForCanvas(latex.trim());
      const encodedLatex = this.encodeLatexForCanvas(cleanLatex);
      const baseUrl = 'https://aulavirtual.espol.edu.ec/equation_images/';

      return `<img class="equation_image" title="${cleanLatex}" src="${baseUrl}${encodedLatex}" alt="LaTeX: ${cleanLatex}" data-equation-content="${cleanLatex}" />`;
    });

    return processed;
  }

  // Prepare LaTeX for Canvas LMS compatibility
  prepareLatexForCanvas(latex) {
    return latex
      // Ensure proper escaping for Canvas
      .replace(/\\\\/g, '\\\\')
      // Fix common Canvas LaTeX issues
      .replace(/\\text\{([^}]*)\}/g, '\\textrm{$1}') // Canvas prefers \textrm over \text
      .replace(/\\degree/g, '^\\circ') // Degree symbol compatibility
      .replace(/°/g, '^\\circ') // Convert degree symbol to LaTeX
      // Ensure fractions are properly formatted
      .replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '\\frac{$1}{$2}');
  }

  // Encode LaTeX for Canvas equation image URLs
  encodeLatexForCanvas(latex) {
    // Canvas uses a specific URL encoding for LaTeX equations
    // Based on sample.xml pattern: \frac{k}{2} becomes %255Cfrac%257Bk%257D%257B2%257D
    return encodeURIComponent(latex)
      // Double encode certain characters as seen in Canvas URLs
      .replace(/%/g, '%25')
      .replace(/\\/g, '%255C')
      .replace(/{/g, '%257B')
      .replace(/}/g, '%257D')
      .replace(/\(/g, '%2528')
      .replace(/\)/g, '%2529')
      .replace(/\[/g, '%255B')
      .replace(/\]/g, '%255D')
      .replace(/ /g, '%2520')
      .replace(/=/g, '%253D')
      .replace(/\+/g, '%252B')
      .replace(/,/g, '%252C')
      .replace(/:/g, '%253A')
      .replace(/\^/g, '%255E')
      .replace(/_/g, '%255F')
      .replace(/&/g, '%2526');
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

//module.exports = LaTeXRenderer;
export default LaTeXRenderer;
