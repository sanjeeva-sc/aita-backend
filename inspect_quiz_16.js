const sqlite3 = require('sqlite3').verbose();

async function inspectQuiz16() {
  console.log('Inspecting Quiz ID 16 raw data...\n');
  
  const db = new sqlite3.Database('./transcript_notes.db');
  
  await new Promise((resolve, reject) => {
    db.get('SELECT * FROM quiz WHERE id = 16', (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        console.log('Quiz ID 16 not found');
        resolve();
        return;
      }
      
      console.log('Quiz ID 16 details:');
      console.log('- ID:', row.id);
      console.log('- User ID:', row.user_id);
      console.log('- Created At:', row.created_at);
      console.log('- Transcript ID:', row.transcript_id);
      console.log('- Quiz Options:', row.quiz_options);
      console.log('\nRaw questions data:');
      console.log(row.questions);
      
      console.log('\nParsed questions data:');
      try {
        const parsed = JSON.parse(row.questions);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Failed to parse:', e.message);
      }
      
      resolve();
    });
  });
  
  db.close();
}

inspectQuiz16().catch(console.error);