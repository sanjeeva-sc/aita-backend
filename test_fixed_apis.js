const BASE_URL = 'http://localhost:3001';

async function testAPIs() {
  console.log('Testing fixed APIs...\n');

  // Test 1: PUT /api/quiz/31 (should fail with 500 Unauthenticated - expected)
  console.log('1. Testing PUT /api/quiz/31 without auth (should return 500 Unauthenticated):');
  try {
    const response = await fetch(`${BASE_URL}/api/quiz/31`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: "Test Quiz",
        description: "Test Description",
        time_limit: 30,
        show_answers: true,
        shuffle_questions: false,
        questions: [
          {
            question: "Test question?",
            options: ["A", "B", "C", "D"],
            correct_answer: "A",
            explanation: "Test explanation"
          }
        ]
      })
    });
    console.log(`Status: ${response.status}`);
    const data = await response.text();
    console.log(`Response: ${data}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  console.log('\n');

  // Test 2: POST /api/quiz/31/question/0/rewrite (should fail with 500 Unauthenticated - expected)
  console.log('2. Testing POST /api/quiz/31/question/0/rewrite without auth (should return 500 Unauthenticated):');
  try {
    const response = await fetch(`${BASE_URL}/api/quiz/31/question/0/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: "Make this question easier"
      })
    });
    console.log(`Status: ${response.status}`);
    const data = await response.text();
    console.log(`Response: ${data}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  console.log('\n');

  // Test 3: Health check to ensure server is working
  console.log('3. Testing health endpoint:');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    console.log(`Status: ${response.status}`);
    const data = await response.text();
    console.log(`Response: ${data}`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  console.log('\nTest completed!');
}

testAPIs().catch(console.error);