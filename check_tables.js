const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./transcript_notes.db');

console.log('Checking shared_quizzes table...');
db.all('SELECT * FROM shared_quizzes', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Shared quizzes:', rows);
  }
  
  console.log('\nChecking quiz table...');
  db.all('SELECT id, transcript_id FROM quiz LIMIT 5', (err2, rows2) => {
    if (err2) {
      console.error('Error:', err2);
    } else {
      console.log('Available quizzes:', rows2);
    }
    db.close();
  });
});