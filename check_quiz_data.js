const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./transcript_notes.db');

console.log('Checking database structure...');

// Check available tables
db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, rows) => {
  if (err) {
    console.error('Error getting tables:', err);
    return;
  }
  
  console.log('Available tables:', rows.map(r => r.name));
  
  // Check if shared_quizzes table exists
  const hasSharedQuizzesTable = rows.some(r => r.name === 'shared_quizzes');
  
  if (hasSharedQuizzesTable) {
    console.log('\nChecking shared quiz data...');
    db.all('SELECT id, questions FROM shared_quizzes ORDER BY id DESC LIMIT 3', (err, quizRows) => {
      if (err) {
        console.error('Error getting shared quiz data:', err);
        return;
      }
      
      console.log(`Found ${quizRows.length} shared quizzes`);
      
      quizRows.forEach(row => {
        console.log(`\nShared Quiz ID: ${row.id}`);
        try {
          const questions = JSON.parse(row.questions);
          console.log('Questions structure:', JSON.stringify(questions, null, 2));
          
          // Check if it's an array or object
          if (Array.isArray(questions)) {
            console.log('✅ Questions is an array');
            if (questions.length > 0) {
              console.log('First question has correct_answer:', !!questions[0].correct_answer);
              console.log('First question correct_answer value:', questions[0].correct_answer);
            }
          } else {
            console.log('❌ Questions is not an array, it\'s:', typeof questions);
            if (questions.questions) {
              console.log('Has nested questions array:', Array.isArray(questions.questions));
            }
          }
        } catch (parseErr) {
          console.error('Error parsing questions JSON:', parseErr);
        }
        console.log('---');
      });
      
      db.close();
    });
  } else {
    console.log('No shared_quizzes table found either');
    db.close();
  }
});