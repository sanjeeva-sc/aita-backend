const OllamaService = require('./services/ollamaService');

async function debugGeneration() {
    console.log('Debug: Checking what the AI is actually generating...\n');
    
    const ollamaService = new OllamaService();
    
    const transcript = `
    JavaScript variables can be declared using var, let, or const. 
    Functions can be declared using the function keyword or arrow syntax.
    Arrays store ordered lists of values.
    Objects store key-value pairs.
    Control structures include if-else and loops.
    `;
    
    try {
        // Let's manually call the Ollama API to see raw output
        const prompt = `You are a quiz generator. Create a quiz based on the following transcript.

CRITICAL REQUIREMENTS:
- You MUST generate EXACTLY 5 questions - no more, no less
- Each question must have exactly 4 multiple choice options
- Indicate the correct answer clearly
- Return ONLY valid JSON in this exact format:

{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correct_answer": "A) Option 1"
    }
  ]
}

Transcript: ${transcript}

Generate the quiz now:`;

        console.log('Sending prompt to AI...');
        
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama3.2:latest',
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw AI Response:');
        console.log('================');
        console.log(data.response);
        console.log('================\n');
        
        // Try to parse it using the same logic as the service
        try {
            const content = data.response.trim();
            let jsonStart = content.indexOf('{');
            let jsonEnd = content.lastIndexOf('}') + 1;
            
            console.log(`JSON extraction: start=${jsonStart}, end=${jsonEnd}`);
            
            if (jsonStart === -1 || jsonEnd === 0) {
                throw new Error('No valid JSON found in response');
            }
            
            const jsonContent = content.substring(jsonStart, jsonEnd);
            console.log('Extracted JSON:');
            console.log('================');
            console.log(jsonContent);
            console.log('================\n');
            
            const parsed = JSON.parse(jsonContent);
            console.log('✅ Successfully parsed JSON');
            console.log('Structure:', Object.keys(parsed));
            
            if (parsed.questions && Array.isArray(parsed.questions)) {
                console.log(`✅ Found questions array with ${parsed.questions.length} questions`);
                
                parsed.questions.forEach((q, i) => {
                    console.log(`\nQuestion ${i + 1}:`);
                    console.log(`  Has question: ${!!q.question}`);
                    console.log(`  Has options: ${!!q.options} (${Array.isArray(q.options) ? q.options.length : 'not array'})`);
                    console.log(`  Has correct_answer: ${!!q.correct_answer}`);
                    
                    if (q.question) console.log(`  Question: ${q.question.substring(0, 50)}...`);
                    if (q.options && Array.isArray(q.options)) {
                        console.log(`  Options: ${q.options.join(', ')}`);
                    }
                    if (q.correct_answer) console.log(`  Answer: ${q.correct_answer}`);
                });
            } else {
                console.log('❌ No questions array found');
            }
            
        } catch (parseError) {
            console.log('❌ Failed to parse JSON:', parseError.message);
            console.log('This explains why validation is failing');
        }
        
    } catch (error) {
        console.error('Debug failed:', error);
    }
}

debugGeneration().catch(console.error);