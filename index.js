require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const {
  ClerkExpressRequireAuth,
  clerkClient,
} = require("@clerk/clerk-sdk-node");
const { MongoClient, ObjectId } = require("mongodb");
const GeminiService = require("./services/ollamaService");

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Gemini service conditionally
let geminiService = null;

function getGeminiService() {
  if (!geminiService && process.env.GEMINI_API_KEY) {
    try {
      geminiService = new GeminiService();
      console.log("Gemini service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Gemini service:", error.message);
      return null;
    }
  }
  return geminiService;
}

const rawCorsOrigins = [
  process.env.CORS_ORIGIN,
  process.env.CORS_ORIGIN1,
  process.env.CORS_ORIGINS,
].filter(Boolean);
const allowedOrigins = rawCorsOrigins
  .flatMap((o) => o.split(","))
  .map((o) => o.trim().replace(/^`|`$/g, ""))
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*")) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      try {
        const reqHost = new URL(origin).host;
        if (
          allowedOrigins.some((o) => {
            try {
              return new URL(o).host === reqHost;
            } catch {
              return false;
            }
          })
        ) {
          return callback(null, true);
        }
      } catch {}
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 204,
  })
);
app.options("*", cors());
app.use(express.json());
app.use(express.text());

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });
try {
  fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
} catch {}

// MongoDB connection and initialization
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "transcript_notes";
let mongoClient = null;
let db = null;

async function connectMongo() {
  try {
    mongoClient = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    await mongoClient.connect();
    db = mongoClient.db(MONGO_DB_NAME);
    console.log(`Connected to MongoDB at ${MONGO_URI}, db: ${MONGO_DB_NAME}`);
    await initializeDatabaseMongo();
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    throw err;
  }
}

function getDbOrThrow() {
  if (!db) {
    throw new Error("Database unavailable");
  }
  return db;
}

async function initializeDatabaseMongo() {
  try {
    await db.collection("notes").createIndex({ user_id: 1, created_at: -1 });
    await db.collection("quiz").createIndex({ user_id: 1, created_at: -1 });
    await db
      .collection("transcripts")
      .createIndex({ user_id: 1, created_at: -1 });
    await db
      .collection("shared_quizzes")
      .createIndex({ share_token: 1 }, { unique: true });
    await db
      .collection("student_responses")
      .createIndex({ shared_quiz_id: 1, completed_at: -1 });
    await db.collection("competencies").createIndex({ subject: 1, name: 1 });

    const templatesCount = await db.collection("templates").countDocuments();
    if (templatesCount === 0) {
      insertDefaultTemplatesMongo();
    }

    const competenciesCount = await db
      .collection("competencies")
      .countDocuments();
    if (competenciesCount === 0) {
      insertDefaultCompetenciesMongo();
    }
  } catch (err) {
    console.error("MongoDB initialization error:", err.message);
  }
}

// Function to insert default templates
function insertDefaultTemplatesMongo() {
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

  db.collection("templates")
    .insertMany(
      templates.map((t) => ({
        _id: t.id,
        name: t.name,
        subject: t.subject,
        structure: t.structure,
        created_at: new Date(),
      })),
      { ordered: false }
    )
    .catch(() => {});
}

// Insert default competencies for curriculum mapping
function insertDefaultCompetenciesMongo() {
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

  db.collection("competencies")
    .insertMany(
      defaultCompetencies.map((c) => ({
        _id: uuidv4(),
        name: c.name,
        subject: c.subject,
        standard: c.standard,
        description: c.description,
        category: "Standard",
        created_at: new Date(),
      })),
      { ordered: false }
    )
    .catch(() => {});
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
    if (templateId && db) {
      const template = await db
        .collection("templates")
        .findOne({ _id: templateId });
      if (template) geminiOptions.template = template;
    }

    // Generate notes using Gemini service
    const service = getGeminiService();
    if (!service) {
      throw new Error(
        "Gemini service is not available. Please check GEMINI_API_KEY configuration."
      );
    }

    const result = await service.generateNotes(transcript, geminiOptions);

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
    const service = getGeminiService();
    if (!service) {
      throw new Error(
        "Gemini service is not available. Please check GEMINI_API_KEY configuration."
      );
    }

    const result = await service.generateQuiz(transcript, geminiOptions);
    console.log("🔍 Gemini service result:", JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(
        "🔍 Original questions from Gemini:",
        JSON.stringify(result.content.questions, null, 2)
      );

      // Extract questions array from the quiz result and transform correct index to letter
      const questionsArray = result.content.questions.map((question) => {
        const { correct, ...questionWithoutCorrect } = question;
        const transformedQuestion = {
          ...questionWithoutCorrect,
          correct_answer: ["A", "B", "C", "D"][correct],
        };
        console.log(
          `🔍 Transforming question: correct=${correct} -> correct_answer=${transformedQuestion.correct_answer}`
        );
        return transformedQuestion;
      });

      console.log(
        "🔍 Transformed questions array:",
        JSON.stringify(questionsArray, null, 2)
      );
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

// Analyze endpoint - extract keywords with explanations from provided text
app.post("/analyze", async (req, res) => {
  try {
    let text = "";
    if (req.body && typeof req.body === "object" && req.body.text) {
      text = String(req.body.text);
    } else if (typeof req.body === "string") {
      text = req.body;
    }

    if (!text || text.trim().length < 5) {
      return res.status(400).json({
        error: "Text is required and should be at least 5 characters.",
      });
    }

    const service = getGeminiService();
    if (!service) {
      return res.status(503).json({
        error:
          "AI service is not configured. Please check GEMINI_API_KEY environment variable.",
      });
    }

    const prompt = [
      "You are a helpful assistant. Given the following text, identify the 5-10 most important key terms, acronyms, or phrases that could be hard to understand or would benefit from context.",
      "For each item, provide a concise, clear explanation (1-2 sentences) suitable for a general audience.",
      "Return ONLY valid JSON in the following schema and nothing else:",
      '{"keywords": [{"term": "string", "explanation": "string"}]}.',
      "Text:",
      text,
    ].join("\n");

    const result = await service.generateContent(prompt);
    if (!result.success) {
      return res
        .status(502)
        .json({ error: "Model returned unexpected format", raw: result.error });
    }

    let raw = (result.content || "").trim();
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (e2) {
          return res
            .status(502)
            .json({ error: "Model returned unexpected format", raw });
        }
      } else {
        return res
          .status(502)
          .json({ error: "Model returned unexpected format", raw });
      }
    }

    if (!parsed || !Array.isArray(parsed.keywords)) {
      return res
        .status(502)
        .json({ error: "Model returned unexpected format", raw: raw });
    }

    const keywords = parsed.keywords
      .filter(
        (k) =>
          k && typeof k.term === "string" && typeof k.explanation === "string"
      )
      .map((k) => ({ term: k.term.trim(), explanation: k.explanation.trim() }))
      .slice(0, 12);

    res.json({ keywords });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

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

    const service = getGeminiService();
    if (!service) {
      throw new Error(
        "Gemini service is not available. Please check GEMINI_API_KEY configuration."
      );
    }

    const result = await service.generateContent(prompt);
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

function mapMimeToEncoding(mime) {
  if (!mime) return "WEBM_OPUS";
  if (mime.includes("webm")) return "WEBM_OPUS";
  if (mime.includes("ogg")) return "OGG_OPUS";
  if (mime.includes("wav")) return "LINEAR16";
  return "WEBM_OPUS";
}

async function transcribeAudioFileGCS(localPath, mimeType) {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not configured");
  }

  const { Storage } = require("@google-cloud/storage");
  const { SpeechClient } = require("@google-cloud/speech");

  const storage = new Storage();
  const speech = new SpeechClient();

  const ext =
    path.extname(localPath) ||
    (mimeType.includes("webm")
      ? ".webm"
      : mimeType.includes("ogg")
      ? ".ogg"
      : ".wav");
  const objectName = `recordings/${uuidv4()}${ext}`;

  await storage.bucket(bucketName).upload(localPath, {
    destination: objectName,
    contentType: mimeType || "application/octet-stream",
  });

  const gcsUri = `gs://${bucketName}/${objectName}`;

  const encoding = mapMimeToEncoding(mimeType);
  const request = {
    audio: { uri: gcsUri },
    config: {
      languageCode: process.env.SPEECH_LANGUAGE_CODE || "en-US",
      enableAutomaticPunctuation: true,
      model: process.env.SPEECH_MODEL || "latest_long",
      encoding,
    },
  };

  const [operation] = await speech.longRunningRecognize(request);
  const [response] = await operation.promise();
  const parts = [];
  for (const result of response.results || []) {
    const alt = (result.alternatives || [])[0];
    if (alt && alt.transcript) parts.push(alt.transcript);
  }
  return parts.join("\n");
}

async function transcribeAudioFileGCSV2(localPath, mimeType) {
  const recognizer = process.env.SPEECH_V2_RECOGNIZER;
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!recognizer) {
    throw new Error("SPEECH_V2_RECOGNIZER is not configured");
  }
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not configured");
  }

  const { Storage } = require("@google-cloud/storage");
  const { v2 } = require("@google-cloud/speech");
  const storage = new Storage();
  const speech = new v2.SpeechClient();

  const ext =
    path.extname(localPath) ||
    (mimeType.includes("webm")
      ? ".webm"
      : mimeType.includes("ogg")
      ? ".ogg"
      : ".wav");
  const objectName = `recordings/${uuidv4()}${ext}`;
  await storage.bucket(bucketName).upload(localPath, {
    destination: objectName,
    contentType: mimeType || "application/octet-stream",
  });
  const gcsUri = `gs://${bucketName}/${objectName}`;

  const request = {
    recognizer,
    files: [{ uri: gcsUri }],
    // Optional config overrides per file are supported; basic config resides in the recognizer
  };

  const [operation] = await speech.batchRecognize(request);
  const [response] = await operation.promise();
  const parts = [];
  for (const result of response.results || []) {
    const alt = (result.alternatives || [])[0];
    if (alt && alt.transcript) parts.push(alt.transcript);
  }
  return parts.join("\n");
}

async function transcribeAudioFileLocal(localPath, mimeType) {
  const { SpeechClient } = require("@google-cloud/speech");
  const speech = new SpeechClient();

  const encoding = mapMimeToEncoding(mimeType);
  const audioBytes = fs.readFileSync(localPath).toString("base64");
  const request = {
    audio: { content: audioBytes },
    config: {
      languageCode: process.env.SPEECH_LANGUAGE_CODE || "en-US",
      enableAutomaticPunctuation: true,
      model: process.env.SPEECH_MODEL || "latest_long",
      encoding,
    },
  };

  const [operation] = await speech.longRunningRecognize(request);
  const [response] = await operation.promise();
  const parts = [];
  for (const result of response.results || []) {
    const alt = (result.alternatives || [])[0];
    if (alt && alt.transcript) parts.push(alt.transcript);
  }
  return parts.join("\n");
}

async function transcribeAudioFile(localPath, mimeType) {
  try {
    if (process.env.SPEECH_V2_RECOGNIZER && process.env.GCS_BUCKET_NAME) {
      return await transcribeAudioFileGCSV2(localPath, mimeType);
    }
    if (process.env.GCS_BUCKET_NAME) {
      return await transcribeAudioFileGCS(localPath, mimeType);
    }
    return await transcribeAudioFileLocal(localPath, mimeType);
  } catch (e) {
    if (process.env.SPEECH_V2_RECOGNIZER && process.env.GCS_BUCKET_NAME) {
      try {
        return await transcribeAudioFileGCS(localPath, mimeType);
      } catch (e2) {
        try {
          return await transcribeAudioFileLocal(localPath, mimeType);
        } catch (e3) {
          const err = new Error(
            `Transcription failed. v2 error: ${e?.message}; v1 GCS error: ${e2?.message}; Local error: ${e3?.message}`
          );
          err.details = {
            v2: String(e?.message || e),
            v1: String(e2?.message || e2),
            local: String(e3?.message || e3),
          };
          throw err;
        }
      }
    }
    if (process.env.GCS_BUCKET_NAME) {
      try {
        return await transcribeAudioFileLocal(localPath, mimeType);
      } catch (e2) {
        const err = new Error(
          `Transcription failed. GCS error: ${e?.message}; Local error: ${e2?.message}`
        );
        err.details = {
          gcs: String(e?.message || e),
          local: String(e2?.message || e2),
        };
        throw err;
      }
    }
    throw e;
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
        transcriptText = fs.readFileSync(req.file.path, "utf8");
        fs.unlinkSync(req.file.path);
        templateId = req.body.templateId || null;
        notesOptions = req.body.notesOptions || null;
        quizOptions = req.body.quizOptions || null;
      } else if (req.body) {
        if (typeof req.body === "string") {
          try {
            const bodyData = JSON.parse(req.body);
            transcriptText = bodyData.transcript || req.body;
            templateId = bodyData.templateId || null;
            notesOptions = bodyData.notesOptions || null;
            quizOptions = bodyData.quizOptions || null;
          } catch (e) {
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

      const service = getGeminiService();
      if (!service) {
        return res.status(503).json({
          error:
            "AI service is not configured. Please check GEMINI_API_KEY environment variable.",
          details: "GEMINI_API_KEY environment variable is required",
        });
      }
      const connectionCheck = await service.checkConnection();
      if (!connectionCheck.connected) {
        return res.status(503).json({
          error:
            "AI service is currently unavailable. Please ensure Gemini is properly configured and try again.",
          details: connectionCheck.error,
        });
      }

      let notes, quiz, metadataJson;
      try {
        [notes, quiz, metadataJson] = await Promise.all([
          generateNotes(transcriptText, templateId, notesOptions),
          generateQuiz(transcriptText, quizOptions),
          generateTranscriptMetadata(transcriptText),
        ]);
      } catch (aiError) {
        return res.status(500).json({
          error:
            "Failed to generate content with AI service. Please check if Gemini is properly configured and the required models are available.",
          details: aiError.message,
        });
      }

      let transcriptTitle = "Transcript";
      try {
        const metadata = JSON.parse(metadataJson);
        transcriptTitle = metadata.title || "Transcript";
      } catch (e) {}

      try {
        const database = getDbOrThrow();
        const now = new Date();

        const notesDoc = {
          transcript: transcriptText,
          notes,
          format_type: "html",
          template_id: templateId || null,
          notes_options:
            typeof notesOptions === "string"
              ? notesOptions
              : notesOptions
              ? JSON.stringify(notesOptions)
              : null,
          title: transcriptTitle,
          user_id: userId,
          created_at: now,
        };
        const notesResult = await database
          .collection("notes")
          .insertOne(notesDoc);
        const notesId = notesResult.insertedId;

        const quizDoc = {
          transcript_id: notesId,
          questions: JSON.parse(quiz),
          quiz_options:
            typeof quizOptions === "string"
              ? quizOptions
              : quizOptions
              ? JSON.stringify(quizOptions)
              : null,
          title: transcriptTitle,
          user_id: userId,
          created_at: now,
        };
        const quizResult = await database.collection("quiz").insertOne(quizDoc);
        const quizId = quizResult.insertedId;

        const transcriptDoc = {
          user_id: userId,
          content: transcriptText,
          metadata: (() => {
            try {
              return JSON.parse(metadataJson);
            } catch {
              return {};
            }
          })(),
          notes_id: notesId,
          quiz_id: quizId,
          created_at: now,
        };
        const trResult = await database
          .collection("transcripts")
          .insertOne(transcriptDoc);
        const transcriptId = trResult.insertedId;

        res.json({
          success: true,
          transcriptId,
          notesId,
          quizId,
          message: "Transcript processed successfully",
        });
      } catch (dbErr) {
        console.error("Database error:", dbErr);
        res.status(500).json({ error: "Failed to save generated content" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to process transcript" });
    }
  }
);

// Upload recorded audio, transcribe via Google Cloud Speech, and generate notes/quiz
app.post(
  "/api/upload-audio",
  ClerkExpressRequireAuth(),
  upload.single("audio"),
  async (req, res) => {
    try {
      const userId = req.auth.userId;
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const localPath = req.file.path;
      const mimeType = req.file.mimetype || "audio/webm";

      let transcriptText = "";
      let transcriptionErrorDetails = null;
      try {
        transcriptText = await transcribeAudioFile(localPath, mimeType);
      } catch (tErr) {
        transcriptionErrorDetails =
          tErr?.details || tErr?.message || String(tErr);
      } finally {
        try {
          fs.unlinkSync(localPath);
        } catch {}
      }

      if (!transcriptText || transcriptText.trim() === "") {
        return res.status(422).json({
          error: "Transcription returned empty result",
          details: transcriptionErrorDetails,
        });
      }

      const service = getGeminiService();
      if (!service) {
        return res.status(503).json({
          error:
            "AI service is not configured. Please check GEMINI_API_KEY environment variable.",
        });
      }
      const connectionCheck = await service.checkConnection();
      if (!connectionCheck.connected) {
        return res.status(503).json({
          error:
            "AI service is currently unavailable. Please ensure Gemini is properly configured and try again.",
          details: connectionCheck.error,
        });
      }

      let notes, quiz, metadataJson;
      try {
        [notes, quiz, metadataJson] = await Promise.all([
          generateNotes(transcriptText, null, null),
          generateQuiz(transcriptText, null),
          generateTranscriptMetadata(transcriptText),
        ]);
      } catch (aiError) {
        return res.status(500).json({
          error: "Failed to generate content with AI service.",
          details: aiError.message,
        });
      }

      let transcriptTitle = "Transcript";
      try {
        const metadata = JSON.parse(metadataJson);
        transcriptTitle = metadata.title || "Transcript";
      } catch {}

      try {
        const database = getDbOrThrow();
        const now = new Date();

        const notesDoc = {
          transcript: transcriptText,
          notes,
          format_type: "html",
          template_id: null,
          notes_options: null,
          title: transcriptTitle,
          user_id: userId,
          created_at: now,
        };
        const notesResult = await database
          .collection("notes")
          .insertOne(notesDoc);
        const notesId = notesResult.insertedId;

        const quizDoc = {
          transcript_id: notesId,
          questions: JSON.parse(quiz),
          quiz_options: null,
          title: transcriptTitle,
          user_id: userId,
          created_at: now,
        };
        const quizResult = await database.collection("quiz").insertOne(quizDoc);
        const quizId = quizResult.insertedId;

        const transcriptDoc = {
          user_id: userId,
          content: transcriptText,
          metadata: (() => {
            try {
              return JSON.parse(metadataJson);
            } catch {
              return {};
            }
          })(),
          notes_id: notesId,
          quiz_id: quizId,
          created_at: now,
        };
        const trResult = await database
          .collection("transcripts")
          .insertOne(transcriptDoc);
        const transcriptId = trResult.insertedId;

        res.json({
          success: true,
          transcriptId,
          notesId,
          quizId,
          message: "Recording processed successfully",
        });
      } catch (dbErr) {
        console.error("Database error:", dbErr);
        res.status(500).json({ error: "Failed to save generated content" });
      }
    } catch (error) {
      console.error("Upload-audio error:", error);
      res.status(500).json({
        error: "Failed to process audio recording",
        details: error?.message || String(error),
      });
    }
  }
);

// List transcripts for the authenticated user
app.get("/api/transcripts", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const database = getDbOrThrow();
    const rows = await database
      .collection("transcripts")
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .toArray();

    const result = rows.map((row) => {
      const meta = row.metadata || {};
      const wordCount = row.content
        ? row.content.trim().split(/\s+/).length
        : 0;
      return {
        id: row._id,
        title: meta.title || `Transcript ${row._id}`,
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
  } catch (error) {
    res.status(500).json({
      error: "Failed to list transcripts",
      details: error?.message || String(error),
    });
  }
});

// Get templates
app.get("/api/templates", async (req, res) => {
  try {
    const database = getDbOrThrow();
    const rows = await database
      .collection("templates")
      .find({})
      .sort({ subject: 1, name: 1 })
      .toArray();
    res.json(
      rows.map((r) => ({
        id: r._id,
        name: r.name,
        subject: r.subject,
        structure: r.structure,
        created_at: r.created_at,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Get notes
app.get("/api/notes/:id?", ClerkExpressRequireAuth(), async (req, res) => {
  const { id } = req.params;
  const userId = req.auth.userId;
  try {
    const database = getDbOrThrow();
    if (id) {
      const note = await database
        .collection("notes")
        .findOne({ _id: new ObjectId(id), user_id: userId });
      if (!note) return res.status(404).json({ error: "Notes not found" });
      const tr = await database
        .collection("transcripts")
        .findOne({ notes_id: note._id });
      const title =
        tr && tr.metadata && tr.metadata.title
          ? tr.metadata.title
          : note.title || `Notes #${note._id}`;
      res.json({ ...note, title });
    } else {
      const notes = await database
        .collection("notes")
        .find({ user_id: userId })
        .sort({ created_at: -1 })
        .toArray();
      const results = await Promise.all(
        notes.map(async (n) => {
          const tr = await database
            .collection("transcripts")
            .findOne({ notes_id: n._id });
          const title =
            tr && tr.metadata && tr.metadata.title
              ? tr.metadata.title
              : n.title || `Notes #${n._id}`;
          return { ...n, title };
        })
      );
      res.json(results);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// Get quiz
app.get("/api/quiz/:id?", ClerkExpressRequireAuth(), async (req, res) => {
  const { id } = req.params;
  const userId = req.auth.userId;
  try {
    const database = getDbOrThrow();
    if (id) {
      const q = await database
        .collection("quiz")
        .findOne({ _id: new ObjectId(id), user_id: userId });
      if (!q) return res.status(404).json({ error: "Quiz not found" });
      const tr = await database
        .collection("transcripts")
        .findOne({ quiz_id: q._id });
      const title =
        tr && tr.metadata && tr.metadata.title
          ? tr.metadata.title
          : q.title || `Quiz #${q._id}`;
      const questionsArray = Array.isArray(q.questions)
        ? q.questions
        : q.questions && q.questions.questions
        ? q.questions.questions
        : q.questions && q.questions.quiz && q.questions.quiz.questions
        ? q.questions.quiz.questions
        : [q.questions];
      res.json({ ...q, title, questions: questionsArray });
    } else {
      const rows = await database
        .collection("quiz")
        .find({ user_id: userId })
        .sort({ created_at: -1 })
        .toArray();
      const formatted = await Promise.all(
        rows.map(async (row) => {
          const tr = await database
            .collection("transcripts")
            .findOne({ quiz_id: row._id });
          const title =
            tr && tr.metadata && tr.metadata.title
              ? tr.metadata.title
              : row.title || `Quiz #${row._id}`;
          const questionsArray = Array.isArray(row.questions)
            ? row.questions
            : row.questions && row.questions.questions
            ? row.questions.questions
            : row.questions &&
              row.questions.quiz &&
              row.questions.quiz.questions
            ? row.questions.quiz.questions
            : [row.questions];

          const statsAgg = await database
            .collection("student_responses")
            .aggregate([
              {
                $lookup: {
                  from: "shared_quizzes",
                  localField: "shared_quiz_id",
                  foreignField: "_id",
                  as: "sq",
                },
              },
              { $unwind: "$sq" },
              { $match: { "sq.quiz_id": row._id } },
              {
                $group: {
                  _id: null,
                  total_responses: { $sum: 1 },
                  average_score: { $avg: "$score" },
                  highest_score: { $max: "$score" },
                  lowest_score: { $min: "$score" },
                },
              },
            ])
            .toArray();
          const stats = statsAgg[0] || {};
          return {
            ...row,
            title,
            questions: questionsArray,
            statistics: {
              total_responses: stats.total_responses || 0,
              average_score: stats.average_score
                ? Math.round(stats.average_score * 100) / 100
                : null,
              highest_score: stats.highest_score || null,
              lowest_score: stats.lowest_score || null,
            },
          };
        })
      );
      res.json(formatted);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch quizzes" });
  }
});

// Share quiz endpoint - generates shareable link
app.post("/api/quiz/:id/share", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { id } = req.params;
    const database = getDbOrThrow();
    const quiz = await database
      .collection("quiz")
      .findOne({ _id: new ObjectId(id) });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    const shareToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await database.collection("shared_quizzes").insertOne({
      quiz_id: quiz._id,
      share_token: shareToken,
      created_at: new Date(),
      expires_at: expiresAt,
    });
    const shareableUrl = `/quiz/take/${shareToken}`;
    res.json({
      success: true,
      shareToken,
      shareableUrl,
      expiresAt: expiresAt.toISOString(),
      message: "Shareable quiz link created successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create shareable link" });
  }
});

// Public endpoint to get quiz by share token (no authentication required)
app.get("/api/quiz/shared/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const database = getDbOrThrow();
    const row = await database
      .collection("shared_quizzes")
      .aggregate([
        {
          $match: {
            share_token: token,
            $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
          },
        },
        {
          $lookup: {
            from: "quiz",
            localField: "quiz_id",
            foreignField: "_id",
            as: "quiz",
          },
        },
        { $unwind: "$quiz" },
        {
          $project: {
            share_token: 1,
            expires_at: 1,
            quiz_id: "$quiz._id",
            questions: "$quiz.questions",
            quiz_created_at: "$quiz.created_at",
          },
        },
      ])
      .next();
    if (!row)
      return res.status(404).json({ error: "Quiz not found or expired" });
    const questions = Array.isArray(row.questions)
      ? row.questions
      : row.questions?.questions || [];
    if (!Array.isArray(questions))
      return res.status(500).json({
        error: "Invalid quiz data format - questions must be an array",
      });
    const questionsWithoutAnswers = questions.map((question) => {
      const { correct_answer, ...questionWithoutAnswer } = question;
      return questionWithoutAnswer;
    });
    res.json({
      id: row.quiz_id,
      questions: { questions: questionsWithoutAnswers },
      created_at: row.quiz_created_at,
      share_token: row.share_token,
      expires_at: row.expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch quiz" });
  }
});

// Submit quiz answers
app.post("/api/quiz/shared/:token/submit", async (req, res) => {
  try {
    const { token } = req.params;
    const { student_name, student_uid, answers } = req.body;
    if (!student_name || !answers || !Array.isArray(answers)) {
      return res.status(400).json({
        error:
          "Missing required fields: student_name and answers array are required",
      });
    }
    const database = getDbOrThrow();
    const row = await database
      .collection("shared_quizzes")
      .aggregate([
        {
          $match: {
            share_token: token,
            $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
          },
        },
        {
          $lookup: {
            from: "quiz",
            localField: "quiz_id",
            foreignField: "_id",
            as: "quiz",
          },
        },
        { $unwind: "$quiz" },
        {
          $project: {
            _id: 1,
            quiz_id: "$quiz._id",
            questions: "$quiz.questions",
          },
        },
      ])
      .next();
    if (!row)
      return res.status(404).json({ error: "Quiz not found or expired" });
    const questions = Array.isArray(row.questions)
      ? row.questions
      : row.questions?.questions || [];
    const totalQuestions = questions.length;
    const results = [];
    let score = 0;
    for (let i = 0; i < totalQuestions; i++) {
      const question = questions[i];
      const studentAnswer = answers[i];
      const isCorrect = studentAnswer === question.correct_answer;
      if (isCorrect) score++;
      results.push({
        questionIndex: i,
        question: question.question,
        studentAnswer,
        correctAnswer: question.correct_answer,
        isCorrect,
      });
    }
    const finalScore = Math.round((score / totalQuestions) * 100);
    const insertResult = await database
      .collection("student_responses")
      .insertOne({
        shared_quiz_id: row._id,
        student_name,
        student_uid: student_uid || null,
        answers,
        score: finalScore,
        completed_at: new Date(),
      });
    res.json({
      success: true,
      score: finalScore,
      correctAnswers: score,
      totalQuestions,
      percentage: finalScore,
      results,
      submissionId: insertResult.insertedId,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit quiz" });
  }
});

// Get quiz results for a specific quiz
app.get(
  "/api/quiz/:id/results",
  ClerkExpressRequireAuth(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const database = getDbOrThrow();
      const rows = await database
        .collection("student_responses")
        .aggregate([
          {
            $lookup: {
              from: "shared_quizzes",
              localField: "shared_quiz_id",
              foreignField: "_id",
              as: "sq",
            },
          },
          { $unwind: "$sq" },
          { $match: { "sq.quiz_id": new ObjectId(id) } },
          { $sort: { completed_at: -1 } },
          {
            $project: {
              student_name: 1,
              student_uid: 1,
              score: 1,
              completed_at: 1,
            },
          },
        ])
        .toArray();
      const results = rows.map((row) => ({
        student_name: row.student_name,
        student_uid: row.student_uid || "N/A",
        score: row.score,
        completed_at: row.completed_at,
      }));
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch quiz results" });
    }
  }
);

// Get all sessions
app.get("/api/sessions", async (req, res) => {
  try {
    const database = getDbOrThrow();
    const rows = await database
      .collection("notes")
      .find({}, { projection: { created_at: 1 } })
      .sort({ created_at: -1 })
      .toArray();
    res.json(rows.map((r) => ({ id: r._id, created_at: r.created_at })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// Get session by ID
app.get("/api/sessions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const database = getDbOrThrow();
    const row = await database
      .collection("notes")
      .findOne({ _id: new ObjectId(id) });
    if (!row) return res.status(404).json({ error: "Session not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

// Delete session
app.delete("/api/sessions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const database = getDbOrThrow();
    const result = await database
      .collection("notes")
      .deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Session not found" });
    res.json({ success: true, message: "Session deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete session" });
  }
});

// Health check endpoint});

// Competencies endpoints
app.get("/api/competencies", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const subject = req.query.subject;
    const database = getDbOrThrow();
    const filter = subject
      ? { $or: [{ subject }, { subject: "General" }] }
      : {};
    const rows = await database
      .collection("competencies")
      .find(filter)
      .sort({ subject: 1, name: 1 })
      .toArray();
    res.json(
      rows.map((r) => ({
        id: r._id,
        name: r.name,
        description: r.description,
        subject: r.subject,
        category: r.category,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch competencies" });
  }
});

app.post("/api/competencies", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const { name, description, subject, category } = req.body;
    if (!name || !description || !subject) {
      return res
        .status(400)
        .json({ error: "Name, description, and subject are required" });
    }
    const database = getDbOrThrow();
    const id = uuidv4();
    await database.collection("competencies").insertOne({
      _id: id,
      name,
      description,
      subject,
      category: category || "Custom",
      created_at: new Date(),
    });
    res.json({
      id,
      name,
      description,
      subject,
      category: category || "Custom",
    });
  } catch (error) {
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
    const database = getDbOrThrow();
    const [quizCount, notesCount, totalResponses] = await Promise.all([
      database
        .collection("quiz")
        .countDocuments({ user_id: userId, created_at: { $gte: startDate } }),
      database
        .collection("notes")
        .countDocuments({ user_id: userId, created_at: { $gte: startDate } }),
      (async () => {
        const agg = await database
          .collection("student_responses")
          .aggregate([
            { $match: { completed_at: { $gte: startDate } } },
            {
              $lookup: {
                from: "shared_quizzes",
                localField: "shared_quiz_id",
                foreignField: "_id",
                as: "sq",
              },
            },
            { $unwind: "$sq" },
            {
              $lookup: {
                from: "quiz",
                localField: "sq.quiz_id",
                foreignField: "_id",
                as: "q",
              },
            },
            { $unwind: "$q" },
            { $match: { "q.user_id": userId } },
            { $count: "count" },
          ])
          .toArray();
        return agg[0]?.count || 0;
      })(),
    ]);

    // Calculate quiz turnaround time (mock data for now)
    const avgTurnaroundTime = Math.max(5, 30 - quizCount * 2); // Simulated improvement
    const timeSaved = quizCount * 2.5; // Assume 2.5 hours saved per quiz

    // Get engagement metrics
    const engagementAgg = await database
      .collection("student_responses")
      .aggregate([
        { $match: { completed_at: { $gte: startDate } } },
        {
          $lookup: {
            from: "shared_quizzes",
            localField: "shared_quiz_id",
            foreignField: "_id",
            as: "sq",
          },
        },
        { $unwind: "$sq" },
        {
          $lookup: {
            from: "quiz",
            localField: "sq.quiz_id",
            foreignField: "_id",
            as: "q",
          },
        },
        { $unwind: "$q" },
        { $match: { "q.user_id": userId } },
        {
          $group: {
            _id: null,
            total_attempts: { $sum: 1 },
            avg_score: { $avg: "$score" },
            high_scores: { $sum: { $cond: [{ $gte: ["$score", 80] }, 1, 0] } },
          },
        },
      ])
      .toArray();
    const engagementData = engagementAgg[0] || {};

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
      const database = getDbOrThrow();
      const [quizCount, notesCount, totalResponses] = await Promise.all([
        database
          .collection("quiz")
          .countDocuments({ user_id: userId, created_at: { $gte: startDate } }),
        database
          .collection("notes")
          .countDocuments({ user_id: userId, created_at: { $gte: startDate } }),
        (async () => {
          const agg = await database
            .collection("student_responses")
            .aggregate([
              { $match: { completed_at: { $gte: startDate } } },
              {
                $lookup: {
                  from: "shared_quizzes",
                  localField: "shared_quiz_id",
                  foreignField: "_id",
                  as: "sq",
                },
              },
              { $unwind: "$sq" },
              {
                $lookup: {
                  from: "quiz",
                  localField: "sq.quiz_id",
                  foreignField: "_id",
                  as: "q",
                },
              },
              { $unwind: "$q" },
              { $match: { "q.user_id": userId } },
              { $count: "count" },
            ])
            .toArray();
          return agg[0]?.count || 0;
        })(),
      ]);

      // Calculate quiz turnaround time (mock data for now)
      const avgTurnaroundTime = Math.max(5, 30 - quizCount * 2); // Simulated improvement
      const timeSaved = quizCount * 2.5; // Assume 2.5 hours saved per quiz

      // Get engagement metrics
      const engagementAgg = await database
        .collection("student_responses")
        .aggregate([
          { $match: { completed_at: { $gte: startDate } } },
          {
            $lookup: {
              from: "shared_quizzes",
              localField: "shared_quiz_id",
              foreignField: "_id",
              as: "sq",
            },
          },
          { $unwind: "$sq" },
          {
            $lookup: {
              from: "quiz",
              localField: "sq.quiz_id",
              foreignField: "_id",
              as: "q",
            },
          },
          { $unwind: "$q" },
          { $match: { "q.user_id": userId } },
          {
            $group: {
              _id: null,
              total_attempts: { $sum: 1 },
              avg_score: { $avg: "$score" },
              high_scores: {
                $sum: { $cond: [{ $gte: ["$score", 80] }, 1, 0] },
              },
            },
          },
        ])
        .toArray();
      const engagementData = engagementAgg[0] || {};

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
app.put("/api/quiz/:id", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const quizId = req.params.id;
    const userId = req.auth.userId;
    const {
      questions,
      title,
      description,
      timeLimit,
      showAnswers,
      shuffleQuestions,
    } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Questions array is required" });
    }
    for (const question of questions) {
      if (
        !question.question ||
        !question.options ||
        !Array.isArray(question.options) ||
        question.options.length < 2 ||
        !question.correct_answer
      ) {
        return res.status(400).json({
          error:
            "Each question must have question text, at least 2 options, and a correct answer",
        });
      }
    }
    const database = getDbOrThrow();
    const result = await database.collection("quiz").updateOne(
      { _id: new ObjectId(quizId), user_id: userId },
      {
        $set: {
          questions,
          title: title || null,
          description: description || null,
          time_limit: timeLimit || null,
          show_answers: !!showAnswers,
          shuffle_questions: !!shuffleQuestions,
        },
      }
    );
    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Quiz not found or unauthorized" });
    res.json({
      message: "Quiz updated successfully",
      quizId,
      questionsUpdated: questions.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update quiz" });
  }
});

// AI rewrite single question endpoint
app.post(
  "/api/quiz/:id/question/:questionIndex/rewrite",
  ClerkExpressRequireAuth(),
  async (req, res) => {
    const quizId = req.params.id;
    const questionIndex = parseInt(req.params.questionIndex);
    const userId = req.auth.userId;
    const { prompt } = req.body;

    if (!prompt || prompt.length > 300) {
      return res
        .status(400)
        .json({ error: "Prompt is required and must be under 300 characters" });
    }

    try {
      const database = getDbOrThrow();
      const quiz = await database
        .collection("quiz")
        .findOne(
          { _id: new ObjectId(quizId), user_id: userId },
          { projection: { questions: 1 } }
        );

      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      const questions = Array.isArray(quiz.questions)
        ? quiz.questions
        : quiz.questions?.questions || [];

      if (questionIndex < 0 || questionIndex >= questions.length) {
        return res.status(400).json({ error: "Invalid question index" });
      }

      const currentQuestion = questions[questionIndex];

      // Generate rewritten question using AI
      const rewritePrompt = `
Rewrite this quiz question based on the following instruction: "${prompt}"

Current question:
Question: ${currentQuestion.question}
Options: ${currentQuestion.options.join(", ")}
Correct Answer: ${currentQuestion.correct_answer}
Explanation: ${currentQuestion.explanation || "No explanation provided"}

Please provide a rewritten version that follows the instruction while maintaining the same educational objective. Return the response in this exact JSON format:
{
  "question": "rewritten question text",
  "options": ["option A", "option B", "option C", "option D"],
  "correct_answer": "A",
  "explanation": "explanation for the correct answer"
}
`;

      const service = getGeminiService();
      if (!service) {
        return res.status(503).json({
          error:
            "Gemini service is not available. Please check GEMINI_API_KEY configuration.",
        });
      }

      const aiResponse = await service.generateContent(rewritePrompt);

      // Parse AI response
      let rewrittenQuestion;
      try {
        let contentToProcess;

        // Handle structured response from Gemini service
        if (typeof aiResponse === "object" && aiResponse.content) {
          contentToProcess = aiResponse.content;
        } else {
          contentToProcess =
            typeof aiResponse === "string"
              ? aiResponse
              : JSON.stringify(aiResponse);
        }

        // Extract JSON from content (handle markdown code blocks)
        const jsonMatch =
          contentToProcess.match(/```json\s*(\{[\s\S]*?\})\s*```/) ||
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
      if (
        !rewrittenQuestion.question ||
        !rewrittenQuestion.options ||
        !Array.isArray(rewrittenQuestion.options) ||
        rewrittenQuestion.options.length < 2 ||
        !rewrittenQuestion.correct_answer
      ) {
        return res
          .status(500)
          .json({ error: "AI generated invalid question format" });
      }

      // Update the question in the array
      questions[questionIndex] = {
        ...rewrittenQuestion,
        id: currentQuestion.id || `q_${Date.now()}_${questionIndex}`,
      };

      // Save updated questions back to database
      await database
        .collection("quiz")
        .updateOne(
          { _id: new ObjectId(quizId), user_id: userId },
          { $set: { questions } }
        );

      res.json({
        message: "Question rewritten successfully",
        question: questions[questionIndex],
      });
    } catch (error) {
      console.error("Error rewriting question:", error);
      res.status(500).json({ error: "Failed to rewrite question" });
    }
  }
);

// AI regenerate entire quiz endpoint
app.post(
  "/api/quiz/:id/regenerate",
  ClerkExpressRequireAuth(),
  async (req, res) => {
    const quizId = req.params.id;
    const userId = req.auth.userId;
    const { prompt } = req.body;

    if (!prompt || prompt.length > 300) {
      return res
        .status(400)
        .json({ error: "Prompt is required and must be under 300 characters" });
    }

    try {
      const database = getDbOrThrow();
      const transcriptData = await database
        .collection("quiz")
        .aggregate([
          { $match: { _id: new ObjectId(quizId), user_id: userId } },
          {
            $lookup: {
              from: "transcripts",
              localField: "transcript_id",
              foreignField: "_id",
              as: "t",
            },
          },
          { $unwind: "$t" },
          {
            $project: {
              content: "$t.content",
              title: "$title",
              description: "$description",
              quiz_options: "$quiz_options",
            },
          },
        ])
        .next();

      if (!transcriptData) {
        return res.status(404).json({ error: "Quiz or transcript not found" });
      }

      // Parse existing quiz options
      let quizOptions = {};
      try {
        if (transcriptData.quiz_options) {
          quizOptions =
            typeof transcriptData.quiz_options === "string"
              ? JSON.parse(transcriptData.quiz_options)
              : transcriptData.quiz_options;
        }
      } catch (parseErr) {}

      // Create custom options with the user's prompt
      const customOptions = {
        ...quizOptions,
        customInstructions: prompt,
        numberOfQuestions: quizOptions.numberOfQuestions || 5,
        questionTypes: quizOptions.questionTypes || ["multiple-choice"],
        difficultyLevel: quizOptions.difficultyLevel || "medium",
      };

      // Generate new quiz using existing generateQuiz function
      const newQuestions = await generateQuiz(
        transcriptData.content,
        customOptions
      );

      if (!newQuestions || newQuestions.length === 0) {
        return res
          .status(500)
          .json({ error: "Failed to generate new quiz questions" });
      }

      // Update the quiz in the database
      await database
        .collection("quiz")
        .updateOne(
          { _id: new ObjectId(quizId), user_id: userId },
          { $set: { questions: newQuestions, quiz_options: customOptions } }
        );

      res.json({
        message: "Quiz regenerated successfully",
        questions: newQuestions,
        questionsCount: newQuestions.length,
      });
    } catch (error) {
      console.error("Error regenerating quiz:", error);
      res.status(500).json({ error: "Failed to regenerate quiz" });
    }
  }
);

// List users from Clerk
app.get("/api/students", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const list = await clerkClient.users.getUserList({ limit: 200 });
    const users = Array.isArray(list?.data) ? list.data : [];
    const result = users.map((u) => ({
      id: u.id,
      email:
        (Array.isArray(u.emailAddresses) &&
          u.emailAddresses[0]?.emailAddress) ||
        "",
      name: [u.firstName || "", u.lastName || ""].join(" ").trim(),
      imageUrl: u.imageUrl || null,
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

app.get("/students", ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const list = await clerkClient.users.getUserList({ limit: 200 });
    const users = Array.isArray(list?.data) ? list.data : [];
    const result = users.map((u) => ({
      id: u.id,
      email:
        (Array.isArray(u.emailAddresses) &&
          u.emailAddresses[0]?.emailAddress) ||
        "",
      name: [u.firstName || "", u.lastName || ""].join(" ").trim(),
      imageUrl: u.imageUrl || null,
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});
//DB health check
app.get("/health/db", async (req, res) => {
  try {
    const database = getDbOrThrow();
    await database.command({ ping: 1 });
    res.json({
      status: "OK",
      service: "MongoDB",
      uri: process.env.MONGO_URI || "N/A",
      databaseName: process.env.MONGO_DB_NAME || "N/A",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "UNAVAILABLE",
      service: "MongoDB",
      uri: process.env.MONGO_URI || "N/A",
      databaseName: process.env.MONGO_DB_NAME || "N/A",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
// Ollama service health check
app.get("/health/gemini", async (req, res) => {
  try {
    const service = getGeminiService();
    if (!service) {
      return res.status(503).json({
        status: "UNAVAILABLE",
        service: "Gemini",
        error:
          "Gemini service is not configured. Please check GEMINI_API_KEY environment variable.",
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        timestamp: new Date().toISOString(),
      });
    }

    const connectionCheck = await service.checkConnection();
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
const HOST = "0.0.0.0";
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Mongo URI: ${MONGO_URI}`);
  console.log(`CORS origin: ${process.env.CORS_ORIGIN || "*"}`);
  console.log("Server started successfully");
});

// Connect to MongoDB asynchronously after server starts
connectMongo().catch((err) => {
  console.error("MongoDB connection error during startup:", err?.message || err);
});

// Handle server startup errors
server.on("error", (error) => {
  console.error("Server startup error:", error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  server.close(() => {
    console.log("HTTP server closed.");
    if (mongoClient) {
      mongoClient.close().then(() => {
        console.log("MongoDB connection closed.");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

process.on("SIGTERM", () => {
  console.log("\nReceived SIGTERM, shutting down gracefully...");
  server.close(() => {
    console.log("HTTP server closed.");
    if (mongoClient) {
      mongoClient.close().then(() => {
        console.log("MongoDB connection closed.");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});
// Database health check
app.get("/health/db", async (req, res) => {
  try {
    const database = getDbOrThrow();
    const ping = await database.command({ ping: 1 });
    res.json({ status: "OK", ping, db: MONGO_DB_NAME });
  } catch (error) {
    res.status(503).json({ status: "UNAVAILABLE", error: error.message });
  }
});
