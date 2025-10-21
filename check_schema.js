const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./transcript_notes.db');

console.log('Checking quiz table schema...\n');

db.all("PRAGMA table_info(quiz)", (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  console.log('Quiz table columns:');
  rows.forEach(row => {
    console.log(`- ${row.name} (${row.type}) ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
  });
  
  db.close();
});