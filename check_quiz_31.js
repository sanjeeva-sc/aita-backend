const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./quiz_app.db');

console.log('Checking database tables...');
db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, rows) => {
    if (err) {
        console.error('Error getting tables:', err);
        db.close();
        return;
    }
    
    console.log('Tables in database:');
    rows.forEach(row => console.log('-', row.name));
    
    // Check if quiz table exists and look for quiz 31
    if (rows.some(row => row.name === 'quiz')) {
        console.log('\nChecking for quiz ID 31...');
        db.get('SELECT id, transcript_id, user_id, created_at FROM quiz WHERE id = ?', [31], (err, row) => {
            if (err) {
                console.error('Error querying quiz:', err);
            } else if (row) {
                console.log('Quiz 31 found:', row);
            } else {
                console.log('Quiz 31 not found');
                
                // Check what quizzes do exist
                db.all('SELECT id, transcript_id, user_id FROM quiz LIMIT 10', (err, rows) => {
                    if (err) {
                        console.error('Error getting quiz list:', err);
                    } else {
                        console.log('Available quizzes:');
                        rows.forEach(row => console.log(`- ID: ${row.id}, transcript_id: ${row.transcript_id}, user_id: ${row.user_id}`));
                    }
                    db.close();
                });
            }
        });
    } else {
        console.log('Quiz table does not exist!');
        
        // Check if there are any tables with "quiz" in the name
        const quizTables = rows.filter(row => row.name.toLowerCase().includes('quiz'));
        if (quizTables.length > 0) {
            console.log('Tables with "quiz" in name:');
            quizTables.forEach(row => console.log('-', row.name));
        }
        
        db.close();
    }
});