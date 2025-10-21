// Test the transformation logic with mock data
console.log('Testing quiz transformation logic...');

// Mock Gemini response that matches what we see in the database
const mockGeminiResult = {
  success: true,
  content: {
    questions: [
      {
        "question": "What is the primary goal of artificial intelligence?",
        "options": [
          "To replace human workers",
          "To create intelligent machines",
          "To process large amounts of data",
          "To automate simple tasks"
        ],
        "correct": 1,
        "explanation": "AI aims to create intelligent machines that can perform tasks that typically require human intelligence."
      },
      {
        "question": "Which of the following is a subset of AI?",
        "options": [
          "Computer programming",
          "Database management",
          "Machine learning",
          "Web development"
        ],
        "correct": 2,
        "explanation": "Machine learning is a subset of AI that enables computers to learn without being explicitly programmed."
      },
      {
        "question": "What does deep learning use to process data?",
        "options": [
          "Simple algorithms",
          "Neural networks with multiple layers",
          "Basic statistical methods",
          "Linear regression models"
        ],
        "correct": 1,
        "explanation": "Deep learning uses neural networks with multiple layers to process and analyze data."
      }
    ]
  }
};

console.log('Mock Gemini result:');
console.log(JSON.stringify(mockGeminiResult, null, 2));

console.log('\n=== TESTING TRANSFORMATION ===');

// Apply the same transformation as in generateQuiz function
console.log('Original questions from mock Gemini:');
mockGeminiResult.content.questions.forEach((q, i) => {
  console.log(`Question ${i + 1}: correct=${q.correct} (type: ${typeof q.correct})`);
});

const questionsArray = mockGeminiResult.content.questions.map((question) => {
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
  console.log(`Question ${i + 1}:`);
  console.log(`  - correct_answer: ${q.correct_answer}`);
  console.log(`  - has 'correct' field: ${q.hasOwnProperty('correct')}`);
  console.log(`  - keys: [${Object.keys(q).join(', ')}]`);
});

console.log('\nFinal stringified result:');
const stringifiedResult = JSON.stringify(questionsArray);
console.log(stringifiedResult);

console.log('\n=== PARSING TEST ===');
// Test parsing the stringified result
const parsedBack = JSON.parse(stringifiedResult);
console.log('Parsed back successfully:');
parsedBack.forEach((q, i) => {
  console.log(`Question ${i + 1}: correct_answer=${q.correct_answer}, has correct: ${q.hasOwnProperty('correct')}`);
});

console.log('\n✅ Transformation logic test completed!');