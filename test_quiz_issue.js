const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

async function testQuizIssue() {
  console.log('Testing quiz correct_answer issue...\n');
  
  const db = new sqlite3.Database('./transcript_notes.db');
  
  // Create a test quiz with the current format (array of questions)
  const testQuestions = [
    {
      question: "What is 2+2?",
      options: ["3", "4", "5", "6"],
      correct_answer: "B", // This should be set by generateQuiz
      type: "multiple_choice",
      explanation: "2+2 equals 4"
    },
    {
      question: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"],
      correct_answer: "C",
      type: "multiple_choice", 
      explanation: "Paris is the capital of France"
    }
  ];
  
  console.log('Test questions structure:');
  console.log(JSON.stringify(testQuestions, null, 2));
  console.log('\n');
  
  // Insert test quiz
  const questionsJson = JSON.stringify(testQuestions);
  
  const quizId = await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO quiz (questions, user_id, created_at) VALUES (?, ?, ?)',
      [questionsJson, 'test_user', new Date().toISOString()],
      function(err) {
        if (err) {
          reject(err);
        } else {
          console.log(`✓ Inserted test quiz with ID: ${this.lastID}`);
          resolve(this.lastID);
        }
      }
    );
  });
  
  // Create shared quiz
  const shareToken = crypto.randomBytes(32).toString('hex');
  
  await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO shared_quizzes (quiz_id, share_token, created_at) VALUES (?, ?, ?)',
      [quizId, shareToken, new Date().toISOString()],
      function(err) {
        if (err) {
          reject(err);
        } else {
          console.log(`✓ Created shared quiz with token: ${shareToken}`);
          resolve();
        }
      }
    );
  });
  
  // Now test the submission logic (simulate the API endpoint)
  console.log('\nTesting submission logic...');
  
  const testAnswers = {
    "0": "B", // Correct answer for question 1
    "1": "A"  // Wrong answer for question 2
  };
  
  // Simulate the submission endpoint logic
  await new Promise((resolve, reject) => {
    db.get(
      'SELECT sq.id as shared_quiz_id, q.questions FROM shared_quizzes sq JOIN quiz q ON sq.quiz_id = q.id WHERE sq.share_token = ?',
      [shareToken],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          console.log('❌ Quiz not found');
          resolve();
          return;
        }
        
        console.log('Raw quiz data from database:', row.questions);
        
        try {
          // This is the problematic part from the original code
          const quizData = JSON.parse(row.questions);
          console.log('Parsed quizData type:', typeof quizData);
          console.log('Is quizData an array?', Array.isArray(quizData));
          
          // Original problematic logic
          const questions = quizData.questions || quizData;
          console.log('Extracted questions type:', typeof questions);
          console.log('Is questions an array?', Array.isArray(questions));
          
          if (Array.isArray(questions)) {
            console.log('✅ Questions is an array with', questions.length, 'items');
            
            // Test the scoring logic
            let score = 0;
            let totalQuestions = questions.length;
            
            questions.forEach((question, index) => {
              const studentAnswer = testAnswers[index.toString()];
              const correctAnswer = question.correct_answer;
              
              console.log(`Question ${index + 1}:`);
              console.log(`  Student answer: ${studentAnswer}`);
              console.log(`  Correct answer: ${correctAnswer}`);
              console.log(`  correct_answer is undefined: ${correctAnswer === undefined}`);
              
              if (studentAnswer === correctAnswer) {
                score++;
                console.log(`  ✅ Correct!`);
              } else {
                console.log(`  ❌ Wrong`);
              }
            });
            
            console.log(`\nFinal score: ${score}/${totalQuestions}`);
          } else {
            console.log('❌ Questions is not an array');
          }
          
          resolve();
        } catch (parseErr) {
          console.log('❌ Error parsing quiz data:', parseErr.message);
          resolve();
        }
      }
    );
  });
  
  // Clean up
  console.log('\nCleaning up test data...');
  await new Promise((resolve) => {
    db.run('DELETE FROM shared_quizzes WHERE share_token = ?', [shareToken], () => {
      console.log('✓ Deleted shared quiz');
      resolve();
    });
  });
  
  await new Promise((resolve) => {
    db.run('DELETE FROM quiz WHERE id = ?', [quizId], () => {
      console.log('✓ Deleted test quiz');
      resolve();
    });
  });
  
  db.close();
  console.log('\n✓ Test completed!');
}

// Run the test
testQuizIssue().catch(console.error);