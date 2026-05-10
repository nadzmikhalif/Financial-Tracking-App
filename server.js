// --- DOCUMENTATION ---
// This server handles image uploads, image compression via Sharp,
// real AI receipt processing via Google Gemini, and data persistence.

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());

// Configure Rate Limiter: Maximum 4 requests per minute
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 4, // Limit each IP to 4 requests per windowMs
  message: { aiError: "Rate limit exceeded: Maximum 4 scans per minute allowed." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize Gemini Client
const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
console.log('-------------------------------------------');
console.log(`[System] Gemini API Key Status: ${apiKey ? 'Loaded' : 'MISSING'}`);
console.log(`[System] Key Length: ${apiKey.length} characters`);
if (apiKey === 'your_gemini_api_key_here' || apiKey === '') {
  console.log('[WARNING] Please set GEMINI_API_KEY in your .env file');
}
console.log('-------------------------------------------');

const genAI = new GoogleGenerativeAI(apiKey);

// Path to the JSON "database"
const DB_FILE = path.join(__dirname, 'database.json');

// Function to read data from the JSON file
const readDB = () => {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
};

// Function to write data to the JSON file
const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// Initialize DB with a sample if empty
if (readDB().length === 0) {
  writeDB([{
    id: 1,
    filename: 'sample.jpg',
    date: new Date().toISOString().split('T')[0],
    amount: '42.00',
    company: 'Neural Cafe',
    category: 'Food',
    status: 'Processed'
  }]);
}

// Multer Storage Configuration (Temporary storage before compression)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Save with a temp prefix, we will rename/overwrite during compression
    cb(null, `TEMP_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage: storage });

/**
 * Communicates with Google Gemini API to analyze receipt image.
 */
async function processReceiptWithAI(imagePath) {
  console.log(`[AI] Analyzing image with Gemini: ${imagePath}`);
  
  try {
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error("GEMINI_API_KEY is not configured in .env file");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    
    const imageData = fs.readFileSync(imagePath);
    const imagePart = {
      inlineData: {
        data: imageData.toString("base64"),
        mimeType: "image/jpeg"
      },
    };

    const prompt = "Analyze this receipt and extract the following into a JSON object: amount (number), company (string), date (YYYY-MM-DD), time (HH:mm, 24-hour format), and category (Food, Transportation, Computer, or Others). Return ONLY the JSON.";

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const responseText = response.text();
    
    console.log(`[AI] Gemini Response: ${responseText}`);
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error("Could not parse Gemini response as JSON");

  } catch (error) {
    console.error('[AI] Gemini API Error:', error);
    return {
      amount: "0.00",
      company: "Processing Failed",
      date: new Date().toISOString().split('T')[0],
      category: "Others",
      aiError: error.message || "Unknown API Error"
    };
  }
}

// GET API: Retrieve all transactions
app.get('/api/transactions', (req, res) => {
  res.json(readDB());
});

// DELETE API: Remove a transaction by ID
app.delete('/api/transactions/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const db = readDB();
  const filteredDB = db.filter(t => t.id !== id);
  
  if (db.length === filteredDB.length) {
    return res.status(404).send('Transaction not found');
  }
  
  writeDB(filteredDB);
  console.log(`[System] Deleted transaction: ${id}`);
  res.sendStatus(204);
});

// POST API: Upload image, COMPRESS IT, and trigger AI processing
app.post('/api/upload', aiRateLimiter, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).send('No image file uploaded.');

  const tempPath = req.file.path;
  const finalFilename = req.file.filename.replace('TEMP_', '');
  const finalPath = path.join('uploads', finalFilename);

  try {
    console.log(`[System] Compressing image: ${tempPath}`);
    
    // 1. Compress Image using Sharp
    // Resize to max 1200px width/height and reduce quality to 70%
    await sharp(tempPath)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toFile(finalPath);

    // 2. Delete the temporary uncompressed file
    fs.unlinkSync(tempPath);

    // 3. Trigger AI Vision Processing on the compressed image
    const aiData = await processReceiptWithAI(finalPath);

    // 4. Create the record
    const newTransaction = {
      id: Date.now(),
      filename: finalFilename,
      timestamp: new Date().toISOString(),
      status: aiData.aiError ? 'Error' : 'Success',
      ...aiData
    };

    // 5. Save to JSON Database ONLY if there is no AI error
    if (!aiData.aiError) {
      const db = readDB();
      db.unshift(newTransaction);
      writeDB(db);
    }

    res.json(newTransaction);

  } catch (error) {
    console.error('Critical Processing Error:', error);
    // Cleanup temp file if it exists
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res.status(500).send('Internal Server Error');
  }
});

app.use('/images', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, () => {
  console.log('Neural Server Online: http://localhost:3000');
});
