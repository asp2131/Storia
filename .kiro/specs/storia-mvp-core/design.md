# Design Document

## Overview

Storia MVP is a Phoenix LiveView application that delivers immersive reading experiences by synchronizing ambient soundscapes with book content. The system uses a server-side rendering approach with real-time updates, leveraging Elixir's concurrency model for efficient PDF processing and AI analysis. The architecture prioritizes admin-controlled quality over user-generated content in the MVP phase.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  LiveView UI   │  │  Web Audio   │  │  Alpine.js      │ │
│  │  (HEEx)        │  │  API         │  │  Interactions   │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │ WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Phoenix Application                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              LiveView Controllers                       │ │
│  │  • ReaderLive  • AdminLive  • LibraryLive             │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Context Layer                          │ │
│  │  • Books  • Accounts  • Content  • Soundscapes         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Background Jobs (Oban)                     │ │
│  │  • PDFProcessor  • SceneAnalyzer  • SoundscapeMapper   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│  PostgreSQL  │  │  Cloudflare R2   │  │  Replicate   │
│   Database   │  │  (PDF + Audio)   │  │  API (AI)    │
└──────────────┘  └──────────────────┘  └──────────────┘
```

### Technology Decisions

**Phoenix LiveView**: Chosen for real-time UI updates without complex frontend state management. Enables seamless progress tracking, live processing status, and synchronized reading experiences.

**Oban**: Background job processing for long-running PDF analysis and AI operations. Provides retry logic, job monitoring, and prevents request timeouts.

**Cloudflare R2**: S3-compatible storage with zero egress fees. Critical for cost control as audio files are streamed frequently during reading sessions.

**Replicate API**: Managed AI inference platform. Eliminates infrastructure complexity and provides predictable per-request pricing for Gemini Flash 2.5.

## Components and Interfaces

### 1. Authentication System

**Module**: `Storia.Accounts`

**Responsibilities**:
- User registration with email/password
- Session management with Phoenix.Token
- Password hashing with Bcrypt
- Password reset flow with time-limited tokens

**Key Functions**:
```elixir
register_user(attrs) :: {:ok, User.t()} | {:error, Ecto.Changeset.t()}
authenticate_user(email, password) :: {:ok, User.t()} | {:error, :invalid_credentials}
generate_reset_token(user) :: String.t()
reset_password(token, new_password) :: {:ok, User.t()} | {:error, atom()}
```

**Database Schema**:
```elixir
schema "users" do
  field :email, :string
  field :password_hash, :string
  field :subscription_tier, Ecto.Enum, values: [:free, :reader, :bibliophile]
  field :stripe_customer_id, :string
  field :subscription_status, :string
  timestamps()
end
```

### 2. PDF Processing Pipeline

**Module**: `Storia.Content.PDFProcessor`

**Responsibilities**:
- Extract text from PDF files using pdf.js via Node.js child process
- Store extracted pages in database
- Trigger scene analysis jobs
- Handle processing errors and retries

**Processing Flow**:
1. Admin uploads PDF via LiveView form
2. File saved to Cloudflare R2 with unique key
3. Oban job `PDFProcessor.ExtractJob` enqueued
4. Node.js script executes pdf.js extraction
5. Pages inserted in batches of 50 for performance
6. `SceneAnalyzer.AnalyzeJob` enqueued on completion

**Key Functions**:
```elixir
upload_pdf(admin_id, file_upload) :: {:ok, Book.t()} | {:error, String.t()}
extract_text(book_id) :: {:ok, [Page.t()]} | {:error, String.t()}
store_pages(book_id, pages) :: {:ok, integer()} | {:error, Ecto.Changeset.t()}
```

**Database Schema**:
```elixir
schema "books" do
  field :title, :string
  field :author, :string
  field :pdf_url, :string
  field :total_pages, :integer
  field :source_type, Ecto.Enum, values: [:public_domain, :user_upload, :publisher_verified]
  field :is_published, :boolean, default: false
  field :processing_status, :string
  field :processing_cost, :decimal
  has_many :pages, Storia.Content.Page
  has_many :scenes, Storia.Content.Scene
  timestamps()
end

schema "pages" do
  belongs_to :book, Storia.Content.Book
  belongs_to :scene, Storia.Content.Scene
  field :page_number, :integer
  field :text_content, :text
  timestamps()
end
```

### 3. Scene Classification Engine

**Module**: `Storia.AI.SceneClassifier`

**Responsibilities**:
- Analyze page content using Gemini Flash 2.5 via Replicate
- Extract scene attributes (setting, mood, weather, time, intensity)
- Detect scene transitions
- Group pages into coherent scenes

**AI Prompt Strategy**:
```
Analyze this book page and extract:
- Setting (e.g., forest, city, indoor, ocean)
- Mood (e.g., tense, peaceful, mysterious, joyful)
- Weather (e.g., rainy, sunny, stormy, foggy)
- Time of day (e.g., morning, night, dusk)
- Intensity (scale 1-10)

Return JSON format with confidence scores.
```

**Scene Detection Algorithm**:
- Compare consecutive pages using cosine similarity on attribute vectors
- Threshold: similarity < 0.7 indicates scene change
- Minimum scene length: 3 pages
- Maximum scene length: 50 pages

**Key Functions**:
```elixir
analyze_pages(book_id) :: {:ok, [Scene.t()]} | {:error, String.t()}
classify_page(page_text) :: {:ok, map()} | {:error, String.t()}
detect_scene_boundaries(pages) :: [integer()]
create_scenes(book_id, boundaries, descriptors) :: {:ok, [Scene.t()]}
```

**Database Schema**:
```elixir
schema "scenes" do
  belongs_to :book, Storia.Content.Book
  field :start_page, :integer
  field :end_page, :integer
  field :descriptors, :map  # JSON: {setting, mood, weather, time, intensity, confidence}
  has_one :soundscape, Storia.Soundscapes.Soundscape
  timestamps()
end
```

### 4. Soundscape Mapping Algorithm

**Module**: `Storia.Soundscapes.Mapper`

**Responsibilities**:
- Match scene descriptors to curated audio library
- Calculate confidence scores for mappings
- Handle low-confidence scenarios
- Store mapping decisions

**Matching Algorithm**:
```
1. Extract scene descriptor vector: [setting, mood, weather, time, intensity]
2. For each soundscape in library:
   - Calculate weighted similarity score
   - Weights: mood (40%), setting (30%), intensity (15%), weather (10%), time (5%)
3. Select soundscape with highest score
4. If score < 0.7, flag for admin review
5. Store mapping with confidence score
```

**Scoring Function**:
- Categorical matches (setting, mood): 1.0 for exact match, 0.5 for related, 0.0 for mismatch
- Numerical matches (intensity): 1.0 - (|scene_intensity - soundscape_intensity| / 10)
- Weather/time: bonus multipliers if present

**Key Functions**:
```elixir
map_scenes_to_soundscapes(book_id) :: {:ok, [Soundscape.t()]} | {:error, String.t()}
calculate_match_score(scene_descriptors, soundscape_tags) :: float()
find_best_match(scene_id) :: {:ok, Soundscape.t(), float()}
flag_for_review(scene_id, reason) :: :ok
```

**Database Schema**:
```elixir
schema "soundscapes" do
  belongs_to :scene, Storia.Content.Scene
  field :audio_url, :string
  field :source_type, Ecto.Enum, values: [:curated, :generated]
  field :confidence_score, :float
  field :admin_approved, :boolean, default: false
  field :tags, :map  # JSON: {mood, setting, intensity, weather, time}
  timestamps()
end
```

### 5. Admin Quality Control Interface

**Module**: `StoriaWeb.AdminLive`

**Responsibilities**:
- Display processed books with mapping status
- Allow soundscape preview and override
- Publish books after approval
- Manage curated audio library

**LiveView Components**:
- `BookListComponent`: Shows all books with processing status
- `SceneReviewComponent`: Displays scenes with audio players
- `SoundscapePickerComponent`: Modal for selecting alternative audio
- `LibraryManagerComponent`: Upload and tag soundscapes

**Key Interactions**:
1. Admin clicks "Review" on processed book
2. LiveView loads all scenes with soundscapes
3. Admin plays audio for each scene
4. If override needed, modal shows full library with filters
5. Admin selects new soundscape, confidence updated to 1.0
6. Admin clicks "Publish", book.is_published set to true

**Authorization**:
- Plug-based admin role check
- Admin role stored in users.role field
- All admin routes require authentication + admin role

### 6. Reader Interface

**Module**: `StoriaWeb.ReaderLive`

**Responsibilities**:
- Display book text with typography
- Synchronize audio playback with page navigation
- Save reading progress
- Handle subscription tier restrictions

**LiveView State**:
```elixir
%{
  book: Book.t(),
  current_page: integer(),
  current_scene: Scene.t(),
  audio_url: String.t(),
  user_preferences: map(),
  subscription_tier: atom()
}
```

**Page Navigation Flow**:
1. User clicks "Next Page"
2. LiveView updates current_page in state
3. Check if scene changed (page.scene_id != current_scene.id)
4. If scene changed, push new audio_url to client
5. Client-side Alpine.js triggers crossfade
6. Background: async update reading_progress table

**Audio Crossfading**:
- Implemented client-side with Web Audio API
- Crossfade duration: 2 seconds
- Preload next scene's audio when 3 pages from boundary
- Fallback: direct switch if preload fails

**Key Functions**:
```elixir
load_book(book_id, user_id) :: {:ok, map()} | {:error, atom()}
navigate_to_page(page_number) :: {:noreply, Socket.t()}
update_progress(user_id, book_id, page_number) :: :ok
check_tier_access(user, book) :: boolean()
```

### 7. Subscription Management

**Module**: `Storia.Billing`

**Responsibilities**:
- Create Stripe checkout sessions
- Handle webhook events
- Update subscription tiers
- Enforce tier limits

**Stripe Integration**:
- Checkout mode: subscription
- Success URL: /account/subscription/success
- Cancel URL: /account/subscription
- Webhook events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted

**Tier Enforcement**:
```elixir
def can_access_book?(user, book) do
  case user.subscription_tier do
    :free -> count_accessed_books(user.id) < 3
    :reader -> count_monthly_books(user.id) < 20
    :bibliophile -> true
  end
end
```

**Key Functions**:
```elixir
create_checkout_session(user, tier) :: {:ok, String.t()} | {:error, String.t()}
handle_webhook(event) :: :ok | {:error, String.t()}
update_subscription(user_id, tier, status) :: {:ok, User.t()}
check_book_limit(user_id) :: {:ok, integer()} | {:error, :limit_reached}
```

### 8. Cloudflare R2 Storage

**Module**: `Storia.Storage`

**Responsibilities**:
- Upload PDFs and audio files
- Generate signed URLs for streaming
- Handle file deletion
- Organize files by type

**Bucket Structure**:
```
storia-production/
  pdfs/
    {book_id}.pdf
  audio/
    curated/
      {soundscape_id}.mp3
    generated/  # Future use
      {soundscape_id}.mp3
```

**Configuration**:
```elixir
config :ex_aws,
  access_key_id: System.get_env("R2_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("R2_SECRET_ACCESS_KEY"),
  region: "auto"

config :ex_aws, :s3,
  scheme: "https://",
  host: "#{account_id}.r2.cloudflarestorage.com"
```

**Key Functions**:
```elixir
upload_pdf(file_path, book_id) :: {:ok, String.t()} | {:error, String.t()}
upload_audio(file_path, soundscape_id, type) :: {:ok, String.t()}
generate_signed_url(key, expires_in) :: String.t()
delete_file(key) :: :ok | {:error, String.t()}
```

## Data Models

### Complete Schema Relationships

```
users
  ├── reading_progress (has_many)
  └── books (has_many, through: reading_progress)

books
  ├── pages (has_many)
  ├── scenes (has_many)
  └── reading_progress (has_many)

pages
  ├── book (belongs_to)
  └── scene (belongs_to)

scenes
  ├── book (belongs_to)
  ├── pages (has_many)
  └── soundscape (has_one)

soundscapes
  └── scene (belongs_to)

reading_progress
  ├── user (belongs_to)
  └── book (belongs_to)
```

### Indexes for Performance

```sql
-- Books
CREATE INDEX books_is_published_idx ON books(is_published);
CREATE INDEX books_source_type_idx ON books(source_type);

-- Pages
CREATE INDEX pages_book_id_page_number_idx ON pages(book_id, page_number);
CREATE INDEX pages_scene_id_idx ON pages(scene_id);

-- Scenes
CREATE INDEX scenes_book_id_idx ON scenes(book_id);

-- Soundscapes
CREATE INDEX soundscapes_scene_id_idx ON soundscapes(scene_id);
CREATE INDEX soundscapes_source_type_idx ON soundscapes(source_type);

-- Reading Progress
CREATE UNIQUE INDEX reading_progress_user_book_idx ON reading_progress(user_id, book_id);
CREATE INDEX reading_progress_user_id_idx ON reading_progress(user_id);
```

## Error Handling

### PDF Processing Errors

**Scenario**: PDF extraction fails due to corrupted file or unsupported format

**Handling**:
1. Oban job catches exception
2. Update book.processing_status to "failed"
3. Store error message in book.processing_error field
4. Send notification to admin via LiveView broadcast
5. Allow admin to retry or delete book

### AI API Errors

**Scenario**: Replicate API timeout or rate limit

**Handling**:
1. Implement exponential backoff: 1s, 2s, 4s, 8s
2. Oban max_attempts: 5
3. If all retries fail, flag scene for manual classification
4. Continue processing remaining scenes
5. Admin can trigger re-analysis for failed scenes

### Audio Playback Errors

**Scenario**: Audio file fails to load in browser

**Handling**:
1. Web Audio API catches loading error
2. Display toast notification: "Audio unavailable, continuing with text"
3. Log error to backend for investigation
4. Allow reading to continue without audio
5. Retry audio load on next scene transition

### Subscription Webhook Failures

**Scenario**: Stripe webhook not received or processed

**Handling**:
1. Implement idempotency keys for webhook processing
2. Store webhook events in database for audit trail
3. Daily cron job reconciles Stripe subscriptions with database
4. Alert admin if discrepancies found
5. Manual override capability for subscription status

### Database Connection Errors

**Scenario**: PostgreSQL connection lost during operation

**Handling**:
1. Ecto pool automatically retries connection
2. LiveView shows "Connection lost" message
3. Automatic reconnection when database available
4. Oban jobs automatically retry after connection restored
5. No data loss due to transactional operations

## Testing Strategy

### Unit Tests

**Coverage Target**: 80% for business logic

**Key Areas**:
- `Storia.Accounts`: User registration, authentication, password reset
- `Storia.Soundscapes.Mapper`: Matching algorithm, score calculation
- `Storia.AI.SceneClassifier`: Scene boundary detection, descriptor parsing
- `Storia.Billing`: Tier enforcement, limit checking

**Tools**: ExUnit, Mox for API mocking

### Integration Tests

**Scenarios**:
1. Complete PDF processing pipeline (upload → extract → analyze → map)
2. Reader flow (login → browse → read → save progress)
3. Admin workflow (upload → review → override → publish)
4. Subscription flow (checkout → webhook → tier update → access grant)

**Tools**: ExUnit with Ecto.Sandbox, Wallaby for browser testing

### End-to-End Tests

**Critical Paths**:
1. New user signup → subscribe to Reader tier → read first book
2. Admin upload public domain book → system processes → admin publishes → user reads
3. User reaches book limit → upgrade prompt → Stripe checkout → immediate access

**Tools**: Wallaby with ChromeDriver

### Performance Tests

**Benchmarks**:
- PDF extraction: < 30 seconds for 300-page book
- Scene analysis: < 2 minutes for 300-page book
- Page navigation: < 200ms response time
- Audio crossfade: < 100ms latency

**Tools**: Benchee for Elixir functions, Lighthouse for frontend

### Manual QA Checklist

**Before Launch**:
- [ ] Test all subscription tiers with real Stripe test mode
- [ ] Verify audio crossfading on multiple browsers (Chrome, Firefox, Safari)
- [ ] Confirm reading progress syncs across devices
- [ ] Test admin override flow with all 25-30 curated soundscapes
- [ ] Validate PDF processing with various file sizes and formats
- [ ] Check mobile responsiveness on iOS and Android
- [ ] Verify email delivery for password reset and subscription confirmations
- [ ] Test error scenarios (network loss, API failures, invalid uploads)

## Security Considerations

### Authentication
- Passwords hashed with Bcrypt (cost: 12)
- Session tokens signed with Phoenix.Token
- CSRF protection enabled on all forms
- Rate limiting on login attempts (5 per minute per IP)

### Authorization
- Admin routes protected with role-based plug
- Book access validated against subscription tier
- Signed URLs for R2 assets (expires in 1 hour)
- API keys stored in environment variables, never in code

### Data Protection
- SSL/TLS required for all connections
- Database credentials encrypted at rest
- Stripe webhook signature verification
- Input sanitization on all user-provided content

### API Security
- Replicate API key rotation every 90 days
- Rate limiting on AI analysis jobs (10 concurrent max)
- Request timeout: 30 seconds
- Retry with exponential backoff to prevent API abuse

## Deployment Architecture

### Infrastructure

**Application Server**:
- Platform: Fly.io or Gigalixir
- Instances: 2 (for redundancy)
- Memory: 512MB per instance
- Elixir release with mix release

**Database**:
- PostgreSQL 15
- Managed service (Fly.io Postgres or Supabase)
- Daily automated backups
- Connection pooling: 10 connections per instance

**Storage**:
- Cloudflare R2
- Bucket: storia-production
- CORS enabled for audio streaming
- Lifecycle policy: retain all files (no auto-deletion)

**Background Jobs**:
- Oban running in application instances
- Queues: pdf_processing (concurrency: 2), ai_analysis (concurrency: 5), default (concurrency: 10)
- Job retention: 7 days

### Environment Variables

```
DATABASE_URL=postgresql://...
SECRET_KEY_BASE=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=storia-production
REPLICATE_API_KEY=...
STRIPE_API_KEY=...
STRIPE_WEBHOOK_SECRET=...
PHX_HOST=storia.app
```

### Monitoring

**Application Monitoring**:
- AppSignal or Sentry for error tracking
- Phoenix LiveDashboard for real-time metrics
- Custom Telemetry events for business metrics

**Key Metrics**:
- PDF processing success rate
- AI analysis cost per book
- Audio streaming bandwidth
- User reading session duration
- Subscription conversion rate

**Alerts**:
- Error rate > 5% in 5 minutes
- Database connection pool exhausted
- Oban queue depth > 100 jobs
- R2 storage > 80% of quota
- Stripe webhook failures

### Deployment Process

1. Run tests: `mix test`
2. Build release: `mix release`
3. Deploy to staging: `fly deploy --app storia-staging`
4. Run smoke tests on staging
5. Deploy to production: `fly deploy --app storia-production`
6. Run database migrations: `fly ssh console --app storia-production -C "/app/bin/migrate"`
7. Monitor error rates for 30 minutes
8. Rollback if error rate > 5%

## Performance Optimization

### Database Queries
- Preload associations to avoid N+1 queries
- Use `Repo.stream` for large result sets
- Implement pagination for book lists (20 per page)
- Cache frequently accessed data (book metadata) in ETS

### LiveView Optimization
- Use `temporary_assigns` for large lists
- Implement `handle_info` for async operations
- Debounce user input events (300ms)
- Lazy load images with IntersectionObserver

### Audio Streaming
- Use HTTP range requests for partial content
- Implement audio preloading for next scene
- Compress audio files to 128kbps MP3
- CDN caching via Cloudflare (R2 auto-caches)

### Background Jobs
- Batch page inserts (50 at a time)
- Process scenes in parallel (5 concurrent)
- Use Oban's `unique` option to prevent duplicate jobs
- Implement job priority (admin uploads: high, user uploads: normal)

## Future Considerations

### Phase 2 Enhancements
- PWA capabilities for offline reading
- User PDF upload feature (Bibliophile tier)
- Enhanced audio library with premium tracks
- User preferences (font size, theme, audio volume presets)

### Phase 3 Additions
- Community features (user-generated sound-maps)
- B2B education portal
- Advanced analytics dashboard
- Mobile native apps (React Native or Flutter)

### Phase 4 Generative Audio
- Integration with elevenlabs/music via Replicate
- Hybrid mapping algorithm (curated + generated)
- Cost optimization for generated audio
- Quality control for AI-generated soundscapes

### Scalability Considerations
- Horizontal scaling: Add more Fly.io instances
- Database read replicas for heavy read operations
- Redis for distributed caching
- Separate Oban instances for job processing
- CDN for static assets (Cloudflare)
