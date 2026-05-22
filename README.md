# 🧠 Neural Finance Tracker

A modern, "Neural-Space" styled financial application designed for effortless expense logging.

## ✨ Key Features

*   **AI Receipt Scanning:** Powered by Google Gemini. Snap a photo or upload an image, and the AI automatically identifies the Vendor, Amount, Date, and Category.
*   **Intelligent Image Compression:** Uses **Sharp** on the backend to compress high-res mobile photos down to ~150KB, ensuring fast uploads and efficient storage.
*   **Manual Entry Mode:** A compact, user-friendly form for logging transactions without a receipt, featuring smart defaults for current date/time.
*   **Real-time Activity Log:** View all transactions synced instantly with your personalized category icons and glowing aesthetic.
*   **Secure Authentication:** Full user lifecycle management (Sign up/Login) powered by **Supabase Auth**.
*   **Dynamic Categories:** Manage and track expenses using your own custom-defined categories stored in a **PostgreSQL** database.

## 🚀 Tech Stack

*   **Frontend:** React 18, TypeScript, Vite, Tailwind CSS.
*   **Backend:** Node.js, Express.
*   **Database & Auth:** Supabase (PostgreSQL).
*   **AI Engine:** Google Gemini AI.
*   **Image Processing:** Sharp.
*   **Deployment:** PaaS ready (Render/Vercel).

## 🛠️ Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nadzmikhalif/Financial-Tracking-App.git
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory with the following:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_google_gemini_api_key
   PORT=3000
   ```

4. **Run the Development Server:**
   ```bash
   # Terminal 1: Frontend
   npm run dev

   # Terminal 2: Backend
   node server.js
   ```

## 🌌 Design Philosophy
The app utilizes a **Glassmorphism** design language with a "Neural" space theme. It focuses on high-contrast neon accents, deep dark backgrounds, and smooth animations to provide a premium, futuristic user experience.

---
*Created by [nadzmikhalif](https://github.com/nadzmikhalif)*
