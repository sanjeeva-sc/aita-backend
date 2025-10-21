const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function testAPI() {
  console.log('Testing API endpoints...\n');
  
  try {
    // Test quiz endpoint with existing quiz (should have old format)
    console.log('🔍 Testing quiz endpoint with existing quiz (ID: 16)');
    const quizResponse = await makeRequest('/api/quiz/16');
    
    if (quizResponse.status === 401) {
      console.log('❌ Authentication required - this is expected for protected endpoints');
      console.log('Status:', quizResponse.status);
      console.log('Response:', quizResponse.data);
    } else if (quizResponse.status === 200) {
      console.log('✅ Quiz endpoint accessible');
      console.log('Questions is array:', Array.isArray(quizResponse.data.questions));
      console.log('Questions count:', quizResponse.data.questions?.length || 'N/A');
    } else {
      console.log('❓ Unexpected response');
      console.log('Status:', quizResponse.status);
      console.log('Response:', quizResponse.data);
    }
    
    console.log('\n---\n');
    
    // Test health endpoint
    console.log('🔍 Testing health endpoint');
    const healthResponse = await makeRequest('/health');
    
    if (healthResponse.status === 200) {
      console.log('✅ Health endpoint working');
      console.log('Response:', healthResponse.data);
    } else {
      console.log('❌ Health endpoint failed');
      console.log('Status:', healthResponse.status);
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testAPI();