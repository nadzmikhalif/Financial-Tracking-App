// --- DOCUMENTATION ---
// This server handles image uploads, image compression via Sharp,
// real AI receipt processing via Google Gemini, and data persistence via Supabase.

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_project_url') 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

if (!supabase) {
  console.log('[ERROR] Supabase credentials missing or default. Application will not function correctly.');
}

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
const genAI = new GoogleGenerativeAI(apiKey);

// Multer Storage Configuration (Temporary storage before compression)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `TEMP_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage: storage });

/**
 * Communicates with Google Gemini API to analyze receipt image.
 */
async function processReceiptWithAI(imagePath) {
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

// GET API: Retrieve all transactions from Supabase
app.get('/api/transactions', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase connection is not configured.' });
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('id', { ascending: false });
  
  if (error) {
    console.error('[Supabase] Fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch transactions from Supabase.' });
  }

  res.json(data);
});

// DELETE API: Remove a transaction by ID
app.delete('/api/transactions/:id', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase connection is not configured.' });
  }

  const id = parseInt(req.params.id);

  // 1. Get filename to delete from storage
  const { data: record, error: fetchError } = await supabase.from('transactions').select('filename').eq('id', id).single();
  if (fetchError) {
    console.error('[Supabase] Record not found:', fetchError);
    return res.status(404).json({ error: 'Transaction not found in database.' });
  }
  
  // 2. Delete from DB
  const { error: dbError } = await supabase.from('transactions').delete().eq('id', id);
  if (dbError) {
    console.error('[Supabase] Delete error:', dbError);
    return res.status(500).json({ error: 'Failed to delete record from database.' });
  }
  
  // 3. Delete from Storage
  if (record?.filename) {
    await supabase.storage.from('receipts').remove([record.filename]);
  }

  console.log(`[Supabase] Deleted transaction: ${id}`);
  res.sendStatus(204);
});

// POST API: Upload image, COMPRESS IT, and trigger AI processing
app.post('/api/upload', aiRateLimiter, upload.single('image'), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase connection is not configured.' });
  }

  if (!req.file) return res.status(400).send('No image file uploaded.');

  const tempPath = req.file.path;
  const finalFilename = req.file.filename.replace('TEMP_', '');
  const finalPath = path.join('uploads', finalFilename);

  try {
    // 1. Compress Image
    await sharp(tempPath)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toFile(finalPath);

    fs.unlinkSync(tempPath);

    // 2. AI Vision Processing
    const aiData = await processReceiptWithAI(finalPath);
    if (aiData.aiError) {
       fs.unlinkSync(finalPath); // Cleanup compressed file on AI failure
       return res.status(422).json(aiData);
    }

    // 3. Create the record
    const newTransaction = {
      id: Date.now(),
      filename: finalFilename,
      timestamp: new Date().toISOString(),
      status: 'Success',
      ...aiData
    };

    // 4. Upload to Supabase Storage
    const fileBuffer = fs.readFileSync(finalPath);
    const { error: storageError } = await supabase.storage
      .from('receipts')
      .upload(finalFilename, fileBuffer, {
         contentType: 'image/jpeg',
         upsert: true
      });

    if (storageError) {
      fs.unlinkSync(finalPath);
      console.error('[Supabase] Storage Upload Error:', storageError);
      return res.status(500).json({ error: 'Failed to upload image to Supabase Storage.' });
    }

    // 5. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(finalFilename);
    
    newTransaction.image_url = publicUrl;

    // 6. Insert into Database
    const { error: dbError } = await supabase
      .from('transactions')
      .insert([newTransaction]);
    
    if (dbError) {
       // Rollback storage if DB fails
       await supabase.storage.from('receipts').remove([finalFilename]);
       fs.unlinkSync(finalPath);
       console.error('[Supabase] DB Insert Error:', dbError);
       return res.status(500).json({ error: 'Failed to save transaction data to Supabase.' });
    }

    // Cleanup local compressed file after successful upload
    fs.unlinkSync(finalPath);
    res.json(newTransaction);

  } catch (error) {
    console.error('Critical Processing Error:', error);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, () => {
  console.log('Neural Server Online: http://localhost:3000');
});
