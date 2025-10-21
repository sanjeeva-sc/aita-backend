const sqlite3 = require('sqlite3').verbose();

async function testExistingQuizData() {
  console.log('Testing existing quiz data compatibility...\n');
  
  const db = new sqlite3.Database('./transcript_notes.db');
  
  // Get some existing quizzes
  await new Promise((resolve, reject) => {
    db.all('SELECT id, questions FROM quiz ORDER BY id DESC LIMIT 5', (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`Found ${rows.length} existing quizzes to test:\n`);
      
      rows.forEach((row, index) => {
        console.log(`Testing Quiz ID ${row.id}:`);
        
        try {
          // Simulate the API endpoint logic
          const parsedQuestions = JSON.parse(row.questions);
          
          // Handle both old and new formats
          let questionsArray;
          if (Array.isArray(parsedQuestions)) {
            // New format: questions is already an array
            questionsArray = parsedQuestions;
            console.log(`  ✓ New format detected`);
          } else if (parsedQuestions.questions && Array.isArray(parsedQuestions.questions)) {
            // Old format: questions is nested in a quiz object
            questionsArray = parsedQuestions.questions;
            console.log(`  ✓ Old format detected`);
          } else if (parsedQuestions.quiz && parsedQuestions.quiz.questions) {
            // Very old format: questions is nested deeper
            questionsArray = parsedQuestions.quiz.questions;
            console.log(`  ✓ Very old format detected`);
          } else {
            // Fallback: treat as single question object
            questionsArray = [parsedQuestions];
            console.log(`  ✓ Single question format detected`);
          }
          
          console.log(`  - Questions array length: ${questionsArray.length}`);
          if (questionsArray.length > 0) {
            console.log(`  - First question: "${questionsArray[0].question || 'No question field'}"`);
            console.log(`  - Has options: ${questionsArray[0].options ? 'Yes' : 'No'}`);
            console.log(`  - Has correct answer: ${questionsArray[0].correct_answer ? 'Yes' : 'No'}`);
          }
          console.log('');
          
        } catch (parseError) {
          console.log(`  ✗ Failed to parse: ${parseError.message}`);
          console.log(`  - Raw data preview: ${row.questions.substring(0, 100)}...`);
          console.log('');
        }
      });
      
      resolve();
    });
  });
  
  db.close();
  console.log('✓ Existing quiz data compatibility test completed!');
}

// Run the test
testExistingQuizData().catch(console.error);