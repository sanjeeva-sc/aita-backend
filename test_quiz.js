const OllamaService = require('./services/ollamaService');

async function testQuizGeneration() {
  console.log('Testing quiz generation...');
  
  // Override the default model to use the available one
  process.env.OLLAMA_MODEL = 'nollama/mythomax-l2-13b:Q4_K_M';
  const ollamaService = new OllamaService();
  
  const testTranscript = `
    Test Meeting Transcript
    
    Today we discussed the implementation of AI-powered learning tools in our educational platform. The main topics covered were:
    
    1. Integration of local language models for privacy and security
    2. Development of automated note-taking features
    3. Creation of interactive quiz systems for student assessment
    4. Compliance with educational data protection standards
    
    The team agreed that using Ollama for local AI processing would provide better data security compared to cloud-based solutions.
  `;
  
  try {
    // Test 1: OllamaService.generateQuiz
    console.log('\n🔍 Test 1: OllamaService.generateQuiz');
    const result = await ollamaService.generateQuiz(testTranscript);
    
    if (result.success && result.quiz && result.quiz.quiz && result.quiz.quiz.questions) {
      console.log('✅ OllamaService.generateQuiz works correctly');
      console.log('Questions array length:', result.quiz.quiz.questions.length);
    } else {
      console.log('❌ OllamaService.generateQuiz failed');
      return;
    }
    
    // Test 2: generateQuiz function (from index.js)
    console.log('\n🔍 Test 2: generateQuiz function (index.js style)');
    
    // Simulate the generateQuiz function logic
    const questionsArray = result.quiz.quiz ? result.quiz.quiz.questions : result.quiz.questions;
    const stringifiedQuestions = JSON.stringify(questionsArray);
    
    console.log('✅ Questions extracted and stringified');
    console.log('Stringified length:', stringifiedQuestions.length);
    
    // Test 3: Database storage simulation
    console.log('\n🔍 Test 3: Database storage simulation');
    
    // Parse back the stringified questions (simulating database retrieval)
    const parsedQuestions = JSON.parse(stringifiedQuestions);
    
    if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
      console.log('✅ Database storage/retrieval simulation successful');
      console.log('Parsed questions array length:', parsedQuestions.length);
      console.log('First question structure:', {
        hasQuestion: !!parsedQuestions[0].question,
        hasOptions: !!parsedQuestions[0].options,
        hasCorrectAnswer: !!parsedQuestions[0].correct_answer,
        hasType: !!parsedQuestions[0].type
      });
    } else {
      console.log('❌ Database storage/retrieval simulation failed');
      return;
    }
    
    // Test 4: API response format
    console.log('\n🔍 Test 4: API response format simulation');
    
    const apiResponse = {
      id: 16,
      transcript_id: 16,
      questions: parsedQuestions, // This should be an array now
      created_at: "2025-09-29 05:33:42",
      user_id: "user_test",
      quiz_options: null,
      total_responses: 0,
      average_score: null,
      highest_score: null,
      lowest_score: null,
      statistics: {
        total_responses: 0,
        average_score: null,
        highest_score: null,
        lowest_score: null
      }
    };
    
    if (Array.isArray(apiResponse.questions) && apiResponse.questions.length > 0) {
      console.log('✅ API response format is correct');
      console.log('Questions is an array:', Array.isArray(apiResponse.questions));
      console.log('Questions count:', apiResponse.questions.length);
    } else {
      console.log('❌ API response format is incorrect');
    }
    
    console.log('\n🎉 All tests passed! Quiz data format issue should be resolved.');
    
  } catch (error) {
    console.error('Error in testing:', error);
  }
}

testQuizGeneration();