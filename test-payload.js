// Test script to verify JSON payload processing
const LLMService = require('./src/llm-service');

const testPayload = `{
  "questions": [
    {
      "type": "multiple_choice",
      "text": "Which of the following shapes has exactly three sides?",
      "points": 2,
      "choices": [
        {"id": 0, "text": "Square"},
        {"id": 1, "text": "Circle"},
        {"id": 2, "text": "Triangle"},
        {"id": 3, "text": "Rectangle"}
      ],
      "correctAnswer": 2,
      "explanation": "A triangle is defined as a polygon with three sides and three angles."
    },
    {
      "type": "multiple_choice",
      "text": "An angle that measures exactly $90^\\\\circ$ is called a(n):",
      "points": 2,
      "choices": [
        {"id": 0, "text": "Acute angle"},
        {"id": 1, "text": "Obtuse angle"},
        {"id": 2, "text": "Right angle"},
        {"id": 3, "text": "Straight angle"}
      ],
      "correctAnswer": 2,
      "explanation": "A right angle is an angle that measures exactly $90^\\\\circ$."
    }
  ]
}`;

async function testPayloadProcessing() {
    console.log('Testing JSON payload processing...');
    
    try {
        const llmService = new LLMService();
        
        // Test JSON parsing
        const parsed = JSON.parse(testPayload);
        console.log('✅ JSON parsing successful');
        console.log(`Found ${parsed.questions.length} questions`);
        
        // Test validation and processing
        const processedQuestions = llmService.validateAndProcessQuestions(parsed.questions);
        console.log('✅ Question validation successful');
        console.log(`Processed ${processedQuestions.length} questions`);
        
        // Print first question details
        const firstQuestion = processedQuestions[0];
        console.log('\n📝 First question details:');
        console.log(`Type: ${firstQuestion.type}`);
        console.log(`Text: ${firstQuestion.text}`);
        console.log(`Points: ${firstQuestion.points}`);
        console.log(`Choices: ${firstQuestion.choices?.length || 'N/A'}`);
        console.log(`Correct Answer: ${firstQuestion.correctAnswer}`);
        
        return processedQuestions;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    }
}

// Run the test
if (require.main === module) {
    testPayloadProcessing()
        .then(questions => {
            console.log(`\n🎉 Test completed successfully! Processed ${questions.length} questions.`);
        })
        .catch(error => {
            console.error('\n💥 Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testPayloadProcessing };