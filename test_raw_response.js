const OllamaService = require('./services/ollamaService');

async function testRawResponse() {
    console.log('Testing raw AI response...\n');
    
    const ollamaService = new OllamaService();
    
    const transcript = `
    JavaScript Variables and Data Types

    In this lesson, we covered the fundamentals of JavaScript variables and data types.

    Variable Declaration:
    - var: Function-scoped, can be redeclared
    - let: Block-scoped, cannot be redeclared in same scope
    - const: Block-scoped, cannot be reassigned

    Data Types:
    - Primitive types: string, number, boolean, undefined, null, symbol
    - Non-primitive types: object, array, function

    Examples:
    let name = "John";
    const age = 25;
    var isStudent = true;

    Type coercion happens automatically in JavaScript when different types are used together.
    `;

    try {
        // Call the attemptQuizGeneration method directly to see raw response
        const result = await ollamaService.attemptQuizGeneration(
            transcript, 
            { model: 'llama3.2:latest' }, 
            'llama3.2:latest', 
            5
        );
        
        console.log('=== ATTEMPT RESULT ===');
        console.log('Success:', result.success);
        if (result.success) {
            console.log('Quiz generated successfully!');
            console.log('Number of questions:', result.quiz.questions?.length || 'Unknown');
        } else {
            console.log('Error:', result.error);
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testRawResponse();