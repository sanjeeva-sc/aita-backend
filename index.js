require("dotenv").config();
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");
const GeminiService = require("./services/ollamaService");

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Gemini service
const geminiService = new GeminiService();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(express.text());

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// Ensure data directory exists for Cloud Run
const dataDir = "./data";
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database with proper path for Cloud Run
const dbPath = process.env.DB_PATH || "./data/transcript_notes.db";
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log(`Connected to SQLite database at ${dbPath}`);
    initializeDatabase();
  }
});

// Create tables if they don't exist
function initializeDatabase() {
  db.serialize(() => {
    // Notes table
    db.run(`CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript TEXT NOT NULL,
      notes TEXT NOT NULL,
      format_type TEXT DEFAULT 'html',
      template_id TEXT DEFAULT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Templates table
    db.run(`CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      structure TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Quiz table
    db.run(`CREATE TABLE IF NOT EXISTS quiz (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript_id INTEGER,
      questions TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT DEFAULT NULL,
      description TEXT DEFAULT NULL,
      time_limit INTEGER DEFAULT NULL,
      show_answers BOOLEAN DEFAULT 1,
      shuffle_questions BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transcript_id) REFERENCES notes (id)
    )`);

    // Transcripts table for storing uploaded transcripts and AI-generated metadata
    db.run(`CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT NULL,
      notes_id INTEGER,
      quiz_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (notes_id) REFERENCES notes (id),
      FOREIGN KEY (quiz_id) REFERENCES quiz (id)
    )`);

    // Shared quizzes table for quiz sharing functionality
    db.run(`CREATE TABLE IF NOT EXISTS shared_quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      share_token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (quiz_id) REFERENCES quiz (id)
    )`);

    // Student responses table for tracking quiz submissions
    db.run(`CREATE TABLE IF NOT EXISTS student_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shared_quiz_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      student_uid TEXT,
      answers TEXT NOT NULL,
      score INTEGER,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shared_quiz_id) REFERENCES shared_quizzes (id)
    )`);

    // Add new columns to existing notes table if they don't exist
    db.run(
      `ALTER TABLE notes ADD COLUMN format_type TEXT DEFAULT 'html'`,
      (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error adding format_type column:", err);
        }
      }
    );

    // Add customization options columns
    db.run(
      `ALTER TABLE notes ADD COLUMN notes_options TEXT DEFAULT NULL`,
      (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error adding notes_options column:", err);
        }
      }
    );

    db.run(
      `ALTER TABLE quiz ADD COLUMN quiz_options TEXT DEFAULT NULL`,
      (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error adding quiz_options column:", err);
        }
      }
    );

    // Add new quiz columns for enhanced quiz functionality
    db.run(
      `ALTER TABLE quiz ADD COLUMN title TEXT DEFAULT NULL`,
      (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error adding title column:", err);
        }
      }
    );

    db.run(
      `ALTER TABLE quiz ADD COLUMN description TEXT DEFAULT NULL`,
      (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error adding description column:", err);
        }
      }
    );

    db.run(
      `ALTER TABLE quiz ADD COLUMN time_limit INTEGER DEFAULT NULL`,
      (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error adding time_limit column:", err);
        }
      }
    );

    db.run(
      `ALTER TABLE quiz ADD COLUMN show_answers BOOLEAN DEFAULT 1`,
      (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error adding show_answers column:", err);
        }
      }
    );

    db.run(
      `ALTER TABLE quiz ADD COLUMN shuffle_questions BOOLEAN DEFAULT 0`,
      (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error adding shuffle_questions column:", err);
        }
      }
    );

    db.run(
      `ALTER TABLE notes ADD COLUMN template_id TEXT DEFAULT NULL`,
      (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error("Error adding template_id column:", err);
        }
      }
    );

    db.run(`ALTER TABLE notes ADD COLUMN user_id TEXT DEFAULT NULL`, (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding user_id column to notes:", err);
      }
    });

    db.run(`ALTER TABLE quiz ADD COLUMN user_id TEXT DEFAULT NULL`, (err) => {
      if (err && !err.message.includes("duplicate column")) {
        console.error("Error adding user_id column to quiz:", err);
      }
    });

    // Add analytics tables
    db.run(`CREATE TABLE IF NOT EXISTS competencies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      subject TEXT NOT NULL,
      category TEXT DEFAULT 'Standard',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS quiz_competencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      competency_id INTEGER NOT NULL,
      question_index INTEGER,
      FOREIGN KEY (quiz_id) REFERENCES quiz (id),
      FOREIGN KEY (competency_id) REFERENCES competencies (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
      session_end DATETIME,
      device_type TEXT,
      user_agent TEXT
    )`);

    // Insert default templates
    insertDefaultTemplates();
    insertDefaultCompetencies();
  });
}

// Function to insert default templates
function insertDefaultTemplates() {
  const templates = [
    {
      id: "science",
      name: "Science Notes",
      subject: "Science",
      structure: `<h1>Scientific Concepts</h1>
<h2>Key Terms and Definitions</h2>
<ul>
<li><strong>Term:</strong> Definition</li>
</ul>
<h2>Main Principles</h2>
<ul>
<li>Principle 1</li>
<li>Principle 2</li>
</ul>
<h2>Formulas and Equations</h2>
<p><strong>Formula:</strong> Description</p>
<h2>Examples and Applications</h2>
<ul>
<li>Example 1</li>
<li>Example 2</li>
</ul>
<h2>Summary</h2>
<p>Key takeaways...</p>`,
    },
    {
      id: "literature",
      name: "Literature Notes",
      subject: "Literature",
      structure: `<h1>Literary Analysis</h1>
<h2>Work Information</h2>
<ul>
<li><strong>Title:</strong></li>
<li><strong>Author:</strong></li>
<li><strong>Genre:</strong></li>
<li><strong>Publication Date:</strong></li>
</ul>
<h2>Plot Summary</h2>
<p>Brief overview of the main events...</p>
<h2>Character Analysis</h2>
<ul>
<li><strong>Main Character:</strong> Description and development</li>
<li><strong>Supporting Characters:</strong> Roles and significance</li>
</ul>
<h2>Themes and Motifs</h2>
<ul>
<li>Theme 1: Explanation</li>
<li>Theme 2: Explanation</li>
</ul>
<h2>Literary Devices</h2>
<ul>
<li><strong>Device:</strong> Examples and effect</li>
</ul>
<h2>Critical Interpretation</h2>
<p>Analysis and personal reflection...</p>`,
    },
    {
      id: "history",
      name: "History Notes",
      subject: "History",
      structure: `<h1>Historical Event/Period</h1>
<h2>Timeline</h2>
<ul>
<li><strong>Date:</strong> Event</li>
<li><strong>Date:</strong> Event</li>
</ul>
<h2>Key Figures</h2>
<ul>
<li><strong>Name:</strong> Role and significance</li>
<li><strong>Name:</strong> Role and significance</li>
</ul>
<h2>Causes</h2>
<ul>
<li>Primary cause</li>
<li>Secondary causes</li>
</ul>
<h2>Major Events</h2>
<ol>
<li>Event 1: Description</li>
<li>Event 2: Description</li>
</ol>
<h2>Consequences and Impact</h2>
<ul>
<li><strong>Short-term:</strong> Immediate effects</li>
<li><strong>Long-term:</strong> Lasting impact</li>
</ul>
<h2>Historical Significance</h2>
<p>Why this event/period matters...</p>`,
    },
  ];

  templates.forEach((template) => {
    db.run(
      `INSERT OR IGNORE INTO templates (id, name, subject, structure) VALUES (?, ?, ?, ?)`,
      [template.id, template.name, template.subject, template.structure],
      (err) => {
        if (err) {
          console.error("Error inserting template:", err);
        }
      }
    );
  });
}

// Insert default competencies for curriculum mapping
function insertDefaultCompetencies() {
  const defaultCompetencies = [
    {
      name: "Reading Comprehension",
      subject: "English",
      standard: "CCSS.ELA-LITERACY.RST.9-10.7",
      description: "Translate quantitative or technical information",
    },
    {
      name: "Mathematical Problem Solving",
      subject: "Mathematics",
      standard: "CCSS.MATH.CONTENT.HSA.REI.B.3",
      description: "Solve linear equations and inequalities",
    },
    {
      name: "Scientific Method",
      subject: "Science",
      standard: "NGSS.HS-ETS1-1",
      description: "Analyze major global challenges",
    },
    {
      name: "Historical Analysis",
      subject: "History",
      standard: "NCSS.2",
      description: "Analyze historical events and their causes",
    },
    {
      name: "Critical Thinking",
      subject: "General",
      standard: "AASL.1.1.4",
      description: "Find, evaluate, and select appropriate sources",
    },
    {
      name: "Communication Skills",
      subject: "General",
      standard: "CCSS.ELA-LITERACY.SL.9-10.4",
      description: "Present information clearly and concisely",
    },
  ];

  defaultCompetencies.forEach((competency) => {
    db.run(
      `INSERT OR IGNORE INTO competencies (name, subject, standard, description) VALUES (?, ?, ?, ?)`,
      [
        competency.name,
        competency.subject,
        competency.standard,
        competency.description,
      ],
      (err) => {
        if (err) {
          console.error("Error inserting competency:", err);
        }
      }
    );
  });
}

// Helper function to generate notes using Gemini AI
async function generateNotes(
  transcript,
  templateId = null,
  customOptions = null
) {
  try {
    // Prepare options for Gemini service
    const geminiOptions = {
      format: "html",
    };

    // Apply custom options if provided
    if (customOptions) {
      const options =
        typeof customOptions === "string"
          ? JSON.parse(customOptions)
          : customOptions;

      // Map custom options to Gemini service format
      if (options.focusAreas && options.focusAreas.length > 0) {
        geminiOptions.focus = options.focusAreas.join(", ");
      }

      if (options.structureType) {
        geminiOptions.structure = options.structureType;
      }

      if (options.academicLevel) {
        geminiOptions.academicLevel = options.academicLevel;
      }

      if (options.includeExamples) {
        geminiOptions.includeExamples = options.includeExamples;
      }

      if (options.includeQuestions) {
        geminiOptions.includeQuestions = options.includeQuestions;
      }

      if (options.includeSummary) {
        geminiOptions.includeSummary = options.includeSummary;
      }

      if (options.includeKeyTerms) {
        geminiOptions.includeKeywords = options.includeKeyTerms;
      }

      if (options.customInstructions) {
        geminiOptions.customInstructions = options.customInstructions;
      }
    }

    // Handle template if provided
    if (templateId) {
      const template = await new Promise((resolve, reject) => {
        db.get(
          "SELECT * FROM templates WHERE id = ?",
          [templateId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (template) {
        geminiOptions.template = template;
      }
    }

    // Generate notes using Gemini service
    const result = await geminiService.generateNotes(transcript, geminiOptions);

    if (result.success) {
      return result.content;
    } else {
      throw new Error(result.error || "Failed to generate notes with Gemini");
    }
  } catch (error) {
    console.error("Error generating notes:", error);
    throw new Error("Failed to generate notes");
  }
}

// Helper function to generate quiz using Gemini AI
async function generateQuiz(transcript, customOptions = null) {
  try {
    // Prepare options for Gemini service
    const geminiOptions = {};

    // Apply custom options if provided
    if (customOptions) {
      const options =
        typeof customOptions === "string"
          ? JSON.parse(customOptions)
          : customOptions;

      // Map options to Gemini service format
      geminiOptions.numQuestions = options.numberOfQuestions || 5;
      geminiOptions.questionTypes = (
        options.questionTypes || ["multiple-choice"]
      ).join(",");
      geminiOptions.difficulty = options.difficultyLevel || "medium";
      geminiOptions.academicLevel = options.academicLevel || "high-school";
      geminiOptions.includeExplanations =
        options.includeExplanations !== undefined
          ? options.includeExplanations
          : true;
      geminiOptions.includeHints = options.includeHints || false;

      if (options.subject) {
        geminiOptions.subject = options.subject;
      }

      if (options.focusAreas && options.focusAreas.length > 0) {
        geminiOptions.topics = options.focusAreas.join(", ");
      }

      if (options.keyTopics && options.keyTopics.length > 0) {
        geminiOptions.topics =
          (geminiOptions.topics ? geminiOptions.topics + ", " : "") +
          options.keyTopics.join(", ");
      }

      if (options.customInstructions) {
        geminiOptions.customInstructions = options.customInstructions;
      }

      if (
        options.selectedCompetencies &&
        options.selectedCompetencies.length > 0
      ) {
        geminiOptions.competencies = options.selectedCompetencies;
      }
    }

    // Generate quiz using Gemini service
    const result = await geminiService.generateQuiz(transcript, geminiOptions);
    console.log("🔍 Gemini service result:", JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("🔍 Original questions from Gemini:", JSON.stringify(result.content.questions, null, 2));
      
      // Extract questions array from the quiz result and transform correct index to letter
      const questionsArray = result.content.questions.map((question) => {
        const { correct, ...questionWithoutCorrect } = question;
        const transformedQuestion = {
          ...questionWithoutCorrect,
          correct_answer: ["A", "B", "C", "D"][correct],
        };
        console.log(`🔍 Transforming question: correct=${correct} -> correct_answer=${transformedQuestion.correct_answer}`);
        return transformedQuestion;
      });
      
      console.log("🔍 Transformed questions array:", JSON.stringify(questionsArray, null, 2));
      const stringifiedResult = JSON.stringify(questionsArray);
      console.log("🔍 Final stringified result:", stringifiedResult);
      
      return stringifiedResult;
    } else {
      throw new Error(result.error || "Failed to generate quiz with Gemini");
    }
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to generate quiz");
  }
}

// Routes

// Generate AI metadata for a transcript
async function generateTranscriptMetadata(transcript) {
  try {
    const prompt = `You are an assistant that extracts concise metadata from a transcript. 
Return ONLY a valid JSON object with keys: 
{
  "title": string, // short descriptive title
  "summary": string, // 2-3 sentence overview
  "keywords": string[], // 5-10 important terms
  "topics": string[] // 3-8 main topics
}

Transcript:\n${transcript}`;

    const result = await geminiService.generateContent(prompt);
    if (!result.success) {
      throw new Error(result.error || "Failed to generate metadata");
    }

    // Try to parse JSON; if parsing fails, store raw content
    let content = (result.content || "").trim();
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    let metadataObj = null;
    try {
      metadataObj = JSON.parse(content);
    } catch (e) {
      // Fallback to minimal metadata
      metadataObj = {
        title: "Transcript",
        summary: "",
        keywords: [],
        topics: [],
      };
    }

    return JSON.stringify(metadataObj);
  } catch (error) {
    console.error("Error generating transcript metadata:", error);
    // Return minimal metadata when AI fails
    return JSON.stringify({
      title: "Transcript",
      summary: "",
      keywords: [],
      topics: [],
    });
  }
}

// Upload transcript and generate notes/quiz
app.post(
  "/api/upload",
  ClerkExpressRequireAuth(),
  upload.single("transcript"),
  async (req, res) => {
    try {
      const userId = req.auth.userId;
      let transcriptText = "";
      let templateId = null;
      let notesOptions = null;
      let quizOptions = null;

      if (req.file) {
        // Read uploaded file
        transcriptText = fs.readFileSync(req.file.path, "utf8");
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        // Check for template ID and customization options in form data
        templateId = req.body.templateId || null;
        notesOptions = req.body.notesOptions || null;
        quizOptions = req.body.quizOptions || null;
      } else if (req.body) {
        // Handle JSON body with template selection and customization options
        if (typeof req.body === "string") {
          try {
            const bodyData = JSON.parse(req.body);
            transcriptText = bodyData.transcript || req.body;
            templateId = bodyData.templateId || null;
            notesOptions = bodyData.notesOptions || null;
            quizOptions = bodyData.quizOptions || null;
          } catch (e) {
            // If not JSON, treat as plain text
            transcriptText = req.body;
          }
        } else if (req.body && typeof req.body === "object") {
          transcriptText = req.body.transcript || "";
          templateId = req.body.templateId || null;
          notesOptions = req.body.notesOptions || null;
          quizOptions = req.body.quizOptions || null;
        } else {
          transcriptText = req.body;
        }
      }

      if (!transcriptText || transcriptText.trim() === "") {
        return res.status(400).json({ error: "No transcript provided" });
      }

      // Convert options to JSON strings if they're objects
      const notesOptionsJson = notesOptions
        ? typeof notesOptions === "string"
          ? notesOptions
          : JSON.stringify(notesOptions)
        : null;
      const quizOptionsJson = quizOptions
        ? typeof quizOptions === "string"
          ? quizOptions
          : JSON.stringify(quizOptions)
        : null;

      // Check Gemini service connection before processing
      const connectionCheck = await geminiService.checkConnection();
      if (!connectionCheck.connected) {
        console.error("Gemini service unavailable:", connectionCheck.error);
        return res.status(503).json({
          error:
            "AI service is currently unavailable. Please ensure Gemini is properly configured and try again.",
          details: connectionCheck.error,
        });
      }

      // Generate notes, quiz, and transcript metadata with template support and customization options
      let notes, quiz, metadataJson;
      try {
        [notes, quiz, metadataJson] = await Promise.all([
          generateNotes(transcriptText, templateId, notesOptions),
          generateQuiz(transcriptText, quizOptions),
          generateTranscriptMetadata(transcriptText),
        ]);
      } catch (aiError) {
        console.error("AI generation error:", aiError);
        return res.status(500).json({
          error:
            "Failed to generate content with AI service. Please check if Gemini is properly configured and the required models are available.",
          details: aiError.message,
        });
      }

      // Store in database with user_id and customization options
      db.run(
        "INSERT INTO notes (transcript, notes, format_type, template_id, notes_options, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        [transcriptText, notes, "html", templateId, notesOptionsJson, userId],
        function (err) {
          if (err) {
            console.error("Error saving notes:", err);
            return res.status(500).json({ error: "Failed to save notes" });
          }

          const notesId = this.lastID;

          // quiz is already a stringified questions array from generateQuiz function
          db.run(
            "INSERT INTO quiz (transcript_id, questions, quiz_options, user_id) VALUES (?, ?, ?, ?)",
            [notesId, quiz, quizOptionsJson, userId],
            function (err) {
              if (err) {
                console.error("Error saving quiz:", err);
                return res.status(500).json({ error: "Failed to save quiz" });
              }

              const quizId = this.lastID;

              // Save transcript record with metadata and links
              db.run(
                "INSERT INTO transcripts (user_id, content, metadata, notes_id, quiz_id) VALUES (?, ?, ?, ?, ?)",
                [userId, transcriptText, metadataJson, notesId, quizId],
                function (err) {
                  if (err) {
                    console.error("Error saving transcript record:", err);
                    // Do not fail the whole request; return success with notes/quiz IDs
                    return res.json({
                      success: true,
                      notesId: notesId,
                      quizId: quizId,
                      message:
                        "Transcript processed with notes and quiz, but metadata save failed",
                    });
                  }

                  const transcriptId = this.lastID;
                  res.json({
                    success: true,
                    transcriptId,
                    notesId: notesId,
                    quizId: quizId,
                    message: "Transcript processed successfully",
                  });
                }
              );
            }
          );
        }
      );
    } catch (error) {
      console.error("Error processing transcript:", error);
      res.status(500).json({ error: "Failed to process transcript" });
    }
  }
);

// List transcripts for the authenticated user
app.get("/api/transcripts", ClerkExpressRequireAuth(), (req, res) => {
  try {
    const userId = req.auth.userId;
    db.all(
      "SELECT t.id, t.content, t.metadata, t.notes_id, t.quiz_id, t.created_at FROM transcripts t WHERE t.user_id = ? ORDER BY t.created_at DESC",
      [userId],
      (err, rows) => {
        if (err) {
          console.error("Error fetching transcripts:", err);
          return res.status(500).json({ error: "Failed to fetch transcripts" });
        }

        const result = rows.map((row) => {
          let meta = {};
          try {
            meta = JSON.parse(row.metadata || "{}");
          } catch (e) {
            meta = {};
          }

          const wordCount = row.content
            ? row.content.trim().split(/\s+/).length
            : 0;
          return {
            id: row.id,
            title: meta.title || `Transcript ${row.id}`,
            contentSnippet: (row.content || "").slice(0, 300),
            uploadDate: row.created_at,
            status: "completed",
            notesGenerated: !!row.notes_id,
            quizGenerated: !!row.quiz_id,
            notesId: row.notes_id || null,
            quizId: row.quiz_id || null,
            wordCount,
            metadata: meta,
          };
        });

        res.json(result);
      }
    );
  } catch (error) {
    console.error("Error in /api/transcripts:", error);
    res.status(500).json({ error: "Failed to list transcripts" });
  }
});

// Get templates
app.get("/api/templates", (req, res) => {
  db.all("SELECT * FROM templates ORDER BY subject, name", [], (err, rows) => {
    if (err) {
      console.error("Error fetching templates:", err);
      return res.status(500).json({ error: "Failed to fetch templates" });
    }
    res.json(rows);
  });
});

// Get notes
app.get("/api/notes/:id?", ClerkExpressRequireAuth(), (req, res) => {
  const { id } = req.params;
  const userId = req.auth.userId;

  if (id) {
    // Get specific notes by ID for the authenticated user
    db.get(
      "SELECT * FROM notes WHERE id = ? AND user_id = ? ORDER BY created_at DESC",
      [id, userId],
      (err, row) => {
        if (err) {
          console.error("Error fetching notes:", err);
          return res.status(500).json({ error: "Failed to fetch notes" });
        }

        if (!row) {
          return res.status(404).json({ error: "Notes not found" });
        }

        res.json(row);
      }
    );
  } else {
    // Get all notes for the authenticated user
    db.all(
      "SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
      (err, rows) => {
        if (err) {
          console.error("Error fetching notes:", err);
          return res.status(500).json({ error: "Failed to fetch notes" });
        }

        res.json(rows);
      }
    );
  }
});

// Get quiz
app.get("/api/quiz/:id?", ClerkExpressRequireAuth(), (req, res) => {
  const { id } = req.params;
  const userId = req.auth.userId;

  if (id) {
    // Get quiz by quiz ID for the authenticated user
    db.get(
      "SELECT * FROM quiz WHERE id = ? AND user_id = ?",
      [id, userId],
      (err, row) => {
        if (err) {
          console.error("Error fetching quiz:", err);
          return res.status(500).json({ error: "Failed to fetch quiz" });
        }

        if (!row) {
          return res.status(404).json({ error: "Quiz not found" });
        }

        try {
          // Parse the JSON quiz data
          const parsedQuestions = JSON.parse(row.questions);

          // Handle both old and new formats
          let questionsArray;
          if (Array.isArray(parsedQuestions)) {
            // New format: questions is already an array
            questionsArray = parsedQuestions;
          } else if (
            parsedQuestions.questions &&
            Array.isArray(parsedQuestions.questions)
          ) {
            // Old format: questions is nested in a quiz object
            questionsArray = parsedQuestions.questions;
          } else if (parsedQuestions.quiz && parsedQuestions.quiz.questions) {
            // Very old format: questions is nested deeper
            questionsArray = parsedQuestions.quiz.questions;
          } else {
            // Fallback: treat as single question object
            questionsArray = [parsedQuestions];
          }

          res.json({ ...row, questions: questionsArray });
        } catch (parseError) {
          // If JSON parsing fails, return raw text
          res.json(row);
        }
      }
    );
  } else {
    // Get all quizzes for the authenticated user with results statistics
    db.all(
      `
      SELECT 
        q.*,
        COUNT(sr.id) as total_responses,
        AVG(sr.score) as average_score,
        MAX(sr.score) as highest_score,
        MIN(sr.score) as lowest_score
      FROM quiz q
      LEFT JOIN shared_quizzes sq ON q.id = sq.quiz_id
      LEFT JOIN student_responses sr ON sq.id = sr.shared_quiz_id
      WHERE q.user_id = ?
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `,
      [userId],
      (err, rows) => {
        if (err) {
          console.error("Error fetching quizzes:", err);
          return res.status(500).json({ error: "Failed to fetch quizzes" });
        }

        // Parse quiz questions and format the response
        const formattedQuizzes = rows.map((row) => {
          try {
            // Parse the JSON quiz data
            const parsedQuestions = JSON.parse(row.questions);

            // Handle both old and new formats
            let questionsArray;
            if (Array.isArray(parsedQuestions)) {
              // New format: questions is already an array
              questionsArray = parsedQuestions;
            } else if (
              parsedQuestions.questions &&
              Array.isArray(parsedQuestions.questions)
            ) {
              // Old format: questions is nested in a quiz object
              questionsArray = parsedQuestions.questions;
            } else if (parsedQuestions.quiz && parsedQuestions.quiz.questions) {
              // Very old format: questions is nested deeper
              questionsArray = parsedQuestions.quiz.questions;
            } else {
              // Fallback: treat as single question object
              questionsArray = [parsedQuestions];
            }

            return {
              ...row,
              questions: questionsArray,
              statistics: {
                total_responses: row.total_responses || 0,
                average_score: row.average_score
                  ? Math.round(row.average_score * 100) / 100
                  : null,
                highest_score: row.highest_score || null,
                lowest_score: row.lowest_score || null,
              },
            };
          } catch (parseError) {
            return {
              ...row,
              statistics: {
                total_responses: row.total_responses || 0,
                average_score: row.average_score
                  ? Math.round(row.average_score * 100) / 100
                  : null,
                highest_score: row.highest_score || null,
                lowest_score: row.lowest_score || null,
              },
            };
          }
        });

        res.json(formattedQuizzes);
      }
    );
  }
});

// Share quiz endpoint - generates shareable link
app.post("/api/quiz/:id/share", ClerkExpressRequireAuth(), (req, res) => {
  const { id } = req.params;

  // First, verify the quiz exists
  db.get("SELECT * FROM quiz WHERE id = ?", [id], (err, quiz) => {
    if (err) {
      console.error("Error fetching quiz:", err);
      return res.status(500).json({ error: "Failed to fetch quiz" });
    }

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Generate unique share token
    const shareToken = uuidv4();

    // Set expiration to 30 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Insert into shared_quizzes table
    db.run(
      "INSERT INTO shared_quizzes (quiz_id, share_token, expires_at) VALUES (?, ?, ?)",
      [id, shareToken, expiresAt.toISOString()],
      function (err) {
        if (err) {
          console.error("Error creating shared quiz:", err);
          return res
            .status(500)
            .json({ error: "Failed to create shareable link" });
        }

        // Return the shareable URL
        const shareableUrl = `/quiz/take/${shareToken}`;

        res.json({
          success: true,
          shareToken,
          shareableUrl,
          expiresAt: expiresAt.toISOString(),
          message: "Shareable quiz link created successfully",
        });
      }
    );
  });
});

// Public endpoint to get quiz by share token (no authentication required)
app.get("/api/quiz/shared/:token", (req, res) => {
  const { token } = req.params;

  // First, find the shared quiz by token and check if it's valid and not expired
  db.get(
    `SELECT sq.*, q.questions, q.created_at as quiz_created_at 
     FROM shared_quizzes sq 
     JOIN quiz q ON sq.quiz_id = q.id 
     WHERE sq.share_token = ? AND (sq.expires_at IS NULL OR sq.expires_at > datetime('now'))`,
    [token],
    (err, row) => {
      if (err) {
        console.error("Error fetching shared quiz:", err);
        return res.status(500).json({ error: "Failed to fetch quiz" });
      }

      if (!row) {
        return res.status(404).json({ error: "Quiz not found or expired" });
      }

      try {
        // Parse the JSON quiz data
        const quizData = JSON.parse(row.questions);

        // The quiz data has a 'questions' array, so we need to access it properly
        const questions = quizData.questions || quizData;

        // Ensure questions is an array before mapping
        if (!Array.isArray(questions)) {
          console.error("Questions is not an array:", questions);
          return res
            .status(500)
            .json({
              error: "Invalid quiz data format - questions must be an array",
            });
        }

        // Remove correct answers from questions for student view
        const questionsWithoutAnswers = questions.map((question) => {
          const { correct_answer, ...questionWithoutAnswer } = question;
          return questionWithoutAnswer;
        });

        // Return quiz data without correct answers
        res.json({
          id: row.quiz_id,
          questions: { questions: questionsWithoutAnswers },
          created_at: row.quiz_created_at,
          share_token: row.share_token,
          expires_at: row.expires_at,
        });
      } catch (parseError) {
        console.error("Error parsing quiz questions:", parseError);
        return res.status(500).json({ error: "Invalid quiz data format" });
      }
    }
  );
});

// Submit quiz answers
app.post("/api/quiz/shared/:token/submit", (req, res) => {
  const { token } = req.params;
  const { student_name, student_uid, answers } = req.body;

  // Validate required fields
  if (!student_name || !answers || !Array.isArray(answers)) {
    return res.status(400).json({
      error:
        "Missing required fields: student_name and answers array are required",
    });
  }

  // First, find the shared quiz by token and get the correct answers
  db.get(
    `SELECT sq.id as shared_quiz_id, sq.quiz_id, q.questions 
     FROM shared_quizzes sq 
     JOIN quiz q ON sq.quiz_id = q.id 
     WHERE sq.share_token = ? AND (sq.expires_at IS NULL OR sq.expires_at > datetime('now'))`,
    [token],
    (err, row) => {
      if (err) {
        console.error("Error fetching shared quiz:", err);
        return res.status(500).json({ error: "Failed to fetch quiz" });
      }

      if (!row) {
        return res.status(404).json({ error: "Quiz not found or expired" });
      }

      try {
        // Parse the quiz questions to get correct answers
        const quizData = JSON.parse(row.questions);
        console.log("Raw quizData:", JSON.stringify(quizData, null, 2));

        // The quiz data has a 'questions' array, so we need to access it properly
        const questions = quizData.questions || quizData;
        console.log("Extracted questions:", JSON.stringify(questions, null, 2));

        // Calculate score by comparing student answers with correct answers
        let score = 0;
        const totalQuestions = questions.length;
        const results = [];

        for (let i = 0; i < totalQuestions; i++) {
          const question = questions[i];
          const studentAnswer = answers[i];
          console.log(
            "Student answer:",
            studentAnswer,
            "Correct answer:",
            question.correct_answer
          );
          const isCorrect = studentAnswer === question.correct_answer;

          if (isCorrect) {
            score++;
          }

          results.push({
            questionIndex: i,
            question: question.question,
            studentAnswer: studentAnswer,
            correctAnswer: question.correct_answer,
            isCorrect: isCorrect,
          });
        }

        const finalScore = Math.round((score / totalQuestions) * 100);

        // Store the student response in the database
        db.run(
          `INSERT INTO student_responses (shared_quiz_id, student_name, student_uid, answers, score) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            row.shared_quiz_id,
            student_name,
            student_uid || null,
            JSON.stringify(answers),
            finalScore,
          ],
          function (err) {
            if (err) {
              console.error("Error storing student response:", err);
              return res
                .status(500)
                .json({ error: "Failed to store response" });
            }

            // Return immediate score and correct answers
            res.json({
              success: true,
              score: finalScore,
              correctAnswers: score,
              totalQuestions: totalQuestions,
              percentage: finalScore,
              results: results,
              submissionId: this.lastID,
            });
          }
        );
      } catch (parseError) {
        console.error("Error parsing quiz questions:", parseError);
        return res.status(500).json({ error: "Invalid quiz data format" });
      }
    }
  );
});

// Get quiz results for a specific quiz
app.get("/api/quiz/:id/results", ClerkExpressRequireAuth(), (req, res) => {
  const { id } = req.params;

  // Get all student responses for shared quizzes of this quiz
  db.all(
    `SELECT 
      sr.student_name,
      sr.student_uid,
      sr.score,
      sr.completed_at
     FROM student_responses sr
     JOIN shared_quizzes sq ON sr.shared_quiz_id = sq.id
     WHERE sq.quiz_id = ?
     ORDER BY sr.completed_at DESC`,
    [id],
    (err, rows) => {
      if (err) {
        console.error("Error fetching quiz results:", err);
        return res.status(500).json({ error: "Failed to fetch quiz results" });
      }

      // Format the results according to requirements
      const results = rows.map((row) => ({
        student_name: row.student_name,
        student_uid: row.student_uid || "N/A",
        score: row.score,
        completed_at: row.completed_at,
      }));

      // Return array directly as specified in requirements
      res.json(results);
    }
  );
});

// Get all sessions
app.get("/api/sessions", (req, res) => {
  db.all(
    "SELECT id, created_at FROM notes ORDER BY created_at DESC",
    [],
    (err, rows) => {
      if (err) {
        console.error("Error fetching sessions:", err);
        return res.status(500).json({ error: "Failed to fetch sessions" });
      }
      res.json(rows);
    }
  );
});

// Get session by ID
app.get("/api/sessions/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM notes WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error("Error fetching session:", err);
      return res.status(500).json({ error: "Failed to fetch session" });
    }
    if (!row) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(row);
  });
});

// Delete session
app.delete("/api/sessions/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM notes WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("Error deleting session:", err);
      return res.status(500).json({ error: "Failed to delete session" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({ success: true, message: "Session deleted successfully" });
  });
});

// Health check endpoint});

// Competencies endpoints
app.get("/api/competencies", ClerkExpressRequireAuth(), (req, res) => {
  try {
    const subject = req.query.subject;
    let query = "SELECT * FROM competencies";
    let params = [];

    if (subject) {
      query += " WHERE subject = ? OR subject = 'General'";
      params = [subject];
    }

    query += " ORDER BY subject, name";

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error("Error fetching competencies:", err);
        res.status(500).json({ error: "Failed to fetch competencies" });
        return;
      }
      res.json(rows);
    });
  } catch (error) {
    console.error("Competencies error:", error);
    res.status(500).json({ error: "Failed to fetch competencies" });
  }
});

app.post("/api/competencies", ClerkExpressRequireAuth(), (req, res) => {
  try {
    const { name, description, subject, category } = req.body;

    if (!name || !description || !subject) {
      return res
        .status(400)
        .json({ error: "Name, description, and subject are required" });
    }

    const id = uuidv4();

    db.run(
      `INSERT INTO competencies (id, name, description, subject, category) VALUES (?, ?, ?, ?, ?)`,
      [id, name, description, subject, category || "Custom"],
      function (err) {
        if (err) {
          console.error("Error creating competency:", err);
          res.status(500).json({ error: "Failed to create competency" });
          return;
        }

        res.json({
          id,
          name,
          description,
          subject,
          category: category || "Custom",
        });
      }
    );
  } catch (error) {
    console.error("Create competency error:", error);
    res.status(500).json({ error: "Failed to create competency" });
  }
});

// Analytics endpoints
// Analytics dashboard endpoint (original path)
app.get("/analytics/dashboard", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const timeRange = req.query.timeRange || "30d";

    // Calculate date range
    const now = new Date();
    const daysBack =
      timeRange === "7d"
        ? 7
        : timeRange === "30d"
        ? 30
        : timeRange === "90d"
        ? 90
        : 365;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Get basic metrics
    const [quizCount, notesCount, totalResponses] = await Promise.all([
      new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM quiz WHERE user_id = ? AND created_at >= ?`,
          [userId, startDate.toISOString()],
          (err, row) => (err ? reject(err) : resolve(row.count))
        );
      }),
      new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM notes WHERE user_id = ? AND created_at >= ?`,
          [userId, startDate.toISOString()],
          (err, row) => (err ? reject(err) : resolve(row.count))
        );
      }),
      new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM student_responses sr 
           JOIN shared_quizzes sq ON sr.shared_quiz_id = sq.id 
           JOIN quiz q ON sq.quiz_id = q.id 
           WHERE q.user_id = ? AND sr.completed_at >= ?`,
          [userId, startDate.toISOString()],
          (err, row) => (err ? reject(err) : resolve(row.count))
        );
      }),
    ]);

    // Calculate quiz turnaround time (mock data for now)
    const avgTurnaroundTime = Math.max(5, 30 - quizCount * 2); // Simulated improvement
    const timeSaved = quizCount * 2.5; // Assume 2.5 hours saved per quiz

    // Get engagement metrics
    const engagementData = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          COUNT(*) as total_attempts,
          AVG(score) as avg_score,
          COUNT(CASE WHEN score >= 80 THEN 1 END) as high_scores
         FROM student_responses sr 
         JOIN shared_quizzes sq ON sr.shared_quiz_id = sq.id 
         JOIN quiz q ON sq.quiz_id = q.id 
         WHERE q.user_id = ? AND sr.completed_at >= ?`,
        [userId, startDate.toISOString()],
        (err, rows) => (err ? reject(err) : resolve(rows[0] || {}))
      );
    });

    // Mock curriculum coverage data
    const curriculumCoverage = {
      totalCompetencies: 20,
      coveredCompetencies: Math.min(20, quizCount * 2),
      percentage: Math.min(100, ((quizCount * 2) / 20) * 100),
      bySubject: [
        {
          subject: "Mathematics",
          covered: Math.min(5, Math.floor(quizCount * 0.4)),
          total: 5,
          percentage: Math.min(100, (Math.floor(quizCount * 0.4) / 5) * 100),
        },
        {
          subject: "Science",
          covered: Math.min(5, Math.floor(quizCount * 0.3)),
          total: 5,
          percentage: Math.min(100, (Math.floor(quizCount * 0.3) / 5) * 100),
        },
        {
          subject: "English",
          covered: Math.min(5, Math.floor(quizCount * 0.3)),
          total: 5,
          percentage: Math.min(100, (Math.floor(quizCount * 0.3) / 5) * 100),
        },
        {
          subject: "History",
          covered: Math.min(5, Math.floor(quizCount * 0.2)),
          total: 5,
          percentage: Math.min(100, (Math.floor(quizCount * 0.2) / 5) * 100),
        },
      ],
    };

    // Generate mock performance trend data
    const performanceTrend = [];
    for (let i = 0; i < Math.min(8, daysBack / 7); i++) {
      performanceTrend.push({
        week: `Week ${i + 1}`,
        score: Math.round(65 + Math.random() * 25 + i * 2), // Trending upward
      });
    }

    // Generate mock score distribution
    const scoreDistribution = [
      { range: "0-20%", count: Math.floor(totalResponses * 0.05) },
      { range: "21-40%", count: Math.floor(totalResponses * 0.1) },
      { range: "41-60%", count: Math.floor(totalResponses * 0.2) },
      { range: "61-80%", count: Math.floor(totalResponses * 0.35) },
      { range: "81-100%", count: Math.floor(totalResponses * 0.3) },
    ];

    // Mock mastery tracking
    const masteryTracking = [
      {
        competency: "Reading Comprehension",
        masteryRate: 85,
        attempts: Math.floor(totalResponses * 0.8),
      },
      {
        competency: "Mathematical Problem Solving",
        masteryRate: 72,
        attempts: Math.floor(totalResponses * 0.6),
      },
      {
        competency: "Scientific Method",
        masteryRate: 78,
        attempts: Math.floor(totalResponses * 0.7),
      },
      {
        competency: "Critical Thinking",
        masteryRate: 81,
        attempts: Math.floor(totalResponses * 0.9),
      },
    ];

    // Mock equity data
    const equityData = {
      performanceByGroup: [
        {
          group: "All Students",
          averageScore: engagementData.avg_score || 75,
          completionRate: 85,
          gapFromAverage: 0,
        },
        {
          group: "Male Students",
          averageScore: (engagementData.avg_score || 75) + 2,
          completionRate: 83,
          gapFromAverage: 2,
        },
        {
          group: "Female Students",
          averageScore: (engagementData.avg_score || 75) - 1,
          completionRate: 87,
          gapFromAverage: -1,
        },
        {
          group: "ELL Students",
          averageScore: (engagementData.avg_score || 75) - 8,
          completionRate: 78,
          gapFromAverage: -8,
        },
      ],
      accessibilityMetrics: {
        mobileUsage: 65,
        deviceTypes: [
          { device: "Mobile", usage: 65 },
          { device: "Desktop", usage: 25 },
          { device: "Tablet", usage: 10 },
        ],
      },
    };

    // Mock dropoff points
    const dropoffPoints = [];
    for (let i = 1; i <= 5; i++) {
      dropoffPoints.push({
        questionNumber: i,
        dropoffRate: Math.max(5, 20 - i * 2 + Math.random() * 5),
      });
    }

    const analyticsData = {
      quizTurnaroundTime: {
        average: avgTurnaroundTime,
        trend: -15, // 15% improvement
        timeSaved: timeSaved,
      },
      curriculumCoverage,
      assessmentFrequency: {
        quizzesPerWeek: Math.round(quizCount / (daysBack / 7)),
        lessonsWithQuizzes: Math.min(notesCount, quizCount),
        totalLessons: notesCount,
        alignmentPercentage:
          notesCount > 0
            ? Math.round((Math.min(notesCount, quizCount) / notesCount) * 100)
            : 0,
      },
      engagement: {
        completionRate: totalResponses > 0 ? 85 : 0,
        averageTimeSpent: 12, // minutes
        retakeRate: 15,
        dropoffPoints,
      },
      performance: {
        averageScore: Math.round(engagementData.avg_score || 75),
        scoreDistribution,
        improvementTrend: performanceTrend,
        masteryTracking,
      },
      equity: equityData,
      schoolMetrics: {
        totalTeachers: 1, // Single user for now
        activeTeachers: 1,
        totalStudents: Math.floor(totalResponses / 2), // Estimate unique students
        totalQuizzes: quizCount,
        timeSavedHours: timeSaved,
        consistencyScore: 85,
      },
    };

    res.json(analyticsData);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
});

// Analytics dashboard endpoint (API path for frontend)
app.get(
  "/api/analytics/dashboard",
  ClerkExpressRequireAuth(),
  async (req, res) => {
    try {
      const userId = req.auth.userId;
      const timeRange = req.query.timeRange || "30d";

      // Calculate date range
      const now = new Date();
      const daysBack =
        timeRange === "7d"
          ? 7
          : timeRange === "30d"
          ? 30
          : timeRange === "90d"
          ? 90
          : 365;
      const startDate = new Date(
        now.getTime() - daysBack * 24 * 60 * 60 * 1000
      );

      // Get basic metrics
      const [quizCount, notesCount, totalResponses] = await Promise.all([
        new Promise((resolve, reject) => {
          db.get(
            `SELECT COUNT(*) as count FROM quiz WHERE user_id = ? AND created_at >= ?`,
            [userId, startDate.toISOString()],
            (err, row) => (err ? reject(err) : resolve(row.count))
          );
        }),
        new Promise((resolve, reject) => {
          db.get(
            `SELECT COUNT(*) as count FROM notes WHERE user_id = ? AND created_at >= ?`,
            [userId, startDate.toISOString()],
            (err, row) => (err ? reject(err) : resolve(row.count))
          );
        }),
        new Promise((resolve, reject) => {
          db.get(
            `SELECT COUNT(*) as count FROM student_responses sr 
           JOIN shared_quizzes sq ON sr.shared_quiz_id = sq.id 
           JOIN quiz q ON sq.quiz_id = q.id 
           WHERE q.user_id = ? AND sr.completed_at >= ?`,
            [userId, startDate.toISOString()],
            (err, row) => (err ? reject(err) : resolve(row.count))
          );
        }),
      ]);

      // Calculate quiz turnaround time (mock data for now)
      const avgTurnaroundTime = Math.max(5, 30 - quizCount * 2); // Simulated improvement
      const timeSaved = quizCount * 2.5; // Assume 2.5 hours saved per quiz

      // Get engagement metrics
      const engagementData = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
          COUNT(*) as total_attempts,
          AVG(score) as avg_score,
          COUNT(CASE WHEN score >= 80 THEN 1 END) as high_scores
         FROM student_responses sr 
         JOIN shared_quizzes sq ON sr.shared_quiz_id = sq.id 
         JOIN quiz q ON sq.quiz_id = q.id 
         WHERE q.user_id = ? AND sr.completed_at >= ?`,
          [userId, startDate.toISOString()],
          (err, rows) => (err ? reject(err) : resolve(rows[0] || {}))
        );
      });

      // Mock curriculum coverage data
      const curriculumCoverage = {
        totalCompetencies: 20,
        coveredCompetencies: Math.min(20, quizCount * 2),
        percentage: Math.min(100, ((quizCount * 2) / 20) * 100),
        bySubject: [
          {
            subject: "Mathematics",
            covered: Math.min(5, Math.floor(quizCount * 0.4)),
            total: 5,
            percentage: Math.min(100, (Math.floor(quizCount * 0.4) / 5) * 100),
          },
          {
            subject: "Science",
            covered: Math.min(5, Math.floor(quizCount * 0.3)),
            total: 5,
            percentage: Math.min(100, (Math.floor(quizCount * 0.3) / 5) * 100),
          },
          {
            subject: "English",
            covered: Math.min(5, Math.floor(quizCount * 0.3)),
            total: 5,
            percentage: Math.min(100, (Math.floor(quizCount * 0.3) / 5) * 100),
          },
          {
            subject: "History",
            covered: Math.min(5, Math.floor(quizCount * 0.2)),
            total: 5,
            percentage: Math.min(100, (Math.floor(quizCount * 0.2) / 5) * 100),
          },
        ],
      };

      // Generate mock performance trend data
      const performanceTrend = [];
      for (let i = 0; i < Math.min(8, daysBack / 7); i++) {
        performanceTrend.push({
          week: `Week ${i + 1}`,
          score: Math.round(65 + Math.random() * 25 + i * 2), // Trending upward
        });
      }

      // Generate mock score distribution
      const scoreDistribution = [
        { range: "0-20%", count: Math.floor(totalResponses * 0.05) },
        { range: "21-40%", count: Math.floor(totalResponses * 0.1) },
        { range: "41-60%", count: Math.floor(totalResponses * 0.2) },
        { range: "61-80%", count: Math.floor(totalResponses * 0.35) },
        { range: "81-100%", count: Math.floor(totalResponses * 0.3) },
      ];

      // Mock mastery tracking
      const masteryTracking = [
        {
          competency: "Reading Comprehension",
          masteryRate: 85,
          attempts: Math.floor(totalResponses * 0.8),
        },
        {
          competency: "Mathematical Problem Solving",
          masteryRate: 72,
          attempts: Math.floor(totalResponses * 0.6),
        },
        {
          competency: "Scientific Method",
          masteryRate: 78,
          attempts: Math.floor(totalResponses * 0.7),
        },
        {
          competency: "Critical Thinking",
          masteryRate: 81,
          attempts: Math.floor(totalResponses * 0.9),
        },
      ];

      // Mock equity data
      const equityData = {
        performanceByGroup: [
          {
            group: "All Students",
            averageScore: engagementData.avg_score || 75,
            completionRate: 85,
            gapFromAverage: 0,
          },
          {
            group: "Male Students",
            averageScore: (engagementData.avg_score || 75) + 2,
            completionRate: 83,
            gapFromAverage: 2,
          },
          {
            group: "Female Students",
            averageScore: (engagementData.avg_score || 75) - 1,
            completionRate: 87,
            gapFromAverage: -1,
          },
          {
            group: "ELL Students",
            averageScore: (engagementData.avg_score || 75) - 8,
            completionRate: 78,
            gapFromAverage: -8,
          },
        ],
        accessibilityMetrics: {
          mobileUsage: 65,
          deviceTypes: [
            { device: "Mobile", usage: 65 },
            { device: "Desktop", usage: 25 },
            { device: "Tablet", usage: 10 },
          ],
        },
      };

      // Mock dropoff points
      const dropoffPoints = [];
      for (let i = 1; i <= 5; i++) {
        dropoffPoints.push({
          questionNumber: i,
          dropoffRate: Math.max(5, 20 - i * 2 + Math.random() * 5),
        });
      }

      const analyticsData = {
        quizTurnaroundTime: {
          average: avgTurnaroundTime,
          trend: -15, // 15% improvement
          timeSaved: timeSaved,
        },
        curriculumCoverage,
        assessmentFrequency: {
          quizzesPerWeek: Math.round(quizCount / (daysBack / 7)),
          lessonsWithQuizzes: Math.min(notesCount, quizCount),
          totalLessons: notesCount,
          alignmentPercentage:
            notesCount > 0
              ? Math.round((Math.min(notesCount, quizCount) / notesCount) * 100)
              : 0,
        },
        engagement: {
          completionRate: totalResponses > 0 ? 85 : 0,
          averageTimeSpent: 12, // minutes
          retakeRate: 15,
          dropoffPoints,
        },
        performance: {
          averageScore: Math.round(engagementData.avg_score || 75),
          scoreDistribution,
          improvementTrend: performanceTrend,
          masteryTracking,
        },
        equity: equityData,
        schoolMetrics: {
          totalTeachers: 1, // Single user for now
          activeTeachers: 1,
          totalStudents: Math.floor(totalResponses / 2), // Estimate unique students
          totalQuizzes: quizCount,
          timeSavedHours: timeSaved,
          consistencyScore: 85,
        },
      };

      res.json(analyticsData);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics data" });
    }
  }
);

app.get("/analytics/export", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const timeRange = req.query.timeRange || "30d";
    const format = req.query.format || "json";

    // For now, return a simple JSON export
    // In production, you'd generate PDF/Excel reports here
    const exportData = {
      generatedAt: new Date().toISOString(),
      timeRange,
      userId,
      message:
        "Analytics export functionality - implement PDF/Excel generation here",
    };

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="analytics-${timeRange}.pdf"`
      );
      res.send(Buffer.from(JSON.stringify(exportData, null, 2)));
    } else {
      res.json(exportData);
    }
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export analytics data" });
  }
});

// Quiz editing endpoints
app.put("/api/quiz/:id", ClerkExpressRequireAuth(), (req, res) => {
  const quizId = req.params.id;
  const userId = req.auth.userId;
  const { questions, title, description, timeLimit, showAnswers, shuffleQuestions } = req.body;

  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: "Questions array is required" });
  }

  // Validate question format
  for (const question of questions) {
    if (!question.question || !question.options || !Array.isArray(question.options) || 
        question.options.length < 2 || !question.correct_answer) {
      return res.status(400).json({ 
        error: "Each question must have question text, at least 2 options, and a correct answer" 
      });
    }
  }

  const query = `
    UPDATE quiz 
    SET questions = ?, title = ?, description = ?, time_limit = ?, show_answers = ?, shuffle_questions = ?
    WHERE id = ? AND user_id = ?
  `;

  db.run(
    query,
    [
      JSON.stringify(questions),
      title || null,
      description || null,
      timeLimit || null,
      showAnswers ? 1 : 0,
      shuffleQuestions ? 1 : 0,
      quizId,
      userId
    ],
    function (err) {
      if (err) {
        console.error("Error updating quiz:", err);
        return res.status(500).json({ error: "Failed to update quiz" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Quiz not found or unauthorized" });
      }

      res.json({ 
        message: "Quiz updated successfully",
        quizId: quizId,
        questionsUpdated: questions.length
      });
    }
  );
});

// AI rewrite single question endpoint
app.post("/api/quiz/:id/question/:questionIndex/rewrite", ClerkExpressRequireAuth(), async (req, res) => {
  const quizId = req.params.id;
  const questionIndex = parseInt(req.params.questionIndex);
  const userId = req.auth.userId;
  const { prompt } = req.body;

  if (!prompt || prompt.length > 300) {
    return res.status(400).json({ error: "Prompt is required and must be under 300 characters" });
  }

  try {
    // First, get the current quiz
    const quiz = await new Promise((resolve, reject) => {
      db.get(
        "SELECT questions FROM quiz WHERE id = ? AND user_id = ?",
        [quizId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    let questions;
    try {
      questions = JSON.parse(quiz.questions);
    } catch (parseErr) {
      return res.status(500).json({ error: "Invalid quiz data format" });
    }

    if (questionIndex < 0 || questionIndex >= questions.length) {
      return res.status(400).json({ error: "Invalid question index" });
    }

    const currentQuestion = questions[questionIndex];
    
    // Generate rewritten question using AI
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

    const aiResponse = await geminiService.generateContent(rewritePrompt);
    
    // Parse AI response
    let rewrittenQuestion;
    try {
      let contentToProcess;
      
      // Handle structured response from Gemini service
      if (typeof aiResponse === 'object' && aiResponse.content) {
        contentToProcess = aiResponse.content;
      } else {
        contentToProcess = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
      }
      
      // Extract JSON from content (handle markdown code blocks)
      const jsonMatch = contentToProcess.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                       contentToProcess.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error("No JSON found in AI response");
      }
      
      const jsonContent = jsonMatch[1] || jsonMatch[0];
      rewrittenQuestion = JSON.parse(jsonContent);
    } catch (parseErr) {
      console.error("Error parsing AI response:", parseErr);
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    // Validate rewritten question
    if (!rewrittenQuestion.question || !rewrittenQuestion.options || 
        !Array.isArray(rewrittenQuestion.options) || rewrittenQuestion.options.length < 2 ||
        !rewrittenQuestion.correct_answer) {
      return res.status(500).json({ error: "AI generated invalid question format" });
    }

    // Update the question in the array
    questions[questionIndex] = {
      ...rewrittenQuestion,
      id: currentQuestion.id || `q_${Date.now()}_${questionIndex}`
    };

    // Save updated questions back to database
    await new Promise((resolve, reject) => {
      db.run(
        "UPDATE quiz SET questions = ? WHERE id = ? AND user_id = ?",
        [JSON.stringify(questions), quizId, userId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      message: "Question rewritten successfully",
      question: questions[questionIndex]
    });

  } catch (error) {
    console.error("Error rewriting question:", error);
    res.status(500).json({ error: "Failed to rewrite question" });
  }
});

// AI regenerate entire quiz endpoint
app.post("/api/quiz/:id/regenerate", ClerkExpressRequireAuth(), async (req, res) => {
  const quizId = req.params.id;
  const userId = req.auth.userId;
  const { prompt } = req.body;

  if (!prompt || prompt.length > 300) {
    return res.status(400).json({ error: "Prompt is required and must be under 300 characters" });
  }

  try {
    // Get the original transcript for this quiz
    const transcriptData = await new Promise((resolve, reject) => {
      db.get(
        `SELECT t.content, q.title, q.description, q.quiz_options 
         FROM quiz q 
         JOIN transcripts t ON q.transcript_id = t.id 
         WHERE q.id = ? AND q.user_id = ?`,
        [quizId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!transcriptData) {
      return res.status(404).json({ error: "Quiz or transcript not found" });
    }

    // Parse existing quiz options
    let quizOptions = {};
    try {
      if (transcriptData.quiz_options) {
        quizOptions = JSON.parse(transcriptData.quiz_options);
      }
    } catch (parseErr) {
      console.log("Using default quiz options");
    }

    // Create custom options with the user's prompt
    const customOptions = {
      ...quizOptions,
      customInstructions: prompt,
      numberOfQuestions: quizOptions.numberOfQuestions || 5,
      questionTypes: quizOptions.questionTypes || ["multiple-choice"],
      difficultyLevel: quizOptions.difficultyLevel || "medium"
    };

    // Generate new quiz using existing generateQuiz function
    const newQuestions = await generateQuiz(transcriptData.content, customOptions);

    if (!newQuestions || newQuestions.length === 0) {
      return res.status(500).json({ error: "Failed to generate new quiz questions" });
    }

    // Update the quiz in the database
    await new Promise((resolve, reject) => {
      db.run(
        "UPDATE quiz SET questions = ?, quiz_options = ? WHERE id = ? AND user_id = ?",
        [JSON.stringify(newQuestions), JSON.stringify(customOptions), quizId, userId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      message: "Quiz regenerated successfully",
      questions: newQuestions,
      questionsCount: newQuestions.length
    });

  } catch (error) {
    console.error("Error regenerating quiz:", error);
    res.status(500).json({ error: "Failed to regenerate quiz" });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// Ollama service health check
app.get("/health/gemini", async (req, res) => {
  try {
    const connectionCheck = await geminiService.checkConnection();
    if (connectionCheck.connected) {
      res.json({
        status: "OK",
        service: "Gemini",
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        models: connectionCheck.availableModels || [],
        missingModels: connectionCheck.missingModels || [],
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: "UNAVAILABLE",
        service: "Gemini",
        error: connectionCheck.error,
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      service: "Gemini",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err.message);
    } else {
      console.log("Database connection closed.");
    }
    process.exit(0);
  });
});
