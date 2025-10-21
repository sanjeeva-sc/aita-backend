const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'transcript_notes.db');
const db = new sqlite3.Database(dbPath);

console.log('Monitoring quiz creation...\n');

// Function to check latest quiz
function checkLatestQuiz() {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT id, transcript_id, questions, user_id, created_at 
      FROM quiz 
      ORDER BY created_at DESC 
      LIMIT 1
    `, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Function to check latest shared quiz
function checkLatestSharedQuiz() {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT sq.id, sq.quiz_id, sq.share_token, sq.created_at, q.questions
      FROM shared_quizzes sq
      JOIN quiz q ON sq.quiz_id = q.id
      ORDER BY sq.created_at DESC 
      LIMIT 1
    `, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Function to analyze quiz structure
function analyzeQuizStructure(questionsData, source) {
  console.log(`\n=== Analyzing ${source} ===`);
  console.log('Raw questions data:', questionsData);
  console.log('Type:', typeof questionsData);
  
  try {
    let parsedQuestions;
    
    if (typeof questionsData === 'string') {
      parsedQuestions = JSON.parse(questionsData);
    } else {
      parsedQuestions = questionsData;
    }
    
    console.log('Parsed questions:', JSON.stringify(parsedQuestions, null, 2));
    
    // Check if it's an array or object with questions property
    let questionsArray;
    if (Array.isArray(parsedQuestions)) {
      questionsArray = parsedQuestions;
      console.log('✅ Questions is an array');
    } else if (parsedQuestions.questions && Array.isArray(parsedQuestions.questions)) {
      questionsArray = parsedQuestions.questions;
      console.log('✅ Questions found in .questions property');
    } else {
      console.log('❌ Invalid questions structure');
      return;
    }
    
    console.log(`Number of questions: ${questionsArray.length}`);
    
    if (questionsArray.length > 0) {
      const firstQuestion = questionsArray[0];
      console.log('First question structure:');
      console.log('  Keys:', Object.keys(firstQuestion));
      console.log('  Has correct_answer:', 'correct_answer' in firstQuestion);
      console.log('  correct_answer value:', firstQuestion.correct_answer);
      console.log('  correct_answer type:', typeof firstQuestion.correct_answer);
    }
    
  } catch (error) {
    console.log('❌ Error parsing questions:', error.message);
  }
}

// Initial check
async function initialCheck() {
  try {
    console.log('Checking existing data...');
    
    const latestQuiz = await checkLatestQuiz();
    if (latestQuiz) {
      console.log(`Latest quiz: ID ${latestQuiz.id}, Transcript ID: ${latestQuiz.transcript_id}, User: ${latestQuiz.user_id}`);
      analyzeQuizStructure(latestQuiz.questions, 'Quiz Table');
    } else {
      console.log('No quizzes found in database');
    }
    
    const latestSharedQuiz = await checkLatestSharedQuiz();
    if (latestSharedQuiz) {
      console.log(`Latest shared quiz: ID ${latestSharedQuiz.id}, Share token: ${latestSharedQuiz.share_token}`);
      analyzeQuizStructure(latestSharedQuiz.questions, 'Shared Quiz Table');
    } else {
      console.log('No shared quizzes found in database');
    }
    
  } catch (error) {
    console.error('Error in initial check:', error);
  }
}

// Monitor for new quizzes
let lastQuizId = 0;
let lastSharedQuizId = 0;

async function monitorChanges() {
  try {
    const latestQuiz = await checkLatestQuiz();
    if (latestQuiz && latestQuiz.id > lastQuizId) {
      lastQuizId = latestQuiz.id;
      console.log(`\n🆕 NEW QUIZ DETECTED: ID ${latestQuiz.id}, Transcript ID: ${latestQuiz.transcript_id}`);
      analyzeQuizStructure(latestQuiz.questions, 'New Quiz');
    }
    
    const latestSharedQuiz = await checkLatestSharedQuiz();
    if (latestSharedQuiz && latestSharedQuiz.id > lastSharedQuizId) {
      lastSharedQuizId = latestSharedQuiz.id;
      console.log(`\n🆕 NEW SHARED QUIZ DETECTED: ID ${latestSharedQuiz.id}, Share token: ${latestSharedQuiz.share_token}`);
      analyzeQuizStructure(latestSharedQuiz.questions, 'New Shared Quiz');
    }
    
  } catch (error) {
    console.error('Error monitoring changes:', error);
  }
}

// Start monitoring
initialCheck().then(() => {
  console.log('\n📡 Monitoring for new quizzes... (Press Ctrl+C to stop)');
  
  // Check every 2 seconds
  setInterval(monitorChanges, 2000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping monitor...');
  db.close();
  process.exit(0);
});