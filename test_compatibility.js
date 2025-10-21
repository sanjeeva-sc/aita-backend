const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Test compatibility with old and new quiz formats
async function testQuizCompatibility() {
  console.log('Testing quiz data format compatibility...\n');
  
  const db = new sqlite3.Database('./transcript_notes.db');
  
  // Test data for different formats
  const testQuizzes = [
    {
      name: 'New Format Test',
      questions: JSON.stringify([
        {
          question: "What is 2+2?",
          options: ["3", "4", "5", "6"],
          correct_answer: "4",
          type: "multiple_choice"
        }
      ])
    },
    {
      name: 'Old Format Test',
      questions: JSON.stringify({
        questions: [
          {
            question: "What is 3+3?",
            options: ["5", "6", "7", "8"],
            correct_answer: "6",
            type: "multiple_choice"
          }
        ]
      })
    },
    {
      name: 'Very Old Format Test',
      questions: JSON.stringify({
        quiz: {
          questions: [
            {
              question: "What is 4+4?",
              options: ["7", "8", "9", "10"],
              correct_answer: "8",
              type: "multiple_choice"
            }
          ]
        }
      })
    }
  ];
  
  // Insert test quizzes
  const insertedIds = [];
  for (const quiz of testQuizzes) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO quiz (questions, user_id, created_at) VALUES (?, ?, ?)',
        [quiz.questions, 'test_user', new Date().toISOString()],
        function(err) {
          if (err) {
            reject(err);
          } else {
            insertedIds.push(this.lastID);
            console.log(`✓ Inserted ${quiz.name} with ID: ${this.lastID}`);
            resolve();
          }
        }
      );
    });
  }
  
  console.log('\nTesting quiz retrieval and format handling...\n');
  
  // Test retrieval and format handling
  for (let i = 0; i < insertedIds.length; i++) {
    const quizId = insertedIds[i];
    const expectedTitle = testQuizzes[i].name;
    
    await new Promise((resolve, reject) => {
      db.get('SELECT * FROM quiz WHERE id = ?', [quizId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          // Simulate the API endpoint logic
          const parsedQuestions = JSON.parse(row.questions);
          
          // Handle both old and new formats
          let questionsArray;
          if (Array.isArray(parsedQuestions)) {
            // New format: questions is already an array
            questionsArray = parsedQuestions;
          } else if (parsedQuestions.questions && Array.isArray(parsedQuestions.questions)) {
            // Old format: questions is nested in a quiz object
            questionsArray = parsedQuestions.questions;
          } else if (parsedQuestions.quiz && parsedQuestions.quiz.questions) {
            // Very old format: questions is nested deeper
            questionsArray = parsedQuestions.quiz.questions;
          } else {
            // Fallback: treat as single question object
            questionsArray = [parsedQuestions];
          }
          
          console.log(`✓ ${expectedTitle}:`);
          console.log(`  - Questions array length: ${questionsArray.length}`);
          console.log(`  - First question: "${questionsArray[0].question}"`);
          console.log(`  - Correct answer: "${questionsArray[0].correct_answer}"`);
          console.log('');
          
          resolve();
        } catch (parseError) {
          console.log(`✗ ${expectedTitle}: Failed to parse - ${parseError.message}`);
          resolve();
        }
      });
    });
  }
  
  // Clean up test data
  console.log('Cleaning up test data...');
  for (const id of insertedIds) {
    await new Promise((resolve) => {
      db.run('DELETE FROM quiz WHERE id = ?', [id], () => {
        console.log(`✓ Deleted test quiz with ID: ${id}`);
        resolve();
      });
    });
  }
  
  db.close();
  console.log('\n✓ Quiz compatibility test completed successfully!');
}

// Run the test
testQuizCompatibility().catch(console.error);