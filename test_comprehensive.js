const OllamaService = require('./services/ollamaService');

async function testComprehensive() {
    console.log('Comprehensive test of quiz generation with detailed logging...\n');
    
    const ollamaService = new OllamaService();
    
    const transcript = `
    JavaScript is a programming language used for web development. 
    Variables can be declared using var, let, or const keywords.
    Functions are reusable blocks of code that can accept parameters.
    Arrays store multiple values in an ordered list.
    Objects store data as key-value pairs.
    Control structures like if-else and loops control program flow.
    Event handling allows JavaScript to respond to user interactions.
    The DOM (Document Object Model) represents the structure of web pages.
    `;
    
    try {
        console.log('Attempting quiz generation...');
        
        const result = await ollamaService.generateQuiz(transcript, {
            model: 'llama3.2:latest',
            numQuestions: 5
        });
        
        console.log('\n=== GENERATION RESULT ===');
        console.log('Success:', result.success);
        
        if (result.success) {
            console.log('✅ Quiz generation SUCCESSFUL!');
            console.log('Model used:', result.model);
            
            // Analyze the quiz structure
            console.log('\n=== QUIZ STRUCTURE ANALYSIS ===');
            console.log('Quiz object keys:', Object.keys(result.quiz));
            
            let questions = null;
            if (result.quiz.questions && Array.isArray(result.quiz.questions)) {
                questions = result.quiz.questions;
                console.log('✅ Found questions array directly');
            } else if (result.quiz.quiz && result.quiz.quiz.questions && Array.isArray(result.quiz.quiz.questions)) {
                questions = result.quiz.quiz.questions;
                console.log('✅ Found questions array in nested structure');
            } else {
                console.log('❌ No questions array found');
                console.log('Quiz structure:', JSON.stringify(result.quiz, null, 2));
            }
            
            if (questions) {
                console.log(`✅ Questions count: ${questions.length}`);
                console.log(`✅ Meets minimum requirement (5): ${questions.length >= 5}`);
                
                // Validate each question
                console.log('\n=== INDIVIDUAL QUESTION VALIDATION ===');
                let allValid = true;
                
                questions.forEach((q, i) => {
                    console.log(`\nQuestion ${i + 1}:`);
                    const hasQuestion = !!q.question;
                    const hasOptions = !!q.options && Array.isArray(q.options);
                    const hasAnswer = !!q.correct_answer;
                    const enoughOptions = hasOptions && q.options.length >= 2;
                    
                    console.log(`  ✓ Has question: ${hasQuestion}`);
                    console.log(`  ✓ Has options array: ${hasOptions}`);
                    console.log(`  ✓ Has correct_answer: ${hasAnswer}`);
                    console.log(`  ✓ Enough options (≥2): ${enoughOptions}`);
                    
                    if (hasQuestion) {
                        console.log(`  Question: "${q.question.substring(0, 50)}..."`);
                    }
                    if (hasOptions) {
                        console.log(`  Options (${q.options.length}): ${q.options.join(', ')}`);
                    }
                    if (hasAnswer) {
                        console.log(`  Answer: "${q.correct_answer}"`);
                    }
                    
                    const questionValid = hasQuestion && hasOptions && hasAnswer && enoughOptions;
                    console.log(`  Overall valid: ${questionValid ? '✅' : '❌'}`);
                    
                    if (!questionValid) {
                        allValid = false;
                    }
                });
                
                console.log(`\n=== FINAL RESULT ===`);
                console.log(`✅ All questions valid: ${allValid}`);
                console.log(`✅ Minimum count met: ${questions.length >= 5}`);
                console.log(`🎉 OVERALL SUCCESS: ${allValid && questions.length >= 5}`);
                
                if (allValid && questions.length >= 5) {
                    console.log('\n🎉🎉🎉 QUIZ GENERATION IS WORKING PERFECTLY! 🎉🎉🎉');
                }
            }
            
        } else {
            console.log('❌ Quiz generation FAILED');
            console.log('Error:', result.error);
            
            if (result.rawResponse) {
                console.log('\n=== RAW RESPONSE (first 500 chars) ===');
                console.log(result.rawResponse.substring(0, 500) + '...');
            }
        }
        
    } catch (error) {
        console.error('Test failed with error:', error);
    }
    
    console.log('\nComprehensive test completed!');
}

testComprehensive().catch(console.error);