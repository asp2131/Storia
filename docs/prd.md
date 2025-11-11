---

# 📚 Immersive Reading Platform with AI-Generated Soundscapes

**Version 1.0 | November 2025**

---

## 1. Executive Summary

The Immersive Reading Platform is set to transform traditional digital reading by integrating **AI-generated ambient soundscapes** that dynamically correspond to the narrative content of each page. By analyzing PDF books and generating contextually appropriate audio environments using the **Replicate API**, the platform creates a multi-sensory experience that enhances immersion, comprehension, and emotional connection to literature.

### Key Innovation
The core innovation is **intelligent soundscape mapping** that adapts to narrative elements like setting, mood, weather, time of day, and character actions, offering readers a "cinema-like experience for written content". The MVP uses a **curated library of royalty-free ambient soundscapes** combined with **AI-powered scene analysis** (Gemini Flash via Replicate) to intelligently match appropriate audio to each scene, reducing costs by 95% while preserving the immersive experience.

---

## 2. Product Vision

### Mission Statement
To revolutionize digital reading by creating **immersive, multi-sensory literary experiences** that deepen engagement and emotional connection with books through intelligent, context-aware soundscape generation.

### Target Audience
* **Avid readers** seeking enhanced reading experiences
* **Students and educators** looking for engaging educational tools
* **Individuals with reading difficulties** who benefit from multi-sensory engagement
* **Literature enthusiasts** interested in experimental reading formats
* **Book clubs** seeking shared immersive experiences

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | Phoenix LiveView, HEEx templates, Tailwind CSS |
| **Backend API** | Elixir/Phoenix Framework with LiveView for real-time features |
| **Database** | PostgreSQL with Ecto ORM |
| **PDF Processing** | pdf.js (Mozilla) for text extraction |
| **AI Analysis** | Gemini Flash 2.5 via Replicate for scene classification |
| **Audio Library** | Curated library of 25-30 royalty-free ambient soundscapes |
| **Soundscape Mapping** | Intelligent scene-to-audio matching algorithm |
| **Audio Playback** | Web Audio API for mixing and crossfading |
| **UI Components** | Tailwind CSS, Alpine.js for interactive elements |
| **File Storage** | Local file storage or AWS S3 integration |
| **Deployment** | Elixir Releases with Docker, deployable to Gigalixir or other platforms |
| **Authentication** | Phoenix Auth with session management |

### 3.2 AI Analysis & Soundscape Strategy

**MVP Approach: Curated Library + Intelligent Mapping**

Instead of generating unique audio for each scene (cost-prohibitive at $0.05/clip), the MVP uses:

**Scene Analysis via Replicate:**
* **Gemini Flash 2.5:** Cost-effective AI model for content analysis ($0.10-0.50 per book)
* **Scene Classification:** Extracts setting, mood, intensity, time of day
* **Fallback Option:** Rule-based classification if AI budget exceeded

**Curated Soundscape Library:**
* **25-30 Royalty-Free Tracks:** Pre-selected ambient soundscapes covering common scenes
* **Sources:** Freesound.org (CC), Artlist, Uppbeat, BBC Sound Effects
* **Categories:** Forest, city, rain, ocean, tension, peace, mystery, action, etc.

**Intelligent Mapping Algorithm:**
* **Scene → Audio Matching:** Maps detected scene attributes to best-fit soundscape
* **Caching:** Reuses mappings for similar scenes across books
* **Quality Control:** Admin can override automated mappings

**Future Enhancement (Post-MVP):**
* Add AI-generated soundscapes for premium tiers once validation is complete

---

## 4. System Architecture

### Core Processing Pipeline (MVP)
1.  **PDF Upload & Extraction:** Admin uploads PDF; `pdf.js` extracts text per page.
2.  **Content Analysis:** **Gemini Flash** (or rule-based classifier) analyzes pages to identify setting, mood, weather, time of day, and intensity.
3.  **Scene Detection:** Algorithm determines scene transitions to group similar pages.
4.  **Soundscape Mapping:** Intelligent mapping algorithm selects best-fit soundscape from curated library (25-30 options).
5.  **Scene-Audio Association:** System creates mappings between page ranges and soundscape files.
6.  **Storage & Metadata:** PostgreSQL stores book data and page-to-soundscape mappings; audio files stored in **local storage or S3**.
7.  **Quality Control:** Admin reviews and can override automated mappings before publishing.
8.  **Reader Interface:** Book UI displays text with synchronized audio playback using **Web Audio API crossfading** between curated soundscapes, powered by **Phoenix LiveView** for real-time updates.

### 4.1 Database Schema

| Table | Key Fields |
| :--- | :--- |
| **`users`** | `id`, `email`, `password_hash`, `subscription_tier` |
| **`books`** | `id`, `user_id`, `title`, `author`, `pdf_url`, `total_pages` |
| **`pages`** | `id`, `book_id`, `page_number`, `text_content`, `scene_id` |
| **`scenes`** | `id`, `book_id`, `start_page`, `end_page`, `descriptors` |
| **`soundscapes`** | `id`, `scene_id`, `audio_url`, `replicate_prediction_id` |
| **`reading_progress`** | `id`, `user_id`, `book_id`, `current_page` |

---

## 5. Development Roadmap

### 5.1 Phase 1: MVP (Months 1-3)
* User authentication and PDF upload
* Basic reading interface with page navigation using Phoenix LiveView
* Gemini Flash API content analysis
* Replicate API integration for audio generation
* Audio playback with Web Audio API

### 5.2 Phase 2: Enhancement (Months 4-6)
* Page-turning animations with Alpine.js
* Improved scene detection
* Soundscape caching system
* User preferences and bookmarks

### 5.3 Phase 3: Monetization (Months 7-9)
* Subscription tiers with Stripe
* PWA capabilities for offline reading
* Public domain book library

---

## 6. Business Model & Pricing

| Tier | Price | Books | Features |
| :--- | :--- | :--- | :--- |
| **Free** | $0 | 3 books | Basic soundscapes |
| **Reader** | $9.99/mo | 20 books | Enhanced audio, offline |
| **Bibliophile** | $19.99/mo | Unlimited | Premium audio, priority |

### 6.1 Cost Structure (MVP - Curated Soundscape Approach)
The estimated total processing cost per book is **$0.10–$0.50**, broken down as:
* **Gemini Flash Analysis:** ~$0.10-0.50 per book for scene classification
* **Curated Soundscape Library:** One-time acquisition cost (amortized across all books)
* **Storage (Local/S3):** ~$0.15/GB per month (S3 Standard)
* **Hosting (Gigalixir/Fly.io):** ~$7-20/month for basic tier (scales with traffic)

**MVP Monthly Budget: <$50/month** for 5-10 books and initial user base

---

## 7. Implementation Guide

### 7.1 MVP Setup (Curated Soundscape Approach)
1.  **Soundscape Library:** Acquire 25-30 royalty-free ambient tracks from Freesound.org, Artlist, or Uppbeat.
2.  **Replicate API:** Create account at [replicate.com](http://replicate.com) for Gemini Flash analysis (optional).
3.  Install Elixir HTTP client: Add `{:httpoison, "~> 2.0"}` or `{:req, "~> 0.4"}` to `mix.exs`.
4.  Set environment variable: `REPLICATE_API_TOKEN` in `config/runtime.exs`.
5.  **Phoenix Setup:** Deploy to Gigalixir or Fly.io, configure PostgreSQL database and S3/local storage.
6.  **Mapping Algorithm:** Implement scene classification and soundscape matching logic in Elixir modules.

### 7.2 Key Implementation Files
* `lib/storia/books/upload.ex` - PDF upload handler
* `lib/storia/ai/analyzer.ex` - Gemini Flash scene classification
* `lib/storia/soundscapes/library.ex` - Curated soundscape definitions and metadata
* `lib/storia/soundscapes/mapper.ex` - Scene-to-soundscape matching algorithm
* `lib/storia_web/live/book_live/show.ex` - Reading interface LiveView
* `assets/js/audio_player.js` - Web Audio API wrapper (JavaScript hook)

---

## 8. Elixir/Phoenix Advantages

### Why Elixir/Phoenix for This Project?
* **Real-time capabilities:** LiveView provides seamless real-time updates for audio synchronization without JavaScript complexity
* **Concurrency:** Elixir's BEAM VM handles multiple concurrent users efficiently
* **Fault tolerance:** Supervisor trees ensure the application recovers gracefully from errors
* **Performance:** Low latency and high throughput for audio streaming
* **Developer productivity:** Phoenix generators and conventions speed up development
* **Cost efficiency:** Single server can handle thousands of concurrent connections