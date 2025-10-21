const OllamaService = require('./services/ollamaService');

async function testFinalValidation() {
    console.log('Final validation test - ensuring 5+ questions are generated...\n');
    
    const ollamaService = new OllamaService();
    
    // Substantial transcript that should easily generate 5+ questions
    const substantialTranscript = `
    Welcome to today's lecture on JavaScript fundamentals. We'll be covering several important topics.

    First, let's discuss variables. In JavaScript, you can declare variables using three keywords: var, let, and const. 
    The 'var' keyword has function scope, while 'let' and 'const' have block scope. The 'const' keyword creates 
    constants that cannot be reassigned after declaration.

    Next, we'll explore data types. JavaScript has several primitive data types including string, number, boolean, 
    undefined, null, and symbol. There are also non-primitive types like objects and arrays.

    Functions are a crucial part of JavaScript. You can declare functions using the function keyword, or create 
    arrow functions using the => syntax. Functions can accept parameters and return values.

    Control structures help manage program flow. These include if-else statements, switch statements, and loops 
    like for, while, and do-while. Each serves different purposes in controlling how your code executes.

    Finally, we discussed objects and arrays. Objects store key-value pairs and can contain methods. Arrays are 
    ordered lists of values that can be accessed by index. Both are essential for organizing and manipulating data.

    Understanding these fundamentals is crucial for becoming proficient in JavaScript programming.
    `;
    
    try {
        console.log('Testing with substantial transcript...');
        
        const result = await ollamaService.generateQuiz(substantialTranscript, {
            model: 'llama3.2:latest',
            numQuestions: 5
        });
        
        if (result.success) {
            console.log('✅ Quiz generation successful!');
            
            // Extract questions array (handle both formats)
            let questions = null;
            if (result.quiz.questions && Array.isArray(result.quiz.questions)) {
                questions = result.quiz.questions;
            } else if (result.quiz.quiz && result.quiz.quiz.questions && Array.isArray(result.quiz.quiz.questions)) {
                questions = result.quiz.quiz.questions;
            }
            
            if (questions) {
                console.log(`✅ Generated ${questions.length} questions`);
                
                if (questions.length >= 5) {
                    console.log('✅ MINIMUM QUESTION REQUIREMENT MET!');
                    
                    // Validate each question
                    let allValid = true;
                    for (let i = 0; i < questions.length; i++) {
                        const q = questions[i];
                        if (!q.question || !q.options || !q.correct_answer) {
                            console.log(`❌ Question ${i + 1} is missing required fields`);
                            allValid = false;
                        } else if (!Array.isArray(q.options) || q.options.length < 2) {
                            console.log(`❌ Question ${i + 1} has insufficient options`);
                            allValid = false;
                        } else {
                            console.log(`✅ Question ${i + 1} is valid`);
                        }
                    }
                    
                    if (allValid) {
                        console.log('\n🎉 ALL QUESTIONS ARE VALID!');
                        console.log('🎉 MINIMUM QUESTION ENFORCEMENT IS WORKING!');
                        
                        // Show sample questions
                        console.log('\nSample questions:');
                        for (let i = 0; i < Math.min(3, questions.length); i++) {
                            console.log(`\n${i + 1}. ${questions[i].question}`);
                            console.log(`   Options: ${JSON.stringify(questions[i].options)}`);
                            console.log(`   Answer: ${questions[i].correct_answer}`);
                        }
                    } else {
                        console.log('\n❌ Some questions are invalid');
                    }
                } else {
                    console.log('❌ Minimum question count requirement NOT met');
                }
            } else {
                console.log('❌ Could not extract questions array from response');
                console.log('Raw quiz data structure:');
                console.log(Object.keys(result.quiz));
            }
        } else {
            console.log('❌ Quiz generation failed:', result.error);
            console.log('This indicates the validation is working - rejecting inadequate responses');
        }
        
    } catch (error) {
        console.error('Test failed with error:', error);
    }
    
    console.log('\nFinal validation test completed!');
}

testFinalValidation().catch(console.error);