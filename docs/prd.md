---

# 📚 Immersive Reading Platform with AI-Generated Soundscapes

**Version 1.0 | [cite_start]November 2025** [cite: 3]

---

## 1. Executive Summary

[cite_start]The Immersive Reading Platform is set to transform traditional digital reading by integrating **AI-generated ambient soundscapes** that dynamically correspond to the narrative content of each page[cite: 5]. [cite_start]By analyzing PDF books and generating contextually appropriate audio environments using the **Replicate API**, the platform creates a multi-sensory experience that enhances immersion, comprehension, and emotional connection to literature[cite: 6].

### Key Innovation
[cite_start]The core innovation is **intelligent soundscape mapping** that adapts to narrative elements like setting, mood, weather, time of day, and character actions, offering readers a "cinema-like experience for written content"[cite: 8]. [cite_start]The MVP uses a **curated library of royalty-free ambient soundscapes** combined with **AI-powered scene analysis** (Gemini Flash via Replicate) to intelligently match appropriate audio to each scene, reducing costs by 95% while preserving the immersive experience[cite: 9].

---

## 2. Product Vision

### Mission Statement
[cite_start]To revolutionize digital reading by creating **immersive, multi-sensory literary experiences** that deepen engagement and emotional connection with books through intelligent, context-aware soundscape generation[cite: 12].

### Target Audience
* [cite_start]**Avid readers** seeking enhanced reading experiences [cite: 14]
* [cite_start]**Students and educators** looking for engaging educational tools [cite: 15]
* [cite_start]**Individuals with reading difficulties** who benefit from multi-sensory engagement [cite: 16]
* [cite_start]**Literature enthusiasts** interested in experimental reading formats [cite: 17]
* [cite_start]**Book clubs** seeking shared immersive experiences [cite: 18]

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | [cite_start]Next.js 14 App Router, React 18, TypeScript [cite: 21] |
| **Backend API** | [cite_start]Next.js API Routes (Vercel serverless functions) [cite: 21] |
| **Database** | [cite_start]Vercel Postgres (Neon) [cite: 21] |
| [cite_start]**PDF Processing** | pdf.js (Mozilla) for text extraction [cite: 21] |
| **AI Analysis** | [cite_start]Gemini Flash 2.5 via Replicate for scene classification [cite: 21] |
| **Audio Library** | [cite_start]Curated library of 25-30 royalty-free ambient soundscapes [cite: 21] |
| **Soundscape Mapping** | [cite_start]Intelligent scene-to-audio matching algorithm [cite: 21] |
| **Audio Playback** | [cite_start]Web Audio API for mixing and crossfading [cite: 21] |
| **UI Components** | [cite_start]Tailwind CSS, Framer Motion, react-pageflip [cite: 21] |
| **File Storage** | [cite_start]Vercel Blob for PDF and audio storage [cite: 21] |
| **Deployment** | [cite_start]Vercel (serverless platform with free tier) [cite: 21] |
| **Authentication** | [cite_start]NextAuth.js with email and OAuth [cite: 21] |

### 3.2 AI Analysis & Soundscape Strategy

**MVP Approach: Curated Library + Intelligent Mapping**

Instead of generating unique audio for each scene (cost-prohibitive at $0.05/clip), the MVP uses:

**Scene Analysis via Replicate:**
* [cite_start]**Gemini Flash 2.5:** Cost-effective AI model for content analysis ($0.10-0.50 per book) [cite: 24]
* [cite_start]**Scene Classification:** Extracts setting, mood, intensity, time of day [cite: 25]
* [cite_start]**Fallback Option:** Rule-based classification if AI budget exceeded [cite: 26]

**Curated Soundscape Library:**
* [cite_start]**25-30 Royalty-Free Tracks:** Pre-selected ambient soundscapes covering common scenes [cite: 27]
* [cite_start]**Sources:** Freesound.org (CC), Artlist, Uppbeat, BBC Sound Effects [cite: 28]
* [cite_start]**Categories:** Forest, city, rain, ocean, tension, peace, mystery, action, etc. [cite: 29]

**Intelligent Mapping Algorithm:**
* [cite_start]**Scene → Audio Matching:** Maps detected scene attributes to best-fit soundscape [cite: 30]
* [cite_start]**Caching:** Reuses mappings for similar scenes across books [cite: 31]
* [cite_start]**Quality Control:** Admin can override automated mappings [cite: 32]

**Future Enhancement (Post-MVP):**
* Add AI-generated soundscapes for premium tiers once validation is complete [cite: 33]

---

## 4. System Architecture

### Core Processing Pipeline (MVP)
1.  **PDF Upload & Extraction:** Admin uploads PDF; [cite_start]`pdf.js` extracts text per page[cite: 39].
2.  [cite_start]**Content Analysis:** **Gemini Flash** (or rule-based classifier) analyzes pages to identify setting, mood, weather, time of day, and intensity[cite: 41].
3.  [cite_start]**Scene Detection:** Algorithm determines scene transitions to group similar pages[cite: 43].
4.  [cite_start]**Soundscape Mapping:** Intelligent mapping algorithm selects best-fit soundscape from curated library (25-30 options)[cite: 45].
5.  [cite_start]**Scene-Audio Association:** System creates mappings between page ranges and soundscape files[cite: 47].
6.  [cite_start]**Storage & Metadata:** Vercel Postgres stores book data and page-to-soundscape mappings; audio files stored in **Vercel Blob**[cite: 49].
7.  [cite_start]**Quality Control:** Admin reviews and can override automated mappings before publishing[cite: 50].
8.  [cite_start]**Reader Interface:** Book UI displays text with synchronized audio playback using **Web Audio API crossfading** between curated soundscapes[cite: 51].

### 4.1 Database Schema

| Table | Key Fields |
| :--- | :--- |
| **`users`** | [cite_start]`id`, `email`, `password_hash`, `subscription_tier` [cite: 53] |
| **`books`** | [cite_start]`id`, `user_id`, `title`, `author`, `pdf_url`, `total_pages` [cite: 53] |
| **`pages`** | [cite_start]`id`, `book_id`, `page_number`, `text_content`, `scene_id` [cite: 53] |
| **`scenes`** | [cite_start]`id`, `book_id`, `start_page`, `end_page`, `descriptors` [cite: 53] |
| **`soundscapes`** | [cite_start]`id`, `scene_id`, `audio_url`, `replicate_prediction_id` [cite: 53] |
| **`reading_progress`** | [cite_start]`id`, `user_id`, `book_id`, `current_page` [cite: 53] |

---

## 5. Development Roadmap

### 5.1 Phase 1: MVP (Months 1-3)
* [cite_start]User authentication and PDF upload [cite: 56]
* [cite_start]Basic reading interface with page navigation [cite: 57]
* [cite_start]Claude API content analysis [cite: 58]
* [cite_start]Replicate API integration for audio generation [cite: 59]
* [cite_start]Audio playback with Web Audio API [cite: 60]

### 5.2 Phase 2: Enhancement (Months 4-6)
* [cite_start]Page-turning animations with Framer Motion [cite: 62]
* [cite_start]Improved scene detection [cite: 63]
* [cite_start]Soundscape caching system [cite: 64]
* [cite_start]User preferences and bookmarks [cite: 65]

### 5.3 Phase 3: Monetization (Months 7-9)
* [cite_start]Subscription tiers with Stripe [cite: 67]
* [cite_start]PWA capabilities for offline reading [cite: 68]
* [cite_start]Public domain book library [cite: 69]

---

## 6. Business Model & Pricing

| Tier | Price | Books | Features |
| :--- | :--- | :--- | :--- |
| **Free** | $0 | 3 books | [cite_start]Basic soundscapes [cite: 71] |
| **Reader** | $9.99/mo | 20 books | [cite_start]Enhanced audio, offline [cite: 71] |
| **Bibliophile** | $19.99/mo | Unlimited | [cite_start]Premium audio, priority [cite: 71] |

### 6.1 Cost Structure (MVP - Curated Soundscape Approach)
[cite_start]The estimated total processing cost per book is **\$0.10–\$0.50**[cite: 77], broken down as:
* [cite_start]**Gemini Flash Analysis:** $\sim\$0.10-0.50$ per book for scene classification [cite: 73]
* [cite_start]**Curated Soundscape Library:** One-time acquisition cost (amortized across all books) [cite: 74]
* [cite_start]**Storage (Vercel Blob):** $\sim\$0.15$/GB per month (free tier covers MVP) [cite: 75]
* [cite_start]**Vercel Hosting:** $\sim\$0$/month on free tier (scales with traffic) [cite: 76]

**MVP Monthly Budget: <$50/month** for 5-10 books and initial user base [cite: 77a]

---

## 7. Implementation Guide

### 7.1 MVP Setup (Curated Soundscape Approach)
1.  [cite_start]**Soundscape Library:** Acquire 25-30 royalty-free ambient tracks from Freesound.org, Artlist, or Uppbeat[cite: 80].
2.  [cite_start]**Replicate API:** Create account at [replicate.com](http://replicate.com) for Gemini Flash analysis (optional)[cite: 81].
3.  [cite_start]Install npm package: `npm install replicate`[cite: 82].
4.  [cite_start]Set environment variable: `REPLICATE_API_TOKEN`[cite: 83].
5.  [cite_start]**Vercel Setup:** Deploy to Vercel, configure Vercel Postgres and Blob storage[cite: 84].
6.  [cite_start]**Mapping Algorithm:** Implement scene classification and soundscape matching logic[cite: 85].

### 7.2 Key Implementation Files
* [cite_start]`/app/api/books/upload` - PDF upload handler [cite: 86]
* [cite_start]`/app/api/analyze` - Gemini Flash scene classification [cite: 87]
* [cite_start]`/lib/soundscape-library.ts` - Curated soundscape definitions and metadata [cite: 88]
* [cite_start]`/lib/scene-mapper.ts` - Scene-to-soundscape matching algorithm [cite: 88a]
* [cite_start]`/app/read/[bookId]` - Reading interface component [cite: 89]
* [cite_start]`/lib/audioPlayer.ts` - Web Audio API wrapper [cite: 90]

---

Now that you have the PRD in Markdown, would you like to review a specific section, like the **Monetization** or **Technical Architecture**?