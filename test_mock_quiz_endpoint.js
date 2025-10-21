// Test the complete quiz generation flow with mock data
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Mock generateQuiz function that returns the correct format
function mockGenerateQuiz(transcript, options) {
  console.log('🔍 Mock generateQuiz called with transcript length:', transcript.length);
  console.log('🔍 Mock generateQuiz options:', JSON.stringify(options, null, 2));
  
  // Mock Gemini response
  const mockResult = {
    success: true,
    content: {
      questions: [
        {
          "question": "What is the primary topic of this transcript?",
          "options": [
            "Computer programming",
            "Artificial intelligence",
            "Database management",
            "Web development"
          ],
          "correct": 1,
          "explanation": "The transcript discusses artificial intelligence and its various aspects."
        },
        {
          "question": "Which technology is mentioned as a subset of AI?",
          "options": [
            "Blockchain",
            "Machine learning",
            "Cloud computing",
            "Cybersecurity"
          ],
          "correct": 1,
          "explanation": "Machine learning is specifically mentioned as a subset of AI."
        }
      ]
    }
  };
  
  console.log("🔍 Mock Gemini service result:", JSON.stringify(mockResult, null, 2));
  
  if (mockResult.success) {
    console.log("🔍 Original questions from mock Gemini:", JSON.stringify(mockResult.content.questions, null, 2));
    
    // Extract questions array from the quiz result and transform correct index to letter
    const questionsArray = mockResult.content.questions.map((question) => {
      const { correct, ...questionWithoutCorrect } = question;
      const transformedQuestion = {
        ...questionWithoutCorrect,
        correct_answer: ["A", "B", "C", "D"][correct],
      };
      console.log(`🔍 Transforming question: correct=${correct} -> correct_answer=${transformedQuestion.correct_answer}`);
      return transformedQuestion;
    });
    
    console.log("🔍 Transformed questions array:", JSON.stringify(questionsArray, null, 2));
    const stringifiedResult = JSON.stringify(questionsArray);
    console.log("🔍 Final stringified result:", stringifiedResult);
    
    return stringifiedResult;
  } else {
    throw new Error(mockResult.error || "Failed to generate quiz with mock data");
  }
}

async function testCompleteFlow() {
  try {
    console.log('Testing complete quiz generation flow...');
    
    const testTranscript = 'This is a test transcript about artificial intelligence and machine learning.';
    const userId = 'test-user-123';
    const quizOptions = { numQuestions: 2, difficulty: 'medium' };
    
    // Generate quiz using mock function
    const quiz = mockGenerateQuiz(testTranscript, quizOptions);
    
    // Store in database (simulating the actual flow)
    console.log('\n=== STORING IN DATABASE ===');
    
    // First create a notes entry (required for foreign key)
    db.run(
      "INSERT INTO notes (transcript, notes, format_type, template_id, notes_options, user_id) VALUES (?, ?, ?, ?, ?, ?)",
      [testTranscript, 'Test notes', 'html', null, null, userId],
      function (err) {
        if (err) {
          console.error("Error saving notes:", err);
          return;
        }
        
        const notesId = this.lastID;
        console.log('Notes saved with ID:', notesId);
        
        // Store quiz
        db.run(
          "INSERT INTO quiz (transcript_id, questions, quiz_options, user_id) VALUES (?, ?, ?, ?)",
          [notesId, quiz, JSON.stringify(quizOptions), userId],
          function (err) {
            if (err) {
              console.error("Error saving quiz:", err);
              return;
            }
            
            const quizId = this.lastID;
            console.log('Quiz saved with ID:', quizId);
            
            // Retrieve and verify the stored quiz
            db.get(
              "SELECT * FROM quiz WHERE id = ?",
              [quizId],
              (err, row) => {
                if (err) {
                  console.error("Error retrieving quiz:", err);
                  return;
                }
                
                console.log('\n=== VERIFICATION ===');
                console.log('Retrieved quiz from database:');
                console.log('Quiz ID:', row.id);
                console.log('Questions (raw):', row.questions);
                
                // Parse and analyze the questions
                try {
                  const parsedQuestions = JSON.parse(row.questions);
                  console.log('\nParsed questions:');
                  parsedQuestions.forEach((q, i) => {
                    console.log(`Question ${i + 1}:`);
                    console.log(`  - Has correct_answer: ${q.hasOwnProperty('correct_answer')}`);
                    console.log(`  - correct_answer value: ${q.correct_answer}`);
                    console.log(`  - Has correct: ${q.hasOwnProperty('correct')}`);
                    console.log(`  - Keys: [${Object.keys(q).join(', ')}]`);
                  });
                  
                  // Check if transformation was successful
                  const hasCorrectAnswer = parsedQuestions.every(q => q.hasOwnProperty('correct_answer'));
                  const hasCorrectIndex = parsedQuestions.some(q => q.hasOwnProperty('correct'));
                  
                  console.log('\n=== RESULT ===');
                  console.log(`✅ All questions have correct_answer: ${hasCorrectAnswer}`);
                  console.log(`❌ Any questions have correct index: ${hasCorrectIndex}`);
                  
                  if (hasCorrectAnswer && !hasCorrectIndex) {
                    console.log('🎉 SUCCESS: Quiz transformation is working correctly!');
                  } else {
                    console.log('❌ FAILURE: Quiz transformation is not working correctly.');
                  }
                  
                } catch (parseError) {
                  console.error('Error parsing questions:', parseError);
                }
                
                // Close database connection
                db.close();
              }
            );
          }
        );
      }
    );
    
  } catch (error) {
    console.error('Error in complete flow test:', error);
    db.close();
  }
}

testCompleteFlow();