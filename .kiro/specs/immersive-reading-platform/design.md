# Design Document

## Overview

The Immersive Reading Platform is a Next.js 14 web application that combines PDF text extraction, AI-powered content analysis, and dynamic soundscape generation to create an immersive reading experience. The system uses a serverless architecture with PostgreSQL for data persistence, Cloudflare R2 for file storage, and integrates with Google Gemini for content analysis and Replicate API for audio generation.

### Alternative Architecture (Plan B)

**Note:** If scalability or real-time performance becomes a concern (especially with frequent scene changes and concurrent book processing), consider pivoting to **Elixir/Phoenix LiveView**:

**Advantages:**
- BEAM VM's superior concurrency model for batch processing multiple books
- Native real-time updates via WebSockets (no additional libraries needed)
- Oban for robust background job processing
- Excellent Fly.io deployment support (same founders)
- ~2KB memory per connection vs ~10-50KB in Node.js
- Built-in supervisor trees for fault tolerance

**Trade-offs:**
- Steeper learning curve if unfamiliar with Elixir
- Smaller frontend ecosystem compared to React
- Would still need JavaScript hooks for Web Audio API
- PDF processing would require NIFs or external service

This Next.js implementation provides a solid MVP foundation with the option to migrate critical components to Elixir/Phoenix if needed.

## Architecture

### High-Level Architecture

```
┌─────────────┐
│   Browser   │
│  (Next.js)  │
└──────┬──────┘
       │
       ├─── PDF Upload
       ├─── Reading Interface
       └─── Audio Playback (Web Audio API)
       │
┌──────▼──────────────────────────────────────┐
│         Next.js App Router                   │
│  ┌────────────────────────────────────────┐ │
│  │  API Routes (Serverless Functions)     │ │
│  │  - /api/books/upload                   │ │
│  │  - /api/generate-soundscapes           │ │
│  │  - /api/auth/[...nextauth]             │ │
│  └────────────────────────────────────────┘ │
└──────┬──────────────────────────────────────┘
       │
       ├─────────────┬─────────────┬──────────────┐
       │             │             │              │
┌──────▼──────┐ ┌───▼────┐ ┌─────▼─────┐ ┌──────▼──────┐
│ PostgreSQL  │ │ Gemeni │ │ Replicate │ │ Cloudflare  │
│  Database   │ │  API   │ │    API    │ │     R2      │
└─────────────┘ └────────┘ └───────────┘ └─────────────┘
```

### Processing Pipeline

```
1. PDF Upload → 2. Text Extraction → 3. Content Analysis → 4. Scene Detection
                                                                    ↓
8. Reader UI ← 7. Audio Storage ← 6. Soundscape Caching ← 5. Audio Generation
```

## Components and Interfaces

### 1. Authentication System

**Technology:** NextAuth.js with email/password and OAuth providers

**Components:**
- `app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `lib/auth.ts` - Authentication utilities and session management
- `middleware.ts` - Route protection middleware

**Key Functions:**
```typescript
// lib/auth.ts
export async function getSession(): Promise<Session | null>
export async function requireAuth(): Promise<User>
export async function hashPassword(password: string): Promise<string>
export async function verifyPassword(password: string, hash: string): Promise<boolean>
```

### 2. PDF Processing Module

**Technology:** pdf.js for text extraction

**Components:**
- `lib/pdfProcessor.ts` - PDF text extraction logic
- `app/api/books/upload/route.ts` - Upload endpoint

**Key Functions:**
```typescript
// lib/pdfProcessor.ts
export async function extractPDFText(buffer: Buffer): Promise<string[]>
export async function extractPDFMetadata(buffer: Buffer): Promise<PDFMetadata>

interface PDFMetadata {
  title?: string;
  author?: string;
  pageCount: number;
}
```

**Process Flow:**
1. Receive PDF file from multipart form data
2. Validate file size (max 50MB) and format
3. Extract text content page by page using pdf.js
4. Store PDF in Cloudflare R2
5. Create database records for book and pages
6. Trigger background soundscape generation

### 3. Content Analysis Module

**Technology:** Google Gemini API (gemini-1.5-flash)

**Components:**
- `lib/analyzeContent.ts` - Content analysis logic
- `lib/sceneDetection.ts` - Scene change detection

**Key Functions:**
```typescript
// lib/analyzeContent.ts
export async function analyzePageContent(
  pageText: string,
  pageNumber: number
): Promise<SceneAnalysis>

export async function detectSceneChange(
  previousAnalysis: SceneAnalysis,
  currentAnalysis: SceneAnalysis
): Promise<boolean>

interface SceneAnalysis {
  setting: string;
  mood: string;
  weather?: string;
  timeOfDay?: string;
  intensity: "low" | "medium" | "high";
  actions: string[];
  audioPrompt: string;
}
```

**Analysis Strategy:**
- Analyze every 2 pages (page spread) using Gemini 1.5 Flash
- Extract narrative elements: setting, mood, weather, time of day, actions
- Generate detailed audio prompt (1-2 sentences)
- Compare with previous page spread to detect scene changes
- Scene changes trigger new soundscape generation
- Leverage Gemini's 1M token context window for batch processing

**Scene Change Detection Logic:**
- Analyze every 2-page spread as a unit
- Setting change → New scene
- Mood change → New scene
- Intensity change ≥ 2 levels → New scene
- Otherwise → Extend current scene
- This ensures soundscapes stay synchronized with react-pageflip page turns

**Cost Optimization:**
- Gemini Flash: ~$0.075 per million input tokens
- Analyzing every 2 pages means ~150 API calls per 300-page book
- Estimated cost: $0.015-0.10 per 300-page book
- 10-15x cheaper than Claude while maintaining quality

### 4. Soundscape Generation Module

**Technology:** Replicate API with ElevenLabs Music model

**Components:**
- `lib/replicate.ts` - Replicate client configuration
- `lib/generateSoundscape.ts` - Soundscape generation logic
- `lib/soundscapeCache.ts` - Caching system

**Key Functions:**
```typescript
// lib/generateSoundscape.ts
export async function generateSoundscape(
  sceneAnalysis: SceneAnalysis,
  sceneId: string
): Promise<SoundscapeResult>

export async function generateSoundscapeWithPolling(
  sceneAnalysis: SceneAnalysis,
  sceneId: string
): Promise<SoundscapeResult>

interface SoundscapeResult {
  audioUrl: string;
  duration: number;
  predictionId: string;
  prompt: string;
}
```

**Generation Strategy:**
- Use `replicate.run()` for simple synchronous generation
- Use `replicate.predictions.create()` + polling for better control
- Generate 30-second WAV files at CD quality
- Store in Cloudflare R2 for permanence
- Cache based on setting + mood + intensity

**Model Configuration:**
```typescript
{
  model: "elevenlabs/music",
  input: {
    prompt: sceneAnalysis.audioPrompt,
    music_length_ms: 30000,
    output_format: "wav_cd_quality",
    force_instrumental: false
  }
}
```

### 5. Storage Module

**Technology:** Cloudflare R2 (S3-compatible)

**Components:**
- `lib/storage.ts` - R2 upload/download utilities

**Key Functions:**
```typescript
// lib/storage.ts
export async function uploadToR2(
  sourceUrl: string,
  sceneId: string
): Promise<string>

export async function uploadPDFToR2(
  pdfBuffer: Buffer,
  bookId: string
): Promise<string>

export async function getSignedUrl(key: string): Promise<string>
```

**Storage Structure:**
```
bucket/
├── books/
│   └── {bookId}.pdf
└── soundscapes/
    └── {sceneId}.wav
```

### 6. Audio Player Component

**Technology:** Web Audio API with React hooks

**Components:**
- `components/AudioPlayer.tsx` - Audio playback component
- `lib/audioPlayer.ts` - Web Audio API wrapper

**Key Features:**
- Looping playback of 30-second soundscapes
- 3-second crossfade between scenes
- Volume control (0-100%)
- Play/pause functionality
- Preloading of next scenes

**Audio Graph:**
```
AudioBufferSourceNode → GainNode → AudioContext.destination
                         (volume)
```

**Crossfade Implementation:**
```typescript
// Simultaneous fade out old + fade in new
oldGain.gain.linearRampToValueAtTime(0, now + 3)
newGain.gain.linearRampToValueAtTime(volume, now + 3)
```

### 7. Reading Interface

**Technology:** Next.js App Router, React, Tailwind CSS

**Components:**
- `app/read/[bookId]/page.tsx` - Main reading page
- `components/BookReader.tsx` - Reader UI component
- `components/PageNavigation.tsx` - Navigation controls
- `components/AudioPlayer.tsx` - Audio controls

**Features:**
- Display current page spread (2 pages) using react-pageflip
- Previous/Next page navigation
- Progress indicator (page X of Y)
- Audio play/pause toggle
- Volume slider
- Bookmark functionality
- Reading progress auto-save
- Automatic soundscape switching on page flip

**State Management:**
```typescript
interface ReaderState {
  bookId: string;
  currentPage: number;
  currentSpread: number; // Which 2-page spread (0-indexed)
  totalPages: number;
  currentScene: Scene | null;
  isAudioPlaying: boolean;
  volume: number;
  preloadedSoundscapes: Map<number, AudioBuffer>; // Spread index -> audio buffer
}
```

**Page Flip Integration:**
```typescript
// When user flips page with react-pageflip
function onPageFlip(newPage: number) {
  const newSpread = Math.floor(newPage / 2);
  const newScene = getSceneForSpread(bookId, newSpread);
  
  if (newScene?.id !== currentScene?.id) {
    // Trigger crossfade to new soundscape
    audioPlayer.crossfadeTo(newScene.soundscape.audioUrl);
  }
  
  // Preload upcoming spreads
  preloadSoundscapes(newPage, book);
}
```

### 8. Background Job Processing

**Technology:** Next.js API routes with async processing

**Components:**
- `app/api/generate-soundscapes/route.ts` - Soundscape generation job
- `lib/jobQueue.ts` - Simple in-memory job queue

**Process Flow:**
1. Book upload triggers job via API call
2. Job processes pages in 2-page increments (page spreads)
3. For each page spread: analyze → detect scene → generate audio (if new scene)
4. Update book status to "ready" when complete
5. Handle failures gracefully with retries

**Page Spread Processing:**
- Process pages 1-2, 3-4, 5-6, etc.
- Each spread gets analyzed as a unit
- Soundscapes align with react-pageflip page turns
- Ensures audio transitions match visual page flips

**Future Enhancement:** Replace with proper job queue (BullMQ, Inngest) for production

## Data Models

### Database Schema (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Books table
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  author VARCHAR(255),
  pdf_url TEXT NOT NULL,
  total_pages INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'processing', -- processing, ready, failed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pages table
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  scene_id UUID REFERENCES scenes(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(book_id, page_number)
);

-- Scenes table
CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  page_spread_index INTEGER NOT NULL, -- Which 2-page spread (0-indexed)
  setting VARCHAR(500),
  mood VARCHAR(255),
  descriptors JSONB, -- Full SceneAnalysis object
  created_at TIMESTAMP DEFAULT NOW()
);

-- Soundscapes table
CREATE TABLE soundscapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  duration INTEGER DEFAULT 30,
  generation_prompt TEXT,
  replicate_prediction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reading progress table
CREATE TABLE reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  current_page INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Indexes
CREATE INDEX idx_books_user_id ON books(user_id);
CREATE INDEX idx_pages_book_id ON pages(book_id);
CREATE INDEX idx_scenes_book_id ON scenes(book_id);
CREATE INDEX idx_scenes_spread ON scenes(book_id, page_spread_index);
CREATE INDEX idx_reading_progress_user_book ON reading_progress(user_id, book_id);
```

### TypeScript Types

```typescript
// types/database.ts
export interface User {
  id: string;
  email: string;
  name?: string;
  subscriptionTier: 'free' | 'reader' | 'bibliophile';
  createdAt: Date;
}

export interface Book {
  id: string;
  userId: string;
  title: string;
  author?: string;
  pdfUrl: string;
  totalPages: number;
  status: 'processing' | 'ready' | 'failed';
  createdAt: Date;
}

export interface Page {
  id: string;
  bookId: string;
  pageNumber: number;
  textContent: string;
  sceneId?: string;
}

export interface Scene {
  id: string;
  bookId: string;
  startPage: number;
  endPage: number;
  pageSpreadIndex: number; // Which 2-page spread (0-indexed)
  setting: string;
  mood: string;
  descriptors: SceneAnalysis;
}

export interface Soundscape {
  id: string;
  sceneId: string;
  audioUrl: string;
  duration: number;
  generationPrompt: string;
  replicatePredictionId?: string;
}

export interface ReadingProgress {
  id: string;
  userId: string;
  bookId: string;
  currentPage: number;
  updatedAt: Date;
}
```

## Error Handling

### Error Categories

1. **User Input Errors** (400)
   - Invalid PDF format
   - File size exceeds limit
   - Missing required fields

2. **Authentication Errors** (401, 403)
   - Invalid credentials
   - Expired session
   - Insufficient subscription tier

3. **External API Errors** (502, 503)
   - Claude API failures
   - Replicate API failures
   - R2 storage failures

4. **Processing Errors** (500)
   - PDF extraction failures
   - Database errors
   - Unexpected exceptions

### Error Handling Strategy

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class ExternalAPIError extends AppError {
  constructor(service: string, originalError: Error) {
    super(502, `${service} API error: ${originalError.message}`);
  }
}
```

### Retry Logic

```typescript
// lib/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Graceful Degradation

- If soundscape generation fails → Continue processing other scenes
- If audio file fails to load → Display text without audio
- If scene detection fails → Use page-by-page generation
- If Claude API fails → Use fallback simple analysis

## Testing Strategy

### Unit Tests

**Tools:** Jest, React Testing Library

**Coverage:**
- PDF text extraction
- Scene analysis logic
- Scene change detection
- Audio prompt generation
- Caching logic
- Authentication utilities

**Example:**
```typescript
// __tests__/sceneDetection.test.ts
describe('detectSceneChange', () => {
  it('should detect setting change', async () => {
    const prev = { setting: 'forest', mood: 'peaceful', intensity: 'low' };
    const curr = { setting: 'city', mood: 'peaceful', intensity: 'low' };
    expect(await detectSceneChange(prev, curr)).toBe(true);
  });
});
```

### Integration Tests

**Tools:** Playwright, Vitest

**Coverage:**
- PDF upload flow
- Content analysis pipeline
- Soundscape generation
- Reading interface
- Audio playback

**Example:**
```typescript
// __tests__/integration/upload.test.ts
describe('PDF Upload', () => {
  it('should process uploaded PDF and generate soundscapes', async () => {
    const response = await uploadPDF('test.pdf');
    expect(response.status).toBe(200);
    
    // Wait for processing
    await waitForBookStatus(response.bookId, 'ready');
    
    const book = await getBook(response.bookId);
    expect(book.totalPages).toBeGreaterThan(0);
    expect(book.scenes.length).toBeGreaterThan(0);
  });
});
```

### End-to-End Tests

**Tools:** Playwright

**Scenarios:**
- Complete user journey: signup → upload → read
- Audio playback and crossfading
- Page navigation
- Progress saving and restoration

### API Testing

**Tools:** Supertest

**Coverage:**
- All API endpoints
- Authentication flows
- Error responses
- Rate limiting

## Performance Optimization

### Caching Strategy

1. **Soundscape Caching**
   - Cache by setting + mood + intensity
   - Reuse similar soundscapes across books
   - Estimated 30-50% cache hit rate

2. **Database Query Optimization**
   - Index on frequently queried fields
   - Eager loading of related data
   - Connection pooling

3. **CDN for Static Assets**
   - Cloudflare R2 with public URLs
   - Browser caching headers
   - Preload next 3 soundscapes

### Background Processing

- Process soundscape generation asynchronously
- Don't block user on upload
- Show processing status in UI
- Send email notification when ready

### Preloading Strategy

```typescript
// Preload next 3 page spreads (6 pages) when user opens book
async function preloadSoundscapes(currentPage: number, book: Book) {
  // Calculate which page spreads to preload
  const currentSpread = Math.floor(currentPage / 2);
  const nextSpreads = [currentSpread + 1, currentSpread + 2, currentSpread + 3];
  
  for (const spreadIndex of nextSpreads) {
    const scene = await getSceneForSpread(book.id, spreadIndex);
    if (scene?.soundscape) {
      const audio = new Audio(scene.soundscape.audioUrl);
      audio.preload = 'auto';
    }
  }
}
```

## Security Considerations

### Authentication
- Bcrypt password hashing (cost factor 12)
- Secure session management with NextAuth
- CSRF protection enabled
- Rate limiting on auth endpoints

### File Upload
- Validate file type and size
- Scan for malicious content
- Isolate user files in R2 with unique keys
- No direct file execution

### API Security
- API keys stored in environment variables
- Never expose keys to client
- Rate limiting on expensive operations
- Input validation and sanitization

### Database
- Parameterized queries (SQL injection prevention)
- Row-level security policies
- Encrypted connections
- Regular backups

## Deployment Architecture

### Fly.io Configuration

```toml
# fly.toml
app = "immersive-reading"
primary_region = "sjc"

[build]
  builder = "heroku/buildpacks:20"

[env]
  NODE_ENV = "production"

[[services]]
  http_checks = []
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[postgres]
  app = "immersive-reading-db"
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Authentication
NEXTAUTH_URL=https://immersive-reading.fly.dev
NEXTAUTH_SECRET=...

# APIs
GOOGLE_GEMINI_API_KEY=...
REPLICATE_API_TOKEN=r8_...

# Storage
CLOUDFLARE_R2_ACCESS_KEY=...
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=immersive-reading-audio
CLOUDFLARE_R2_PUBLIC_DOMAIN=audio.immersive-reading.com
CLOUDFLARE_ACCOUNT_ID=...
```

### Scaling Considerations

- Horizontal scaling via Fly.io auto-scaling
- Database connection pooling (PgBouncer)
- Separate worker processes for soundscape generation
- CDN for audio file delivery
- Redis for session storage (future)

## Monitoring and Observability

### Logging

```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, meta?: object) => {
    console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date() }));
  },
  error: (message: string, error: Error, meta?: object) => {
    console.error(JSON.stringify({ 
      level: 'error', 
      message, 
      error: error.message, 
      stack: error.stack,
      ...meta, 
      timestamp: new Date() 
    }));
  }
};
```

### Metrics to Track

- PDF processing time
- Soundscape generation time
- API response times
- Error rates by endpoint
- Cache hit rates
- User engagement (pages read, time spent)
- Cost per book processed

### Alerting

- API error rate > 5%
- Processing queue depth > 100
- Database connection pool exhaustion
- External API failures
- Storage quota approaching limit

## Future Enhancements

### Phase 2 Features
- Page-turning animations with Framer Motion
- User bookmarks and highlights
- Reading statistics dashboard
- Social features (book clubs, sharing)

### Phase 3 Features
- PWA for offline reading
- Public domain book library
- Custom soundscape preferences
- Multi-language support
- Mobile apps (React Native)

### Technical Improvements
- Proper job queue (BullMQ)
- Redis caching layer
- GraphQL API
- Real-time collaboration
- Advanced audio mixing (multiple layers)
