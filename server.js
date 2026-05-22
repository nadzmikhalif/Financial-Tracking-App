// --- DOCUMENTATION ---
// This server handles image uploads, image compression via Sharp,
// real AI receipt processing via Google Gemini, and data persistence via Supabase.

require('dotenv').config();
console.log('--- DEBUG ENV ---');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'EXISTS' : 'MISSING');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'EXISTS' : 'MISSING');
console.log('-----------------');
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

/**
 * Middleware to verify Supabase Auth Token
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = user;
  next();
};

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

    const prompt = "Analyze this image. First, determine if it is a receipt, bill or an invoice. If it is NOT a receipt, bill or invoice, return a JSON object with { \"is_receipt\": false }. If it IS a receipt, bill or invoice, extract the following into a JSON object: amount (number), company (string), date (YYYY-MM-DD), time (HH:mm, 24-hour format), category (Food, Transportation, Computer, or Others), and set \"is_receipt\": true. Return ONLY the JSON.";

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const responseText = response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
    
    throw new Error("Could not parse Gemini response as JSON");

  } catch (error) {
    return {
      amount: "0.00",
      company: "Processing Failed",
      date: new Date().toISOString().split('T')[0],
      category: "Others",
      aiError: error.message || "Unknown API Error"
    };
  }
}

// GET API: Retrieve user-specific transactions from Supabase
app.get('/api/transactions', authenticate, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase connection is not configured.' });
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', req.user.id)
    .order('id', { ascending: false });
  
  if (error) {
    return res.status(500).json({ error: 'Failed to fetch transactions from Supabase.' });
  }

  res.json(data);
});

// --- Profile & Categories APIs ---

// GET API: Get user profile
app.get('/api/profile', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase connection not configured' });
  
  let { data, error } = await supabase.from('profiles').select('*').eq('id', req.user.id).single();
  
  if (error && error.code === 'PGRST116') {
    // Not found, create it
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert([{ id: req.user.id }])
      .select()
      .single();
    if (createError) return res.status(500).json({ error: 'Failed to create profile' });
    data = newProfile;
  } else if (error) {
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }

  res.json(data);
});

// PATCH API: Update user profile (wallpaper)
app.patch('/api/profile', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase connection not configured' });
  
  const { wallpaper_color } = req.body;
  const { data, error } = await supabase
    .from('profiles')
    .update({ wallpaper_color, updated_at: new Date() })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to update profile' });
  res.json(data);
});

// GET API: Get user categories
app.get('/api/categories', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase connection not configured' });
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', req.user.id)
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: 'Failed to fetch categories' });
  res.json(data);
});

// POST API: Add a new category
app.post('/api/categories', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase connection not configured' });
  
  const { name, color, icon } = req.body;

  // Check if the combination already exists
  const { data: existing, error: checkError } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', req.user.id)
    .eq('color', color)
    .eq('icon', icon)
    .maybeSingle();

  if (checkError) return res.status(500).json({ error: 'Database check failed' });
  if (existing) return res.status(400).json({ error: 'This icon and color combination is already in use for another category.' });

  const { data, error } = await supabase
    .from('categories')
    .insert([{ user_id: req.user.id, name, color, icon }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to add category' });
  res.json(data);
});

// PATCH API: Update a category
app.patch('/api/categories/:id', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase connection not configured' });
  
  const { name, color, icon } = req.body;
  const { data, error } = await supabase
    .from('categories')
    .update({ name, color, icon })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to update category' });
  res.json(data);
});

// DELETE API: Remove a category
app.delete('/api/categories/:id', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase connection not configured' });
  
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: 'Failed to delete category' });
  res.sendStatus(204);
});

// DELETE API: Remove a transaction by ID (must belong to user)
app.delete('/api/transactions/:id', authenticate, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase connection is not configured.' });
  }

  const id = parseInt(req.params.id);

  const { data: record, error: fetchError } = await supabase
    .from('transactions')
    .select('filename, user_id')
    .eq('id', id)
    .single();

  if (fetchError || !record) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  if (record.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { error: dbError } = await supabase.from('transactions').delete().eq('id', id);
  if (dbError) {
    return res.status(500).json({ error: 'Failed to delete record.' });
  }
  
  if (record?.filename) {
    await supabase.storage.from('receipts').remove([record.filename]);
  }

  res.sendStatus(204);
});

// POST API: Manual transaction entry (with optional image)
app.post('/api/transactions/manual', authenticate, upload.single('image'), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase connection is not configured.' });
  }

  const { company, amount, date, time, category } = req.body;

  if (!company || !amount || !date || !time || !category) {
    return res.status(400).json({ error: 'All fields are required for manual entry.' });
  }

  let finalFilename = null;
  let publicUrl = null;

  try {
    // 1. If an image was uploaded, process and upload it
    if (req.file) {
      const tempPath = req.file.path;
      finalFilename = `${Date.now()}_manual.jpg`;
      const finalPath = path.join('uploads', finalFilename);

      // Compress Image
      await sharp(tempPath)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toFile(finalPath);

      fs.unlinkSync(tempPath);

      // Upload to Supabase Storage
      const fileBuffer = fs.readFileSync(finalPath);
      const { error: storageError } = await supabase.storage
        .from('receipts')
        .upload(finalFilename, fileBuffer, {
           contentType: 'image/jpeg',
           upsert: true
        });

      if (storageError) {
        if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
        throw storageError;
      }

      // Get Public URL
      const { data: { publicUrl: url } } = supabase.storage
        .from('receipts')
        .getPublicUrl(finalFilename);
      
      publicUrl = url;
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    }

    // 2. Prepare data for Supabase
    const newRecord = {
      user_id: req.user.id,
      company,
      amount: parseFloat(amount) || 0,
      date,
      time,
      category,
      status: 'Success',
      filename: finalFilename,
      image_url: publicUrl
    };

    // 3. Insert into Database
    const { data, error: dbError } = await supabase
      .from('transactions')
      .insert([newRecord])
      .select();

    if (dbError) {
      // Rollback storage if DB fails
      if (finalFilename) {
        await supabase.storage.from('receipts').remove([finalFilename]);
      }
      throw dbError;
    }

    res.json(data[0]);

  } catch (error) {
    console.error('Manual Entry Error:', error);
    res.status(500).json({ error: 'Failed to save transaction', details: error.message });
  }
});

// POST API: Upload image, COMPRESS IT, and trigger AI processing
app.post('/api/upload', authenticate, aiRateLimiter, upload.single('image'), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase connection is not configured.' });
  }

  if (!req.file) return res.status(400).send('No image file uploaded.');

  const tempPath = req.file.path;
  const finalFilename = `${Date.now()}.jpg`;
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

    // Check if it is a receipt
    if (aiData.is_receipt === false) {
       if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
       return res.status(400).json({ 
         error: 'This image does not appear to be a valid receipt.', 
         is_receipt: false 
       });
    }

    if (aiData.aiError) {
       if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
       return res.status(422).json(aiData);
    }

    // 3. Prepare data for Supabase
    // We do NOT include 'id' so Supabase can generate it automatically
    const newRecord = {
      user_id: req.user.id,
      company: aiData.company || "Unknown",
      amount: parseFloat(aiData.amount) || 0,
      date: aiData.date || new Date().toISOString().split('T')[0],
      time: aiData.time || "00:00",
      category: aiData.category || "Others",
      filename: finalFilename,
      status: 'Success'
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
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      return res.status(500).json({ error: 'Storage Upload Error', details: storageError });
    }

    // 5. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(finalFilename);
    
    newRecord.image_url = publicUrl;

    // 6. Insert into Database
    const { data: insertedData, error: dbError } = await supabase
      .from('transactions')
      .insert([newRecord])
      .select();
    
    if (dbError) {
       // Rollback storage if DB fails
       await supabase.storage.from('receipts').remove([finalFilename]);
       if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
       return res.status(500).json({ error: 'Database Insert Error', details: dbError });
    }

    // Cleanup local file
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    
    res.json(insertedData[0]);

  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Neural Server Online on port ${PORT}`);
});
