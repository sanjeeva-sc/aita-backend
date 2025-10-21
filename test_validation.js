const OllamaService = require('./services/ollamaService');

function testValidation() {
    console.log('Testing validation logic with known good data...\n');
    
    const ollamaService = new OllamaService();
    
    // This is the exact structure we saw in the debug output
    const testQuizData = {
        "questions": [
            {
                "question": "What are three ways to declare a JavaScript variable?",
                "options": ["A) Only function declaration", "B) var, let, or const", "C) Array literal", "D) Object literal"],
                "correct_answer": "B) var, let, or const"
            },
            {
                "question": "What type of data structure stores ordered lists of values?",
                "options": ["A) Object", "B) Array", "C) Function", "D) Variable"],
                "correct_answer": "B) Array"
            },
            {
                "question": "What is the primary purpose of a control structure?",
                "options": ["A) To declare variables", "B) To store data", "C) To manage flow and logic", "D) To define functions"],
                "correct_answer": "C) To manage flow and logic"
            },
            {
                "question": "What are two common control structures in JavaScript?",
                "options": ["A) Conditional statements only", "B) Loops and conditional statements", "C) Functions and variables", "D) Arrays and objects"],
                "correct_answer": "B) Loops and conditional statements"
            },
            {
                "question": "What type of data structure stores key-value pairs?",
                "options": ["A) Array", "B) Object", "C) Function", "D) Variable"],
                "correct_answer": "B) Object"
            }
        ]
    };
    
    console.log('Testing with 5 questions (minimum requirement)...');
    const result = ollamaService.validateQuizStructure(testQuizData, 5);
    
    console.log('Validation result:', result);
    
    if (result.isValid) {
        console.log('✅ Validation PASSED - the data structure is correct!');
        console.log('✅ This means our validation logic is working properly');
        console.log('✅ The issue must be elsewhere in the generation process');
    } else {
        console.log('❌ Validation FAILED:', result.error);
        console.log('❌ This explains why quiz generation is failing');
        
        // Let's debug each question individually
        console.log('\nDebugging each question:');
        testQuizData.questions.forEach((q, i) => {
            console.log(`\nQuestion ${i + 1}:`);
            console.log(`  question field: ${typeof q.question} - "${q.question ? q.question.substring(0, 30) + '...' : 'MISSING'}"`);
            console.log(`  options field: ${typeof q.options} - ${Array.isArray(q.options) ? `array with ${q.options.length} items` : 'NOT AN ARRAY'}`);
            console.log(`  correct_answer field: ${typeof q.correct_answer} - "${q.correct_answer || 'MISSING'}"`);
            
            if (!q.question) console.log(`  ❌ Missing question field`);
            if (!q.options) console.log(`  ❌ Missing options field`);
            if (!q.correct_answer) console.log(`  ❌ Missing correct_answer field`);
            if (!Array.isArray(q.options)) console.log(`  ❌ Options is not an array`);
            if (Array.isArray(q.options) && q.options.length < 2) console.log(`  ❌ Options has less than 2 items`);
        });
    }
}

testValidation();