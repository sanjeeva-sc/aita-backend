const GeminiService = require("./services/ollamaService");

async function testRewriteResponse() {
  const geminiService = new GeminiService();
  
  // Sample question data
  const currentQuestion = {
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correct_answer: "C",
    explanation: "Paris is the capital and largest city of France."
  };
  
  const prompt = "Make this question more challenging";
  
  const rewritePrompt = `
Rewrite this quiz question based on the following instruction: "${prompt}"

Current question:
Question: ${currentQuestion.question}
Options: ${currentQuestion.options.join(', ')}
Correct Answer: ${currentQuestion.correct_answer}
Explanation: ${currentQuestion.explanation || 'No explanation provided'}

Please provide a rewritten version that follows the instruction while maintaining the same educational objective. Return the response in this exact JSON format:
{
  "question": "rewritten question text",
  "options": ["option A", "option B", "option C", "option D"],
  "correct_answer": "A",
  "explanation": "explanation for the correct answer"
}
`;

  try {
    console.log("Sending prompt to AI...");
    const aiResponse = await geminiService.generateContent(rewritePrompt);
    
    console.log("Raw AI Response:");
    console.log("Type:", typeof aiResponse);
    console.log("Content:", aiResponse);
    console.log("---");
    
    // Test the new parsing logic
    let contentToProcess;
    
    // Handle structured response from Gemini service
    if (typeof aiResponse === 'object' && aiResponse.content) {
      contentToProcess = aiResponse.content;
    } else {
      contentToProcess = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
    }
    
    console.log("Content to Process:", contentToProcess);
    console.log("---");
    
    // Extract JSON from content (handle markdown code blocks)
    const jsonMatch = contentToProcess.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                     contentToProcess.match(/\{[\s\S]*\}/);
    
    console.log("JSON Match:", jsonMatch);
    
    if (!jsonMatch) {
      console.log("ERROR: No JSON found in AI response");
      return;
    }
    
    const jsonContent = jsonMatch[1] || jsonMatch[0];
    console.log("JSON Content:", jsonContent);
    console.log("---");
    
    const rewrittenQuestion = JSON.parse(jsonContent);
    console.log("Parsed Question:", rewrittenQuestion);
    console.log("---");
    
    // Test validation
    const isValid = rewrittenQuestion.question && 
                   rewrittenQuestion.options && 
                   Array.isArray(rewrittenQuestion.options) && 
                   rewrittenQuestion.options.length >= 2 &&
                   rewrittenQuestion.correct_answer;
                   
    console.log("Validation Results:");
    console.log("Has question:", !!rewrittenQuestion.question);
    console.log("Has options:", !!rewrittenQuestion.options);
    console.log("Options is array:", Array.isArray(rewrittenQuestion.options));
    console.log("Options length >= 2:", rewrittenQuestion.options && rewrittenQuestion.options.length >= 2);
    console.log("Has correct_answer:", !!rewrittenQuestion.correct_answer);
    console.log("Overall valid:", isValid);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testRewriteResponse();