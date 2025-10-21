const sqlite3 = require('sqlite3').verbose();
const OllamaService = require('./services/ollamaService');

async function testNewQuizGeneration() {
  console.log('Testing new quiz generation and storage...\n');
  
  // Override the default model to use the available one
  process.env.OLLAMA_MODEL = 'nollama/mythomax-l2-13b:Q4_K_M';
  const ollamaService = new OllamaService();
  
  const testTranscript = `
    Meeting Transcript - Project Planning Session
    
    Today we discussed the upcoming product launch and the key milestones we need to achieve:
    
    1. Complete user interface design by next Friday
    2. Finish backend API development by the end of the month
    3. Conduct thorough testing in the first week of next month
    4. Deploy to production environment by the 15th
    
    The team also discussed potential risks and mitigation strategies for each phase of the project.
  `;
  
  const db = new sqlite3.Database('./transcript_notes.db');
  
  try {
    // Step 1: Generate quiz using OllamaService
    console.log('🔍 Step 1: Generating quiz with OllamaService');
    const result = await ollamaService.generateQuiz(testTranscript);
    
    if (!result.success) {
      console.log('❌ Quiz generation failed:', result.error);
      return;
    }
    
    console.log('✅ Quiz generated successfully');
    
    // Step 2: Simulate the generateQuiz function from index.js
    console.log('\n🔍 Step 2: Processing quiz data (index.js style)');
    const questionsArray = result.quiz.quiz ? result.quiz.quiz.questions : result.quiz.questions;
    const stringifiedQuestions = JSON.stringify(questionsArray);
    
    console.log('✅ Questions extracted and stringified');
    console.log('Questions count:', questionsArray.length);
    
    // Step 3: Insert into database (simulating the upload endpoint)
    console.log('\n🔍 Step 3: Storing in database');
    
    // First insert a notes record
    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO notes (transcript, notes, user_id) VALUES (?, ?, ?)",
        [testTranscript, "Test notes", "test_user"],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    }).then(notesId => {
      console.log('✅ Notes record created with ID:', notesId);
      
      // Then insert the quiz
      return new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO quiz (transcript_id, questions, quiz_options, user_id) VALUES (?, ?, ?, ?)",
          [notesId, stringifiedQuestions, null, "test_user"],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
    }).then(quizId => {
      console.log('✅ Quiz record created with ID:', quizId);
      
      // Step 4: Retrieve and verify the data
      console.log('\n🔍 Step 4: Retrieving and verifying stored data');
      
      return new Promise((resolve, reject) => {
        db.get("SELECT * FROM quiz WHERE id = ?", [quizId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    }).then(row => {
      console.log('✅ Quiz retrieved from database');
      
      // Parse the questions field
      const parsedQuestions = JSON.parse(row.questions);
      
      console.log('Questions is array:', Array.isArray(parsedQuestions));
      console.log('Questions count:', parsedQuestions.length);
      console.log('First question structure:', {
        hasQuestion: !!parsedQuestions[0]?.question,
        hasOptions: !!parsedQuestions[0]?.options,
        hasCorrectAnswer: !!parsedQuestions[0]?.correct_answer,
        hasType: !!parsedQuestions[0]?.type
      });
      
      if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
        console.log('\n🎉 SUCCESS: New quiz data format is correct!');
        console.log('The quiz data structure issue has been resolved for new quizzes.');
      } else {
        console.log('\n❌ FAILURE: Quiz data format is still incorrect');
      }
    });
    
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    db.close();
  }
}

testNewQuizGeneration();