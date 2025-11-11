Here is the updated Product Requirements Document (PRD v1.2), incorporating your decision to use **Cloudflare R2** for storage and adding a specific post-MVP plan to integrate the **Replicate API with the `elevenlabs/music` model** for dynamic soundscape generation.

---

# 📚 Storia - Immersive Reading Platform PRD

**Version 1.2 | MVP Refinement & Generative Audio Roadmap**

---

## 1. Executive Summary

The Immersive Reading Platform transforms digital reading by integrating **AI-generated ambient soundscapes** that dynamically correspond to the narrative. By analyzing PDF books and generating contextually appropriate audio, the platform creates a multi-sensory experience that enhances immersion and emotional connection.

### Key Innovation & MVP Strategy
The core innovation is **intelligent soundscape mapping**. The MVP will leverage a **curated library of royalty-free ambient soundscapes** combined with **AI-powered scene *classification*** (Gemini Flash via Replicate) to intelligently match appropriate audio to each scene.

This pivot (from generation to classification) reduces per-book costs by over 95%, making the business model viable. The MVP will launch with a **curated, pre-processed library of public domain classics** to guarantee a flawless, high-quality user experience.

---

## 2. Product Vision

### Mission Statement
To revolutionize digital reading by creating **immersive, multi-sensory literary experiences** that deepen engagement and emotional connection with books through intelligent, context-aware soundscape generation.

### Target Audience
* **Avid readers** seeking enhanced reading experiences
* **Students and educators** looking for engaging educational tools (Primary B2B opportunity)
* **Accessibility Focus:** Users with reading/focus difficulties (e.g., ADHD, Dyslexia) who benefit from multi-sensory aids
* **Book clubs** seeking shared immersive experiences
* **Authors & Publishers** (Future target for B2B2C "Verified Edition" services)

---

## 3. Technical Architecture

### 3.1 Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | Phoenix LiveView, HEEx templates, Tailwind CSS |
| **Backend API** | Elixir/Phoenix Framework with LiveView |
| **Database** | PostgreSQL with Ecto ORM |
| **PDF Processing** | pdf.js (Mozilla) for text extraction |
| **AI Analysis** | Gemini Flash 2.5 via Replicate for scene classification |
| **Audio Library** | Curated library of 25-30 royalty-free ambient soundscapes |
| **Soundscape Mapping** | Intelligent scene-to-audio matching algorithm |
| **Audio Playback** | Web Audio API for mixing and crossfading |
| **UI Components** | Tailwind CSS, Alpine.js |
| **File Storage** | **Cloudflare R2** (S3-compatible API, zero egress fees) |
| **Deployment** | Elixir Releases with Docker, deployable to Gigalixir or Fly.io |
| **Authentication** | Phoenix Auth with session management |

### 3.2 AI Analysis & Soundscape Strategy

#### 3.2.1 MVP Approach: Curated Library + Intelligent Mapping
* **Scene Analysis via Replicate:**
    * **Gemini Flash 2.5:** Cost-effective AI model for content analysis ($0.10-0.50 per book)
    * **Scene Classification:** Extracts setting, mood, intensity, time of day
* **Curated Soundscape Library:**
    * **25-30 Royalty-Free Tracks:** Pre-selected ambient soundscapes (e.g., from Freesound.org, Artlist)
* **Intelligent Mapping Algorithm:**
    * Maps detected scene attributes to best-fit soundscape from the library.

#### 3.2.2 Post-MVP Enhancement: Generative Audio Pipeline
This plan introduces a hybrid model to create dynamic audio for premium tiers, solving gaps in the curated library.

* **Model:** `elevenlabs/music` via **Replicate API**.
* **Trigger:** The `Intelligent Mapping Algorithm` fails to find a high-confidence match (e.g., a "match score" < 70%) in the curated library.
* **Flow:**
    1.  Gemini Flash analysis generates descriptors (e.g., `mood: nostalgic`, `setting: 1950s_diner`, `intensity: low`).
    2.  The mapping algorithm fails to find a suitable pre-existing track.
    3.  **New Step:** The system auto-translates these descriptors into a prompt for `elevenlabs/music` (e.g., "Nostalgic 1950s diner ambience, soft jukebox music, distant chatter, instrumental, lofi").
    4.  The generated track is saved to **Cloudflare R2**, and the `soundscapes` table is updated with the new `audio_url` and `source_type: 'generated'`.
* **Cost Control:** This feature will be limited to the `Bibliophile` tier and B2B "Verified Edition" services to manage the per-generation API costs.

---

## 4. System Architecture

### Core Processing Pipeline (MVP)
**Note:** The MVP flow is **Admin-only** to ensure content quality and a seamless new-user experience.

1.  **PDF Upload (Admin):** Admin uploads a public domain PDF book.
2.  **Extraction:** `pdf.js` extracts text page by page.
3.  **Content Analysis:** **Gemini Flash** analyzes pages to identify setting, mood, weather, etc.
4.  **Scene Detection:** Algorithm determines scene transitions to group similar pages.
5.  **Soundscape Mapping:** Intelligent mapping algorithm selects the best-fit soundscape from the curated library. (**Post-MVP:** If no match is found, this step will trigger the generative audio pipeline described in 3.2.2 for premium tiers.)
6.  **Storage & Metadata:** PostgreSQL stores book data and mappings. Audio files and PDFs are stored in **Cloudflare R2**.
7.  **Quality Control (Admin):** Admin reviews and **can override** automated mappings via a LiveView interface.
8.  **Reader Interface:** (End-User Flow) Book UI displays text with synchronized audio playback, using **Web Audio API crossfading** and powered by **Phoenix LiveView**.

### 4.1 Database Schema (Updated)

| Table | Key Fields | Notes |
| :--- | :--- | :--- |
| **`users`** | `id`, `email`, `password_hash`, `subscription_tier` | |
| **`books`** | `id`, `title`, `author`, `pdf_url`, `total_pages`, `source_type`, `is_published` | `source_type` (ENUM: 'public_domain', 'user_upload', 'publisher_verified') |
| **`pages`** | `id`, `book_id`, `page_number`, `text_content`, `scene_id` | |
| **`scenes`** | `id`, `book_id`, `start_page`, `end_page`, `descriptors` | |
| **`soundscapes`** | `id`, `scene_id`, `audio_url`, `source_type`, `replicate_prediction_id` | `source_type` (ENUM: 'curated', 'generated'), `replicate_prediction_id` (nullable) |
| **`reading_progress`** | `id`, `user_id`, `book_id`, `current_page` | |

---

## 5. Development Roadmap (Revised)

### 5.1 Phase 1: MVP Core Experience (Months 1-3)
* **User Authentication:** Secure sign-up and login.
* **Admin Content Pipeline:** Build the internal (Admin-only) tools for PDF upload, processing, and QC.
* **Core Reader UI:** Basic reading interface (Phoenix LiveView) with page navigation and synchronized audio playback (Web Audio API).
* **AI Integration:** Gemini Flash API for classification and the scene-to-soundscape mapping algorithm.
* **Launch Content:** Process and **launch with a curated library of 15-20 public domain classics**.
* **Monetization:** Integrate **Stripe** for subscription tiers.

### 5.2 Phase 2: Enhancement & User Uploads (Months 4-6)
* **UI Polish:** Page-turning animations (Alpine.js), user bookmarks, and preferences.
* **PWA Capabilities:** Enable basic offline reading.
* **User Uploads (Beta):** Launch **user PDF upload** feature (with processing queue) exclusively for the **Bibliophile** tier.

### 5.3 Phase 3: Platform Expansion (Months 7-9)
* **Community Features:** Launch "User-Generated Sound-Maps."
* **Premium Audio:** Begin R&D and licensing for a **premium soundscape library**.
* **B2B Pilot:** Develop sales materials and launch a pilot program for **"Immersive Classics for Schools"** (Education B2B).

### 5.4 Phase 4: Generative Audio & Platform Maturity (Months 10-12+)
* **Generative Audio Integration:** Implement the `elevenlabs/music` (Replicate) pipeline (see 3.2.2) for premium/B2B tiers to fill library gaps.
* **API as a Service (V1):** Begin beta-testing the "Scene-to-Soundscape" API (from Section 9.3) with initial partners.
* **Advanced Community Features:** Voting/rating on User-Generated Sound-Maps.

---

## 6. Business Model & Pricing

### 6.1 Subscription Tiers

| Tier | Price | Books | Features |
| :--- | :--- | :--- | :--- |
| **Free** | $0 | 3 books (from curated library) | Basic soundscapes, ad-supported (future) |
| **Reader** | $9.99/mo | 20 books/mo (from curated library) | Enhanced audio, offline access (PWA) |
| **Bibliophile** | $19.99/mo | Unlimited library access | **User PDF Upload (Beta)**, access to **Premium Soundscape Library** (Phase 3), **AI-Generated Soundscapes** for new uploads (Phase 4) |

### 6.2 Cost Structure (MVP)
The estimated total processing cost per book remains **$0.10–$0.50**.

* **Gemini Flash Analysis:** ~$0.10-0.50 per book
* **Storage (Cloudflare R2):** ~$0.015/GB per month (for storage only)
* **Egress Fees: $0.** This is a critical cost-saving measure. S3 egress fees would be a major variable expense; R2 eliminates this.
* **Hosting (Gigalixir/Fly.io):** ~$7-20/month for basic tier

**MVP Monthly Budget: <$50/month** (This budget is now highly secure and predictable thanks to R2).

---

## 7. Implementation Guide

*(No change; file structure remains logical)*

---

## 8. Elixir/Phoenix Advantages

*(No change; this remains the core technical justification)*

---

## 9. Post-MVP Growth Opportunities

### 9.1 Technology & Feature Enhancements
* **Dynamic Generative Audio:** Implement the `elevenlabs/music` pipeline as described. This moves us from a *static* library to a *dynamic, infinitely expandable* one, ensuring a perfect audio match for any scene and providing a major unique selling proposition (USP).

### 9.2 B2B2C: Publisher & Author Services
* **Product:** "Verified Immersive Editions."
* **Model:** Charge authors/publishers a **one-time flat fee** to create a professionally-QC'd, official soundscape edition of their new book (using our advanced generative audio pipeline for perfect matches).

### 9.3 B2B: Education & Accessibility
* **Product:** "Immersive Classics for Schools."
* **Model:** Sell **annual licenses** to school districts or universities.

### 9.4 API as a Service
* **Product:** The "Scene-to-Soundscape" Mapping Engine.
* **Model:** License our classification and (eventually) our hybrid-generation API to other e-readers, education platforms, or audiobook services.

### 9.5 Community & Platform
* **Product:** User-Generated "Sound-Maps."
* **Model:** Evolve from a *service* to a *platform* (like Spotify for book audio).

---

This v1.2 plan solidifies your MVP by making it more cost-effective (Cloudflare R2) and provides a concrete, exciting, and profitable path forward by re-introducing generative AI as a premium, value-add feature.

Would you like to detail the user stories for the **Phase 4 "Generative Audio Integration"**?