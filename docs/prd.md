---

# 📚 Immersive Reading Platform with AI-Generated Soundscapes

**Version 1.0 | [cite_start]November 2025** [cite: 3]

---

## 1. Executive Summary

[cite_start]The Immersive Reading Platform is set to transform traditional digital reading by integrating **AI-generated ambient soundscapes** that dynamically correspond to the narrative content of each page[cite: 5]. [cite_start]By analyzing PDF books and generating contextually appropriate audio environments using the **Replicate API**, the platform creates a multi-sensory experience that enhances immersion, comprehension, and emotional connection to literature[cite: 6].

### Key Innovation
[cite_start]The core innovation is **AI-powered soundscape generation** that adapts to narrative elements like setting, mood, weather, time of day, and character actions, offering readers a "cinema-like experience for written content"[cite: 8]. [cite_start]All audio generation is handled through **Replicate's API**, which offers simplified integration and cost-effective scaling with access to models like ElevenLabs[cite: 9].

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
| **Backend API** | [cite_start]Next.js API Routes (serverless functions) [cite: 21] |
| **Database** | [cite_start]PostgreSQL 16 [cite: 21] |
| [cite_start]**PDF Processing** | pdf.js (Mozilla) for text extraction [cite: 21] |
| **AI Analysis** | [cite_start]Anthropic Claude API for content analysis [cite: 21] |
| **Audio Generation** | [cite_start]Replicate API (ElevenLabs Music model and other audio models) [cite: 21] |
| **Audio Playback** | [cite_start]Web Audio API for mixing and crossfading [cite: 21] |
| **UI Components** | [cite_start]Tailwind CSS, Framer Motion, react-pageflip [cite: 21] |
| **File Storage** | [cite_start]Cloudflare R2 for PDF and audio storage [cite: 21] |
| **Deployment** | [cite_start]Fly.io for hosting and PostgreSQL [cite: 21] |
| **Authentication** | [cite_start]NextAuth.js with email and OAuth [cite: 21] |

### 3.2 Replicate API Integration

**Why Replicate for Audio Generation:**
* [cite_start]**Simplified Integration:** Single API for multiple audio models[cite: 24].
* [cite_start]**Pay-Per-Use Pricing:** No monthly minimums, only pay for actual generation[cite: 25].
* [cite_start]**Model Flexibility:** Easy switching between audio models as technology improves[cite: 26].
* [cite_start]**Automatic Scaling:** Handles infrastructure and GPU provisioning[cite: 27].
* [cite_start]**NPM Package:** Official `replicate` npm package for easy Node.js integration[cite: 28].

**Available Audio Models via Replicate:**
* [cite_start]`elevenlabs/music`: ElevenLabs Music Generation (**primary soundscape model**) [cite: 30]
* [cite_start]`meta/musicgen`: Meta's MusicGen for alternative music generation [cite: 31]
* [cite_start]`stability-ai/stable-audio`: Stability AI audio generation [cite: 32]
* [cite_start]`riffusion/riffusion`: Riffusion for ambient soundscapes [cite: 33]

---

## 4. System Architecture

### Core Processing Pipeline
1.  **PDF Upload & Extraction:** User uploads PDF; [cite_start]`pdf.js` extracts text per page[cite: 39].
2.  [cite_start]**Content Analysis:** **Claude API** analyzes pages to identify setting, mood, weather, time of day, and actions[cite: 41].
3.  [cite_start]**Scene Detection:** AI determines scene transitions to minimize redundant generation[cite: 43].
4.  [cite_start]**Prompt Generation:** System generates detailed prompts for Replicate audio models[cite: 45].
5.  **Audio Generation via Replicate:** Calls Replicate API (primarily using the `elevenlabs/music` model) to generate **30-60 second soundscape loops**. [cite_start]Assets are cached for reuse[cite: 47].
6.  [cite_start]**Storage & Metadata:** PostgreSQL stores book data and page-to-soundscape mappings; audio files stored in **Cloudflare R2**[cite: 49].
7.  [cite_start]**Reader Interface:** Book UI displays text with synchronized audio playback using **Web Audio API crossfading**[cite: 51].

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

### 6.1 Cost Structure with Replicate
[cite_start]The estimated total processing cost per book is **\$2–\$5**[cite: 77], broken down as:
* [cite_start]**Replicate Audio Generation:** $\sim\$0.002-0.005$ per 30-second soundscape [cite: 73]
* [cite_start]**Claude API:** $\sim\$0.50-1.50$ per book for content analysis [cite: 74]
* [cite_start]**Storage (R2):** $\sim\$0.015$/GB per month [cite: 75]
* [cite_start]**Fly.io Hosting:** $\sim\$200-500$/month [cite: 76]

---

## 7. Implementation Guide

### 7.1 Replicate API Setup
1.  [cite_start]Create account at [replicate.com](http://replicate.com)[cite: 80].
2.  [cite_start]Get API token from account settings[cite: 81].
3.  [cite_start]Install npm package: `npm install replicate`[cite: 82].
4.  [cite_start]Set environment variable: `REPLICATE_API_TOKEN`[cite: 83].
5.  [cite_start]Use `elevenlabs/music` model for soundscape generation[cite: 84].

### 7.2 Key Implementation Files
* [cite_start]`/app/api/books/upload` - PDF upload handler [cite: 86]
* [cite_start]`/app/api/analyze` - Claude content analysis [cite: 87]
* [cite_start]`/app/api/generate-audio` - Replicate soundscape generation [cite: 88]
* [cite_start]`/app/read/[bookId]` - Reading interface component [cite: 89]
* [cite_start]`/lib/audioPlayer.ts` - Web Audio API wrapper [cite: 90]

---

Now that you have the PRD in Markdown, would you like to review a specific section, like the **Monetization** or **Technical Architecture**?