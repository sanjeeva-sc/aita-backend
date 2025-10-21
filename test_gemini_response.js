const GeminiService = require('./services/ollamaService');

async function testGeminiResponse() {
  console.log('Testing Gemini service response...\n');
  
  const geminiService = new GeminiService();
  
  const testTranscript = `
    Today we're going to learn about basic mathematics. 
    Two plus two equals four. This is a fundamental arithmetic operation.
    The capital of France is Paris, which is located in Western Europe.
  `;
  
  try {
    console.log('Calling Gemini service...');
    const result = await geminiService.generateQuiz(testTranscript, {
      questionCount: 2,
      difficulty: 'easy'
    });
    
    console.log('Gemini service result:');
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('Raw content:', JSON.stringify(result.content, null, 2));
      
      if (result.content.questions) {
        console.log('\nQuestions array:');
        result.content.questions.forEach((question, index) => {
          console.log(`Question ${index + 1}:`);
          console.log(`  Question: ${question.question}`);
          console.log(`  Options: ${JSON.stringify(question.options)}`);
          console.log(`  Correct index: ${question.correct}`);
          console.log(`  Correct index type: ${typeof question.correct}`);
          console.log(`  Mapped to letter: ${["A", "B", "C", "D"][question.correct]}`);
          console.log('');
        });
        
        // Test the transformation logic from generateQuiz
        console.log('Testing transformation logic:');
        const questionsArray = result.content.questions.map((question) => {
          const { correct, ...questionWithoutCorrect } = question;
          return {
            ...questionWithoutCorrect,
            correct_answer: ["A", "B", "C", "D"][correct],
          };
        });
        
        console.log('Transformed questions:');
        console.log(JSON.stringify(questionsArray, null, 2));
        
      } else {
        console.log('❌ No questions array found in result.content');
      }
    } else {
      console.log('❌ Gemini service failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error testing Gemini service:', error);
  }
}

testGeminiResponse();