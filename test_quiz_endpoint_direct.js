const sqlite3 = require("sqlite3").verbose();

// Connect to the database
const db = new sqlite3.Database("./transcript_notes.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  }
  console.log("Connected to the SQLite database.");
});

async function testQuizEndpointLogic() {
  console.log("Testing Quiz GET endpoint logic directly...\n");

  const quizId = 31;
  
  // First, get the user_id for quiz 31
  const quizInfo = await new Promise((resolve, reject) => {
    db.get(
      "SELECT user_id FROM quiz WHERE id = ?",
      [quizId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  if (!quizInfo) {
    console.log("❌ Quiz ID 31 not found in database");
    return;
  }

  console.log(`✅ Quiz ID 31 found with user_id: ${quizInfo.user_id}`);

  // Test the exact logic from the GET endpoint (line 830+ in index.js)
  console.log("\n🔍 Testing GET endpoint logic:");
  
  const result = await new Promise((resolve, reject) => {
    // This is the exact query from the GET endpoint
    db.get(
      `SELECT q.*, 
              COUNT(sr.id) as total_responses,
              AVG(sr.score) as average_score,
              MAX(sr.score) as highest_score,
              MIN(sr.score) as lowest_score
       FROM quiz q
       LEFT JOIN shared_quizzes sq ON q.id = sq.quiz_id
       LEFT JOIN student_responses sr ON sq.id = sr.shared_quiz_id
       WHERE q.id = ? AND q.user_id = ?
       GROUP BY q.id`,
      [quizId, quizInfo.user_id],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  if (result) {
    console.log("✅ GET endpoint logic SUCCESS - quiz found!");
    console.log(`   - Quiz ID: ${result.id}`);
    console.log(`   - Transcript ID: ${result.transcript_id}`);
    console.log(`   - User ID: ${result.user_id}`);
    console.log(`   - Questions: ${result.questions ? JSON.parse(result.questions).length : 0} questions`);
    console.log(`   - Total responses: ${result.total_responses}`);
    console.log(`   - Average score: ${result.average_score || 'N/A'}`);
    
    // Test the response format
    try {
      const questions = JSON.parse(result.questions);
      const response = {
        id: result.id,
        transcript_id: result.transcript_id,
        questions: questions,
        created_at: result.created_at,
        user_id: result.user_id,
        quiz_options: result.quiz_options ? JSON.parse(result.quiz_options) : null,
        total_responses: result.total_responses || 0,
        average_score: result.average_score || null,
        highest_score: result.highest_score || null,
        lowest_score: result.lowest_score || null,
        statistics: {
          total_responses: result.total_responses || 0,
          average_score: result.average_score || null,
          highest_score: result.highest_score || null,
          lowest_score: result.lowest_score || null
        }
      };
      
      console.log("\n✅ Response format is correct!");
      console.log(`   - Questions is array: ${Array.isArray(response.questions)}`);
      console.log(`   - Questions count: ${response.questions.length}`);
      
    } catch (parseError) {
      console.log("❌ Error parsing questions:", parseError.message);
    }
    
  } else {
    console.log("❌ GET endpoint logic FAILED - quiz not found!");
    console.log("   This means the query is not working correctly.");
  }

  // Test with wrong user_id to confirm security
  console.log("\n🔍 Testing with wrong user_id (should fail):");
  const wrongUserResult = await new Promise((resolve, reject) => {
    db.get(
      `SELECT q.*, 
              COUNT(sr.id) as total_responses,
              AVG(sr.score) as average_score,
              MAX(sr.score) as highest_score,
              MIN(sr.score) as lowest_score
       FROM quiz q
       LEFT JOIN shared_quizzes sq ON q.id = sq.quiz_id
       LEFT JOIN student_responses sr ON sq.id = sr.shared_quiz_id
       WHERE q.id = ? AND q.user_id = ?
       GROUP BY q.id`,
      [quizId, 'wrong-user-id'],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  if (wrongUserResult) {
    console.log("❌ Security issue - quiz found with wrong user_id!");
  } else {
    console.log("✅ Security working - quiz not found with wrong user_id");
  }

  console.log("\n🎉 Direct endpoint logic test completed!");
}

testQuizEndpointLogic()
  .then(() => {
    db.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test failed:", error);
    db.close();
    process.exit(1);
  });