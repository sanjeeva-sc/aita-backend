async function testQuizGeneration() {
  try {
    console.log('Testing server connectivity...');
    
    // First, test the health endpoint
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.text();
    console.log('Health check:', healthData);
    
    console.log('Testing quiz generation...');
    
    // First, create a transcript
    const transcriptResponse = await fetch('http://localhost:3001/api/transcripts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test Transcript for Quiz Generation',
        content: 'This is a test transcript about artificial intelligence. AI is a field of computer science that aims to create intelligent machines. Machine learning is a subset of AI that enables computers to learn without being explicitly programmed. Deep learning uses neural networks with multiple layers to process data.'
      })
    });
    
    const transcriptData = await transcriptResponse.json();
    console.log('Transcript created:', transcriptData);
    const transcriptId = transcriptData.id;
    
    // Now generate a quiz for this transcript
    console.log('Generating quiz for transcript ID:', transcriptId);
    const quizResponse = await fetch(`http://localhost:3001/api/transcripts/${transcriptId}/quiz`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const quizData = await quizResponse.json();
    console.log('Quiz generation response:', quizData);
    
  } catch (error) {
    console.error('Error testing quiz generation:', error.message);
  }
}

testQuizGeneration();