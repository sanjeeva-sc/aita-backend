const http = require('http');

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
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
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function testCurrentAPI() {
  console.log('Testing current API behavior...\n');

  try {
    // Test health endpoint first
    console.log('🔍 Testing health endpoint:');
    const healthResponse = await makeRequest('/health');
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Response: ${JSON.stringify(healthResponse.data)}\n`);

    // Test quiz endpoint without auth
    console.log('🔍 Testing quiz endpoint without authentication:');
    const quizResponse = await makeRequest('/api/quiz/31');
    console.log(`   Status: ${quizResponse.status}`);
    console.log(`   Response: ${JSON.stringify(quizResponse.data)}\n`);

    // Test with a non-existent quiz ID
    console.log('🔍 Testing with non-existent quiz ID (999):');
    const nonExistentResponse = await makeRequest('/api/quiz/999');
    console.log(`   Status: ${nonExistentResponse.status}`);
    console.log(`   Response: ${JSON.stringify(nonExistentResponse.data)}\n`);

    // Summary
    console.log('📋 Summary:');
    if (healthResponse.status === 200) {
      console.log('✅ Backend server is running');
    } else {
      console.log('❌ Backend server health check failed');
    }

    if (quizResponse.status === 401) {
      console.log('✅ Quiz endpoint requires authentication (expected behavior)');
      console.log('   This means the endpoint is working and our fixes are likely applied');
    } else if (quizResponse.status === 404) {
      console.log('❌ Quiz endpoint returning 404 - this suggests our fixes are NOT applied');
    } else {
      console.log(`❓ Unexpected status code: ${quizResponse.status}`);
    }

    if (nonExistentResponse.status === 401) {
      console.log('✅ Non-existent quiz also requires authentication (consistent behavior)');
    } else {
      console.log(`❓ Non-existent quiz returned: ${nonExistentResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testCurrentAPI();