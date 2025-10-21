const OllamaService = require('./services/ollamaService');

async function testMinimumQuestions() {
    console.log('Testing minimum question enforcement...\n');
    
    const ollamaService = new OllamaService();
    
    // Test transcript (short to potentially trigger single question generation)
    const shortTranscript = `
    Today we discussed the basics of JavaScript variables. 
    Variables are containers for storing data values. 
    In JavaScript, you can declare variables using var, let, or const.
    `;
    
    console.log('Testing with short transcript that might trigger single question generation...');
    
    try {
        // Test with default options (should enforce minimum 5 questions)
        console.log('\n1. Testing with default options (minimum 5 questions):');
        const result1 = await ollamaService.generateQuiz(shortTranscript, {
            model: 'llama3.2:latest'
        });
        
        if (result1.success) {
            console.log('✅ Quiz generation successful');
            
            // Extract questions array (handle both formats)
            let questions = null;
            if (result1.quiz.questions && Array.isArray(result1.quiz.questions)) {
                questions = result1.quiz.questions;
            } else if (result1.quiz.quiz && result1.quiz.quiz.questions && Array.isArray(result1.quiz.quiz.questions)) {
                questions = result1.quiz.quiz.questions;
            }
            
            if (questions) {
                console.log(`✅ Generated ${questions.length} questions (minimum required: 5)`);
                if (questions.length >= 5) {
                    console.log('✅ Minimum question count requirement met');
                } else {
                    console.log('❌ Minimum question count requirement NOT met');
                }
                
                // Show first question as sample
                console.log('\nSample question:');
                console.log(`Q: ${questions[0].question}`);
                console.log(`Options: ${JSON.stringify(questions[0].options)}`);
                console.log(`Answer: ${questions[0].correct_answer}`);
            } else {
                console.log('❌ Could not extract questions array from response');
                console.log('Raw quiz data:', JSON.stringify(result1.quiz, null, 2));
            }
        } else {
            console.log('❌ Quiz generation failed:', result1.error);
            if (result1.rawResponse) {
                console.log('Raw response:', result1.rawResponse.substring(0, 500) + '...');
            }
        }
        
        // Test with explicit 7 questions
        console.log('\n2. Testing with explicit 7 questions:');
        const result2 = await ollamaService.generateQuiz(shortTranscript, {
            numQuestions: 7,
            model: 'llama3.2:latest'
        });
        
        if (result2.success) {
            console.log('✅ Quiz generation successful');
            
            // Extract questions array
            let questions = null;
            if (result2.quiz.questions && Array.isArray(result2.quiz.questions)) {
                questions = result2.quiz.questions;
            } else if (result2.quiz.quiz && result2.quiz.quiz.questions && Array.isArray(result2.quiz.quiz.questions)) {
                questions = result2.quiz.quiz.questions;
            }
            
            if (questions) {
                console.log(`✅ Generated ${questions.length} questions (requested: 7)`);
                if (questions.length >= 7) {
                    console.log('✅ Requested question count requirement met');
                } else {
                    console.log('❌ Requested question count requirement NOT met');
                }
            }
        } else {
            console.log('❌ Quiz generation failed:', result2.error);
        }
        
        // Test with very short transcript that might fail
        console.log('\n3. Testing with extremely short transcript:');
        const veryShortTranscript = "Variables store data.";
        
        const result3 = await ollamaService.generateQuiz(veryShortTranscript, {
            model: 'llama3.2:latest'
        });
        
        if (result3.success) {
            console.log('✅ Quiz generation successful even with very short transcript');
            
            // Extract questions array
            let questions = null;
            if (result3.quiz.questions && Array.isArray(result3.quiz.questions)) {
                questions = result3.quiz.questions;
            } else if (result3.quiz.quiz && result3.quiz.quiz.questions && Array.isArray(result3.quiz.quiz.questions)) {
                questions = result3.quiz.quiz.questions;
            }
            
            if (questions) {
                console.log(`✅ Generated ${questions.length} questions (minimum required: 5)`);
            }
        } else {
            console.log('❌ Quiz generation failed with very short transcript:', result3.error);
            console.log('This is expected behavior if the transcript is too short to generate 5 meaningful questions');
        }
        
    } catch (error) {
        console.error('Test failed with error:', error);
    }
    
    console.log('\nTest completed!');
}

testMinimumQuestions().catch(console.error);