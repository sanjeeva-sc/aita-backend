const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./transcript_notes.db');

console.log('Checking database tables...');

// Check what tables exist
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) {
    console.error('Error getting tables:', err);
  } else {
    console.log('Tables in database:');
    rows.forEach(row => console.log('- ' + row.name));
    
    // Check if quizzes table exists (might be named differently)
    const tableNames = rows.map(row => row.name);
    
    if (tableNames.includes('quiz')) {
      // Check quiz table
      db.all('SELECT id, transcript_id, created_at FROM quiz ORDER BY id DESC LIMIT 10', (err, quizRows) => {
        if (err) {
          console.error('Error getting quizzes:', err);
        } else {
          console.log('\nRecent quizzes:');
          console.table(quizRows);
        }
        db.close();
      });
    } else if (tableNames.includes('quizzes')) {
      // Check quizzes table
      db.all('SELECT id, transcript_id, created_at FROM quizzes ORDER BY id DESC LIMIT 10', (err, quizRows) => {
        if (err) {
          console.error('Error getting quizzes:', err);
        } else {
          console.log('\nRecent quizzes:');
          console.table(quizRows);
        }
        db.close();
      });
    } else {
      console.log('\nNo quiz or quizzes table found!');
      db.close();
    }
  }
});