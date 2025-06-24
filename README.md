# QTI Generator for Canvas LMS

An Electron desktop application that generates QTI (Question & Test Interoperability) files compatible with Canvas LMS, featuring AI-powered question generation from PDFs and text, with full LaTeX math support.

## Features

### 🤖 AI-Powered Question Generation
- **PDF Upload**: Extract text from PDF documents automatically
- **Text Input**: Enter custom content for question generation
- **Multiple Question Types**: Generate multiple choice, true/false, short answer, and essay questions
- **Difficulty Levels**: Choose from easy, medium, hard, or mixed difficulty
- **Smart AI**: Uses Google Gemini or OpenAI GPT for intelligent question creation

### 📊 LaTeX Math Support
- **Real-time Preview**: See LaTeX math rendered as you type
- **Inline Math**: Use `$...$` for inline mathematical expressions
- **Display Math**: Use `$$...$$` for centered display equations
- **QTI Compatible**: Automatically converts LaTeX to MathML for Canvas import
- **Error Handling**: Visual feedback for LaTeX syntax errors

### 📝 Manual Question Creation
- **Multiple Choice**: 2-10 answer options with single correct answer
- **True/False**: Simple boolean questions
- **Short Answer**: Text input with sample answers
- **Essay Questions**: Long-form responses with grading rubrics
- **Fill in the Blank**: Text completion questions

### 💾 File Management
- **Save/Load**: Store assessments as JSON for later editing
- **QTI Export**: Generate Canvas-compatible XML files
- **Assessment Settings**: Configure title, description, time limits

## Quick Start

### 1. Installation
```bash
# Clone the repository
git clone <repository-url>
cd qti-generator

# Install dependencies
npm install

# Start the application
npm start
```

### 2. Get Your API Key
- **Google Gemini (Recommended)**: Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **OpenAI**: Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)

### 3. Generate Questions with AI
1. Enter your API key in the LLM Configuration section
2. Upload a PDF or enter text content
3. Configure generation settings (question count, difficulty, types)
4. Click "Generate Questions with AI"
5. Review and edit generated questions
6. Export to QTI format for Canvas import

## LaTeX Math Examples

### Inline Math
```
The quadratic formula is $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$.
```

### Display Math
```
$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$
```

### Common Math Symbols
- Fractions: `\frac{numerator}{denominator}`
- Square roots: `\sqrt{expression}`
- Superscripts: `x^{power}`
- Subscripts: `x_{index}`
- Greek letters: `\alpha`, `\beta`, `\gamma`, etc.
- Integrals: `\int_{a}^{b} f(x) dx`
- Summations: `\sum_{i=1}^{n} x_i`

## API Providers

### Google Gemini (Recommended)
- **Cost**: Free tier with generous limits
- **Quality**: Excellent for educational content
- **Setup**: Get API key from Google AI Studio
- **Limits**: 60 requests per minute, 1500 requests per day (free tier)

### OpenAI GPT
- **Cost**: Pay-per-use pricing
- **Quality**: High-quality generation
- **Setup**: Get API key from OpenAI Platform
- **Note**: Requires payment method on file

## Canvas LMS Integration

1. Generate your QTI file using the export function
2. In Canvas, go to Settings → Import Content
3. Select "QTI .zip Package" as content type
4. Upload your generated .xml file
5. Questions will be imported to your question bank

## Development

### Scripts
```bash
npm start          # Start the application
npm run dev        # Start with developer tools
npm test           # Run test suite
npm run test:watch # Run tests in watch mode
npm run build      # Build for production
```

### Project Structure
```
├── main.js              # Electron main process
├── renderer.html        # Main UI
├── renderer.js          # UI logic and QTI generation
├── styles.css           # Application styling
├── src/
│   ├── llm-service.js   # AI question generation
│   └── latex-renderer.js # LaTeX math processing
└── tests/               # Test suite
```

### Testing
- **Jest**: Testing framework
- **Unit Tests**: Core functionality testing
- **Integration Tests**: End-to-end workflows
- **Coverage**: Run `npm run test:coverage`

## File Formats

### Assessment JSON
```json
{
  "title": "Sample Assessment",
  "description": "Description here",
  "timeLimit": 60,
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "text": "What is $2^3$?",
      "points": 1,
      "choices": [
        {"id": 0, "text": "6"},
        {"id": 1, "text": "8"},
        {"id": 2, "text": "9"}
      ],
      "correctAnswer": 1
    }
  ]
}
```

### QTI XML Export
The application generates QTI 1.2 compliant XML that includes:
- Assessment metadata
- Question items with proper typing
- MathML for mathematical content
- Canvas-specific extensions

## Troubleshooting

### Common Issues

**API Key Not Working**
- Verify the key is correct and active
- Check rate limits for your provider
- Ensure proper permissions are set

**PDF Upload Fails**
- Verify the PDF contains selectable text
- Try converting scanned PDFs with OCR first
- Check file size limits

**LaTeX Not Rendering**
- Verify syntax using preview
- Check for unmatched delimiters
- Use escape characters for special symbols

**QTI Import Issues**
- Ensure Canvas supports QTI 1.2 format
- Check for special characters in questions
- Verify mathematical content is properly formatted

### Support
- Check the [Issues](./tests/README.md) for common problems
- Review the test documentation for examples
- Ensure all dependencies are properly installed

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Acknowledgments

- **KaTeX**: Math rendering library
- **Google Gemini**: AI question generation
- **pdf-parse**: PDF text extraction
- **Electron**: Cross-platform desktop framework