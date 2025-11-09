# Implementation Plan

## Overview
This implementation plan breaks down the Immersive Reading Platform into discrete, actionable coding tasks. Each task builds incrementally on previous work, with the goal of creating a functional MVP that processes PDF books and generates synchronized soundscapes.

---

## Phase 1: Project Setup and Core Infrastructure

- [x] 1. Initialize Next.js project with TypeScript and core dependencies
  - Create Next.js 14 app with App Router and TypeScript
  - Install and configure Tailwind CSS
  - Set up ESLint and Prettier
  - Create basic folder structure: `/app`, `/lib`, `/components`, `/types`
  - Configure environment variables structure in `.env.example`
  - _Requirements: Foundation for all subsequent tasks_

- [x] 2. Set up PostgreSQL database with Prisma ORM
  - Install Prisma and PostgreSQL client
  - Create Prisma schema with all tables: users, books, pages, scenes, soundscapes, reading_progress
  - Add indexes for performance optimization
  - Generate Prisma client and types
  - Create database migration scripts
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Configure Cloudflare R2 storage client
  - Install AWS SDK v3 for S3-compatible storage
  - Create `lib/storage.ts` with R2 client configuration
  - Implement `uploadPDFToR2()` function
  - Implement `uploadToR2()` function for audio files
  - Add error handling and retry logic
  - _Requirements: 2.3, 4.3_

---

## Phase 2: Authentication System

- [x] 4. Implement NextAuth.js authentication
  - Install NextAuth.js and required dependencies
  - Create `/app/api/auth/[...nextauth]/route.ts` with configuration
  - Implement email/password authentication provider
  - Add OAuth providers (Google, GitHub)
  - Create `lib/auth.ts` utility functions
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Create authentication UI components
  - Build login page at `/app/login/page.tsx`
  - Build registration page at `/app/register/page.tsx`
  - Create reusable form components
  - Add client-side validation
  - Implement session management on client
  - _Requirements: 1.1, 1.2_

- [ ] 6. Add route protection middleware
  - Create `middleware.ts` for route protection
  - Protect `/app/library` and `/app/read` routes
  - Redirect unauthenticated users to login
  - Handle session expiration gracefully
  - _Requirements: 1.4_

---

## Phase 3: PDF Upload and Processing

- [x] 7. Create PDF upload API endpoint
  - Create `/app/api/books/upload/route.ts`
  - Implement multipart form data handling
  - Add file validation (type, size limits)
  - Create book record in database
  - Upload PDF to Cloudflare R2
  - Return book ID and processing status
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 8. Implement PDF text extraction with pdf.js
  - Install `pdfjs-dist` library
  - Create `lib/pdfProcessor.ts` module
  - Implement `extractPDFText()` function to extract text per page
  - Implement `extractPDFMetadata()` for title, author, page count
  - Handle extraction errors gracefully
  - _Requirements: 2.2_

- [x] 9. Build PDF upload UI component
  - Create `/app/library/page.tsx` for book library
  - Build file upload component with drag-and-drop
  - Show upload progress indicator
  - Display validation errors to user
  - Show processing status after upload
  - _Requirements: 2.1_

---

## Phase 4: Content Analysis with Gemini

- [x] 10. Set up Google Gemini API client
  - Install `@google/generative-ai` package
  - Create `lib/gemini.ts` with client configuration
  - Add API key to environment variables
  - Implement error handling and rate limiting
  - _Requirements: 3.1_

- [x] 11. Implement content analysis module
  - Create `lib/analyzeContent.ts`
  - Implement `analyzePageContent()` function using Gemini Flash
  - Parse Gemini response to extract scene elements
  - Generate audio prompt from analysis
  - Add retry logic with exponential backoff
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 12. Implement scene detection logic
  - Create `lib/sceneDetection.ts`
  - Implement `detectSceneChange()` function
  - Compare setting, mood, and intensity between page spreads
  - Return boolean indicating if new scene detected
  - _Requirements: 3.3, 3.5_

---

## Phase 5: Soundscape Generation with Replicate

- [x] 13. Set up Replicate API client
  - Install `replicate` npm package
  - Create `lib/replicate.ts` with client configuration
  - Define audio model constants (ElevenLabs Music, MusicGen, etc.)
  - Add model configurations for each audio model
  - _Requirements: 4.2_

- [x] 14. Implement soundscape generation module
  - Create `lib/generateSoundscape.ts`
  - Implement `generateSoundscape()` using `replicate.run()`
  - Implement `generateSoundscapeWithPolling()` for better control
  - Download generated audio from Replicate
  - Upload audio to Cloudflare R2 for permanence
  - Return soundscape metadata
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [-] 15. Implement soundscape caching system
  - Create `lib/soundscapeCache.ts`
  - Implement `findCachedSoundscape()` to check for similar scenes
  - Create cache key based on setting + mood + intensity
  - Query database for matching soundscapes
  - Return cached audio URL if found
  - _Requirements: 4.5_

---

## Phase 6: Background Job Processing

- [ ] 16. Create soundscape generation background job
  - Create `/app/api/generate-soundscapes/route.ts`
  - Fetch book with all pages from database
  - Process pages in 2-page spreads (page spread approach)
  - For each spread: analyze content → detect scene change → generate soundscape
  - Update page records with scene references
  - Mark book as "ready" when complete
  - _Requirements: 3.3, 4.1, 4.4_

- [ ] 17. Add job progress tracking and error handling
  - Update book status during processing (processing → ready/failed)
  - Log errors for failed soundscape generations
  - Continue processing remaining scenes on individual failures
  - Implement retry logic for API failures (max 3 attempts)
  - Store error details in database for debugging
  - _Requirements: 9.1, 9.2, 9.3_

---

## Phase 7: Reading Interface

- [x] 18. Create book reader page component
  - Create `/app/read/[bookId]/page.tsx`
  - Fetch book, pages, and scenes from database
  - Implement server-side data loading
  - Handle book not found errors
  - Protect route with authentication
  - _Requirements: 5.1, 5.4_

- [x] 19. Build page navigation component
  - Create `components/PageNavigation.tsx`
  - Add Previous/Next page buttons
  - Display current page number and total pages
  - Implement keyboard shortcuts (arrow keys)
  - Handle edge cases (first/last page)
  - _Requirements: 5.2, 5.3_

- [ ] 20. Integrate react-pageflip for book UI
  - Install `react-pageflip` library
  - Create `components/BookReader.tsx` with page flip functionality
  - Display 2-page spreads
  - Handle page flip animations
  - Trigger scene change detection on page flip
  - Calculate page spread index for scene lookup
  - _Requirements: 5.1, 5.2_

- [ ] 21. Implement reading progress tracking
  - Create `/app/api/progress/route.ts` endpoint
  - Save current page to database on page change
  - Debounce progress updates (save every 2 seconds)
  - Load saved progress when opening book
  - Sync progress across user sessions
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

---

## Phase 8: Audio Playback System

- [ ] 22. Create Web Audio API wrapper
  - Create `lib/audioPlayer.ts`
  - Initialize AudioContext and GainNode
  - Implement audio buffer loading and decoding
  - Create looping playback functionality
  - Add volume control
  - Handle audio context state (suspended/running)
  - _Requirements: 6.1, 6.3_

- [ ] 23. Implement audio crossfading
  - Add `crossfadeToNewSource()` method in audio player
  - Create dual GainNode setup for crossfading
  - Implement 3-second linear ramp for smooth transitions
  - Clean up old audio sources after fade
  - Handle edge cases (no previous audio, same scene)
  - _Requirements: 6.2_

- [ ] 24. Build AudioPlayer React component
  - Create `components/AudioPlayer.tsx`
  - Integrate Web Audio API wrapper
  - Add play/pause button
  - Add volume slider
  - Display current soundscape info
  - Handle component lifecycle (cleanup on unmount)
  - _Requirements: 6.1, 6.3, 6.4, 6.5_

- [ ] 25. Implement soundscape preloading
  - Create preloading logic in reader component
  - Preload next 3 page spreads (6 pages) on mount
  - Preload on page navigation
  - Store preloaded audio buffers in state
  - Implement cache eviction for memory management
  - _Requirements: 6.6, 10.5_

- [ ] 26. Connect audio player to page navigation
  - Detect scene changes on page flip
  - Trigger crossfade when scene changes
  - Continue current soundscape when scene stays same
  - Handle audio loading errors gracefully
  - Show loading state during audio fetch
  - _Requirements: 6.2, 9.4_

---

## Phase 9: User Library and Book Management

- [ ] 27. Create book library page
  - Build `/app/library/page.tsx` with book grid
  - Display book covers (generated or placeholder)
  - Show book title, author, page count
  - Display processing status badge
  - Add "Continue Reading" button with progress
  - Implement book deletion functionality
  - _Requirements: 2.4, 5.4_

- [ ] 28. Implement subscription tier enforcement
  - Add subscription tier check on book upload
  - Enforce 3-book limit for free tier
  - Enforce 20-book limit for reader tier
  - Allow unlimited books for bibliophile tier
  - Display upgrade prompt when limit reached
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

---

## Phase 10: Polish and Optimization

- [ ] 29. Add loading states and error boundaries
  - Create loading skeletons for book library
  - Add loading spinner for book processing
  - Implement React Error Boundaries
  - Create user-friendly error messages
  - Add toast notifications for actions
  - _Requirements: 9.1, 9.4_

- [ ] 30. Optimize database queries
  - Add eager loading for related data (pages, scenes, soundscapes)
  - Implement pagination for book library
  - Add database connection pooling
  - Create database indexes for common queries
  - _Requirements: 10.2, 10.4_

- [ ] 31. Implement performance monitoring
  - Add logging for API response times
  - Track soundscape generation duration
  - Monitor cache hit rates
  - Log errors with context
  - Create simple metrics dashboard
  - _Requirements: 10.1, 10.3_

---

## Phase 11: Deployment

- [ ] 32. Configure Fly.io deployment
  - Create `fly.toml` configuration file
  - Set up Fly.io PostgreSQL database
  - Configure environment variables in Fly.io
  - Set up automatic deployments from Git
  - Configure health checks
  - _Requirements: All requirements for production readiness_

- [ ] 33. Set up production environment variables
  - Configure `GOOGLE_GEMINI_API_KEY`
  - Configure `REPLICATE_API_TOKEN`
  - Configure Cloudflare R2 credentials
  - Set up `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
  - Configure `DATABASE_URL` for production
  - _Requirements: Security and configuration_

---

## Optional Enhancements (Phase 12)

- [ ]* 34. Add page-turning animations with Framer Motion
  - Install `framer-motion` library
  - Add smooth page flip animations
  - Implement page curl effects
  - Add subtle audio cues for page turns
  - _Requirements: Phase 2 enhancement_

- [ ]* 35. Implement bookmark functionality
  - Add bookmark button to reader interface
  - Store bookmarks in database
  - Display bookmarked pages in library
  - Allow quick navigation to bookmarks
  - _Requirements: User experience enhancement_

- [ ]* 36. Create reading statistics dashboard
  - Track total pages read
  - Calculate reading time per session
  - Show favorite books
  - Display reading streaks
  - _Requirements: User engagement_

- [ ]* 37. Add social sharing features
  - Generate shareable reading progress cards
  - Allow sharing favorite quotes
  - Create book club functionality
  - Implement reading challenges
  - _Requirements: Phase 2 social features_

---

## Testing Tasks

- [ ]* 38. Write unit tests for core modules
  - Test PDF text extraction
  - Test scene detection logic
  - Test soundscape caching
  - Test authentication utilities
  - _Requirements: Code quality and reliability_

- [ ]* 39. Write integration tests for API endpoints
  - Test book upload flow
  - Test soundscape generation pipeline
  - Test authentication flows
  - Test reading progress tracking
  - _Requirements: End-to-end functionality_

- [ ]* 40. Perform end-to-end testing
  - Test complete user journey (signup → upload → read)
  - Test audio playback and crossfading
  - Test page navigation and progress saving
  - Test error scenarios and edge cases
  - _Requirements: Production readiness_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for MVP
- Each task should be completed and tested before moving to the next
- Refer to requirements.md and design.md for detailed specifications
- Consider Elixir/Phoenix LiveView pivot if scalability becomes a concern
