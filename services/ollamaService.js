const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.defaultModel = 'gemini-2.0-flash';
        
        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }
        
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: this.defaultModel });
        
        console.log(`Gemini Service initialized with model: ${this.defaultModel}`);
    }

    /**
     * Check if Gemini API is available
     */
    async checkConnection() {
        try {
            // Test with a simple prompt
            const result = await this.model.generateContent("Hello");
            const response = await result.response;
            
            return {
                connected: true,
                model: this.defaultModel,
                test_response: response.text()
            };
        } catch (error) {
            console.error('Failed to connect to Gemini:', error.message);
            return {
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * Generate content using Gemini
     */
    async generateContent(prompt, options = {}) {
        try {
            console.log(`Generating content with Gemini model: ${this.defaultModel}`);
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            return {
                success: true,
                content: content,
                model: this.defaultModel,
                usage: {
                    // Gemini doesn't provide detailed token usage in the free tier
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                }
            };
        } catch (error) {
            console.error('Error generating content with Gemini:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate structured notes from transcript
     */
    async generateNotes(transcript, options = {}) {
        let prompt = `You are an expert note-taking assistant. Generate comprehensive, well-structured notes from the following transcript.

Format the notes as clean HTML with proper structure:
- Use <h2> for main topics
- Use <h3> for subtopics  
- Use <ul> and <li> for bullet points
- Use <p> for paragraphs
- Use <strong> for emphasis on key terms
- Use <em> for important concepts

Make the notes:
1. Well-organized with clear hierarchy
2. Comprehensive but concise
3. Include all important information
4. Use proper academic formatting
5. Highlight key concepts and definitions

Transcript:
${transcript}

Generate detailed, structured notes in HTML format:`;

        const result = await this.generateContent(prompt, options);
        
        if (result.success) {
            // Clean up the response to ensure it's valid HTML
            let content = result.content;
            
            // Remove any markdown formatting that might have slipped through
            content = content.replace(/```html\n?/g, '').replace(/```\n?/g, '');
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            return {
                ...result,
                content: content,
                format: 'html'
            };
        }
        
        return result;
    }

    /**
     * Generate quiz questions from transcript
     */
    async generateQuiz(transcript, options = {}) {
        const minQuestions = options.minQuestions || 5;
        
        const prompt = `You are an expert quiz creator. Generate exactly ${minQuestions} multiple-choice questions based on the following transcript.

IMPORTANT: Respond with ONLY a valid JSON object in this exact format:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of why this answer is correct"
    }
  ]
}

Requirements:
1. Generate exactly ${minQuestions} questions
2. Each question must have exactly 4 options
3. The "correct" field must be the index (0-3) of the correct answer
4. Questions should test understanding, not just memorization
5. Include a brief explanation for each correct answer
6. Make sure all questions are directly related to the transcript content
7. Vary the difficulty levels
8. Do not include any text outside the JSON object

Transcript:
${transcript}`;

        const result = await this.generateContent(prompt, options);
        
        if (result.success) {
            try {
                // Clean the response to extract JSON
                let content = result.content.trim();
                
                // Remove any markdown formatting
                content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
                
                // Find JSON object in the response
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    content = jsonMatch[0];
                }
                
                const quizData = JSON.parse(content);
                
                // Validate the quiz structure
                if (this.validateQuizStructure(quizData, minQuestions)) {
                    return {
                        ...result,
                        content: quizData,
                        format: 'json'
                    };
                } else {
                    throw new Error('Generated quiz does not meet requirements');
                }
            } catch (parseError) {
                console.error('Error parsing quiz JSON:', parseError);
                console.error('Raw response:', result.content);
                
                return {
                    success: false,
                    error: `Failed to parse quiz JSON: ${parseError.message}`,
                    rawResponse: result.content
                };
            }
        }
        
        return result;
    }

    /**
     * Validate quiz structure
     */
    validateQuizStructure(quizData, minQuestions = 5) {
        try {
            if (!quizData || typeof quizData !== 'object') {
                console.error('Quiz data is not an object');
                return false;
            }
            
            if (!Array.isArray(quizData.questions)) {
                console.error('Quiz questions is not an array');
                return false;
            }
            
            if (quizData.questions.length < minQuestions) {
                console.error(`Quiz has ${quizData.questions.length} questions, minimum required: ${minQuestions}`);
                return false;
            }
            
            for (let i = 0; i < quizData.questions.length; i++) {
                const q = quizData.questions[i];
                
                if (!q.question || typeof q.question !== 'string') {
                    console.error(`Question ${i + 1}: Invalid question text`);
                    return false;
                }
                
                if (!Array.isArray(q.options) || q.options.length !== 4) {
                    console.error(`Question ${i + 1}: Must have exactly 4 options`);
                    return false;
                }
                
                if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) {
                    console.error(`Question ${i + 1}: Correct answer index must be 0-3`);
                    return false;
                }
                
                if (!q.explanation || typeof q.explanation !== 'string') {
                    console.error(`Question ${i + 1}: Missing explanation`);
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error validating quiz structure:', error);
            return false;
        }
    }

    /**
     * Format content as HTML (utility method)
     */
    formatAsHTML(content) {
        if (typeof content !== 'string') {
            return content;
        }
        
        // Basic markdown to HTML conversion
        let html = content;
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = `<p>${html}</p>`;
        
        return html;
    }

    /**
     * Get available models (for compatibility)
     */
    async getAvailableModels() {
        return {
            success: true,
            models: [this.defaultModel],
            current: this.defaultModel
        };
    }
}

module.exports = GeminiService;