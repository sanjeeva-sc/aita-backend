// Test the generateQuiz function directly
const path = require('path');

// Load environment variables
require('dotenv').config();

// Import the generateQuiz function from index.js
// We need to extract just the function, not run the whole server

const GeminiService = require('./services/ollamaService');

async function testDirectQuizGeneration() {
  try {
    console.log('Testing direct quiz generation...');
    
    const geminiService = new GeminiService();
    
    const testTranscript = `
This is a test transcript about artificial intelligence. AI is a field of computer science that aims to create intelligent machines. Machine learning is a subset of AI that enables computers to learn without being explicitly programmed. Deep learning uses neural networks with multiple layers to process data.

Natural language processing is another important area of AI that deals with the interaction between computers and human language. Computer vision enables machines to interpret and understand visual information from the world.
    `.trim();

    // Call the Gemini service directly
    console.log('Calling Gemini service...');
    const geminiResult = await geminiService.generateQuiz(testTranscript, {
      numQuestions: 3,
      difficulty: 'medium'
    });
    
    console.log('Gemini service result:', JSON.stringify(geminiResult, null, 2));
    
    if (geminiResult.success) {
      console.log('\n=== TRANSFORMATION TEST ===');
      console.log('Original questions from Gemini:');
      geminiResult.content.questions.forEach((q, i) => {
        console.log(`Question ${i + 1}: correct=${q.correct} (type: ${typeof q.correct})`);
      });
      
      // Apply the same transformation as in generateQuiz function
      const questionsArray = geminiResult.content.questions.map((question) => {
        const { correct, ...questionWithoutCorrect } = question;
        const transformedQuestion = {
          ...questionWithoutCorrect,
          correct_answer: ["A", "B", "C", "D"][correct],
        };
        console.log(`Transforming: correct=${correct} -> correct_answer=${transformedQuestion.correct_answer}`);
        return transformedQuestion;
      });
      
      console.log('\nTransformed questions:');
      questionsArray.forEach((q, i) => {
        console.log(`Question ${i + 1}: correct_answer=${q.correct_answer}, has correct field: ${q.hasOwnProperty('correct')}`);
      });
      
      console.log('\nFinal stringified result:');
      const stringifiedResult = JSON.stringify(questionsArray);
      console.log(stringifiedResult);
      
    } else {
      console.error('Gemini service failed:', geminiResult.error);
    }
    
  } catch (error) {
    console.error('Error in direct test:', error);
  }
}

testDirectQuizGeneration();