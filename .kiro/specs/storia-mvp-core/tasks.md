# Implementation Plan

- [x] 1. Initialize Phoenix project and configure dependencies
  - Create new Phoenix 1.7 project with LiveView
  - Configure PostgreSQL database connection
  - Add dependencies: Oban, ExAws, Bcrypt, Stripe, HTTPoison
  - Set up Tailwind CSS and Alpine.js
  - Configure environment variables for API keys
  - _Requirements: All (foundation)_

- [x] 2. Implement authentication system
  - [x] 2.1 Create users table migration and schema
    - Define users schema with email, password_hash, subscription_tier, stripe_customer_id
    - Add unique index on email
    - Create migration file
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 2.2 Build Accounts context with core auth functions
    - Implement register_user/1 with password hashing
    - Implement authenticate_user/2 with credential validation
    - Implement generate_reset_token/1 and reset_password/2
    - Add password complexity validation
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 2.3 Create authentication LiveView pages
    - Build registration page with form validation
    - Build login page with session management
    - Build password reset request and confirmation pages
    - Add CSRF protection and rate limiting plug
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 2.4 Write authentication tests
    - Unit tests for Accounts context functions
    - Integration tests for registration and login flows
    - Test password reset flow end-to-end
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Set up database schema for books and content
  - [x] 3.1 Create books, pages, scenes, and soundscapes tables
    - Create books migration with all fields and enums
    - Create pages migration with book_id foreign key
    - Create scenes migration with book_id foreign key and descriptors JSONB field
    - Create soundscapes migration with scene_id foreign key
    - Add all necessary indexes for performance
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_
  
  - [x] 3.2 Create Ecto schemas and changesets
    - Define Book schema with associations
    - Define Page schema with validations
    - Define Scene schema with embedded descriptors
    - Define Soundscape schema with tags
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_
  
  - [x] 3.3 Create reading_progress table
    - Create migration with user_id, book_id, current_page
    - Add unique index on user_id and book_id
    - Define ReadingProgress schema
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 4. Implement Cloudflare R2 storage integration
  - [ ] 4.1 Configure ExAws for R2 connectivity
    - Add ExAws and ExAws.S3 dependencies
    - Configure R2 endpoint and credentials in config files
    - Create Storia.Storage module with upload/download functions
    - _Requirements: 2.1, 10.2_
  
  - [ ] 4.2 Build file upload utilities
    - Implement upload_pdf/2 function with unique key generation
    - Implement upload_audio/3 function with type-based paths
    - Implement generate_signed_url/2 for secure streaming
    - Implement delete_file/1 for cleanup
    - _Requirements: 2.1, 10.2_
  
  - [ ] 4.3 Test R2 integration
    - Test file upload and retrieval
    - Test signed URL generation and expiration
    - Test error handling for network failures
    - _Requirements: 2.1, 10.2_

- [ ] 5. Build PDF processing pipeline
  - [ ] 5.1 Set up Oban for background jobs
    - Add Oban dependency and configure queues
    - Create migration for Oban tables
    - Configure pdf_processing queue with concurrency 2
    - _Requirements: 2.2, 2.3_
  
  - [ ] 5.2 Create Node.js PDF extraction script
    - Install pdf.js-extract npm package
    - Write extraction script that outputs JSON
    - Add error handling for corrupted PDFs
    - Test with sample public domain PDFs
    - _Requirements: 2.2, 2.3_
  
  - [ ] 5.3 Implement PDFProcessor Oban worker
    - Create PDFProcessor.ExtractJob module
    - Implement perform/1 to call Node.js script via System.cmd
    - Parse JSON output and batch insert pages
    - Update book processing_status on success/failure
    - Enqueue SceneAnalyzer job on completion
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  
  - [ ] 5.4 Test PDF processing pipeline
    - Test extraction with various PDF formats
    - Test error handling for corrupted files
    - Test batch page insertion performance
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [ ] 6. Implement AI scene classification
  - [ ] 6.1 Create Replicate API client
    - Build Storia.AI.ReplicateClient module
    - Implement create_prediction/2 for Gemini Flash
    - Implement get_prediction/1 for polling results
    - Add retry logic with exponential backoff
    - _Requirements: 3.1, 3.2_
  
  - [ ] 6.2 Build SceneClassifier module
    - Implement classify_page/1 with AI prompt
    - Parse JSON response into descriptor map
    - Implement detect_scene_boundaries/1 with similarity algorithm
    - Implement create_scenes/3 to group pages
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 6.3 Create SceneAnalyzer Oban worker
    - Create SceneAnalyzer.AnalyzeJob module
    - Implement perform/1 to process all pages
    - Calculate and store processing cost
    - Handle API errors and flag for manual review
    - Enqueue SoundscapeMapper job on completion
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 6.4 Test scene classification
    - Mock Replicate API responses
    - Test scene boundary detection algorithm
    - Test error handling for API failures
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7. Build soundscape mapping system
  - [ ] 7.1 Create curated soundscape library seeder
    - Define 25-30 soundscape entries with tags
    - Create seed script to populate soundscapes table
    - Upload audio files to R2 curated folder
    - Store audio URLs and tag metadata
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [ ] 7.2 Implement Mapper module with matching algorithm
    - Build calculate_match_score/2 with weighted similarity
    - Implement find_best_match/1 to select soundscape
    - Add confidence threshold logic (0.7)
    - Implement flag_for_review/2 for low confidence
    - _Requirements: 3.3, 3.4_
  
  - [ ] 7.3 Create SoundscapeMapper Oban worker
    - Create SoundscapeMapper.MapJob module
    - Implement perform/1 to map all scenes
    - Store mappings with confidence scores
    - Update book processing_status to "ready_for_review"
    - _Requirements: 3.3, 3.4_
  
  - [ ] 7.4 Test soundscape mapping
    - Test matching algorithm with various descriptors
    - Test confidence score calculation
    - Test flagging logic for low confidence
    - _Requirements: 3.3, 3.4_

- [ ] 8. Create admin interface for content management
  - [ ] 8.1 Build admin authentication and authorization
    - Add role field to users table (enum: user, admin)
    - Create RequireAdmin plug for route protection
    - Implement admin role check in Accounts context
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 8.2 Create AdminLive.BookList component
    - Display all books with processing status
    - Show upload form for new PDFs
    - Handle file upload and trigger processing pipeline
    - Display real-time processing progress via LiveView
    - _Requirements: 2.1, 2.4, 4.1_
  
  - [ ] 8.3 Build AdminLive.SceneReview component
    - Load book with all scenes and soundscapes
    - Display scene descriptors and confidence scores
    - Add audio player for each soundscape preview
    - Implement override modal with library picker
    - Save overrides and update confidence to 1.0
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 8.4 Create AdminLive.LibraryManager component
    - Display all curated soundscapes with tags
    - Add upload form for new audio files
    - Implement tagging interface for mood, setting, etc.
    - Show usage statistics per soundscape
    - Prevent deletion of in-use soundscapes
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ] 8.5 Add publish functionality
    - Create publish button in SceneReview
    - Validate all scenes have approved soundscapes
    - Update book.is_published to true
    - Broadcast update to user library views
    - _Requirements: 4.5_

- [ ] 9. Implement reader interface
  - [ ] 9.1 Create LibraryLive for book browsing
    - Display published books with metadata
    - Implement genre and author filters
    - Add subscription tier access validation
    - Show book limits and upgrade prompts
    - Handle book selection and navigation to reader
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ] 9.2 Build ReaderLive core reading interface
    - Load book with current page from reading_progress
    - Display page text with readable typography
    - Implement next/previous page navigation
    - Detect scene changes and update audio URL
    - Save reading progress asynchronously
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 8.1, 8.2, 8.3_
  
  - [ ] 9.3 Implement Web Audio API integration
    - Create Alpine.js component for audio playback
    - Load audio from signed R2 URLs
    - Implement crossfade logic (2 second duration)
    - Add preloading for next scene audio
    - Handle audio loading errors gracefully
    - _Requirements: 6.2, 6.3, 6.4, 7.5_
  
  - [ ] 9.4 Add audio controls and preferences
    - Create volume slider with real-time updates
    - Add mute/unmute toggle button
    - Implement audio on/off toggle
    - Store preferences in browser localStorage
    - Persist preferences across sessions
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ] 9.5 Test reader interface
    - Test page navigation and progress saving
    - Test audio crossfading on scene transitions
    - Test subscription tier restrictions
    - Test error handling for audio failures
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 10. Integrate Stripe for subscription management
  - [ ] 10.1 Configure Stripe SDK and webhooks
    - Add Stripe Elixir library dependency
    - Configure API keys in environment
    - Set up webhook endpoint route
    - Implement webhook signature verification
    - _Requirements: 9.2, 9.3, 9.4_
  
  - [ ] 10.2 Create Billing context
    - Implement create_checkout_session/2 for subscription tiers
    - Build handle_webhook/1 for event processing
    - Implement update_subscription/3 to update user tier
    - Add check_book_limit/1 for tier enforcement
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 10.3 Build subscription management UI
    - Create subscription page showing current tier
    - Display pricing table with tier features
    - Add upgrade/downgrade buttons with Stripe redirect
    - Show success/cancel pages after checkout
    - Display book usage and limits
    - _Requirements: 9.1, 9.5_
  
  - [ ] 10.4 Implement tier access enforcement
    - Add can_access_book?/2 function with tier logic
    - Integrate checks in LibraryLive and ReaderLive
    - Display upgrade prompts when limits reached
    - Track monthly book access for Reader tier
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [ ] 10.5 Test subscription flows
    - Test checkout session creation
    - Test webhook processing with Stripe CLI
    - Test tier enforcement logic
    - Test upgrade/downgrade scenarios
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 11. Add reading progress tracking
  - [ ] 11.1 Implement progress saving logic
    - Create Content.update_progress/3 function
    - Add async progress updates in ReaderLive
    - Implement retry logic for failed updates
    - Add debouncing to prevent excessive writes
    - _Requirements: 8.1, 8.5_
  
  - [ ] 11.2 Build progress loading and synchronization
    - Load last page on book open
    - Handle missing progress (start at page 1)
    - Sync progress across devices via database
    - Display progress indicator in library
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [ ] 11.3 Test progress tracking
    - Test progress saving on page navigation
    - Test progress loading on book reopen
    - Test cross-device synchronization
    - Test retry logic for database failures
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 12. Polish UI and add responsive design
  - [ ] 12.1 Implement Tailwind styling for all pages
    - Style authentication pages with forms
    - Style admin interface with tables and modals
    - Style library with card grid layout
    - Style reader with clean typography
    - _Requirements: All (user experience)_
  
  - [ ] 12.2 Add mobile responsiveness
    - Make library grid responsive (1-3 columns)
    - Optimize reader for mobile screens
    - Add touch gestures for page navigation
    - Test on iOS and Android browsers
    - _Requirements: All (user experience)_
  
  - [ ] 12.3 Implement loading states and error messages
    - Add spinners for processing operations
    - Display toast notifications for errors
    - Show skeleton loaders for content
    - Add empty states for library and admin
    - _Requirements: 2.5, 7.5_

- [ ] 13. Set up deployment infrastructure
  - [ ] 13.1 Create production configuration
    - Configure production database settings
    - Set up environment variable management
    - Configure Oban for production queues
    - Add AppSignal or Sentry for monitoring
    - _Requirements: All (deployment)_
  
  - [ ] 13.2 Build Elixir release
    - Create release configuration
    - Add database migration task
    - Build Docker image (optional)
    - Test release locally
    - _Requirements: All (deployment)_
  
  - [ ] 13.3 Deploy to Fly.io or Gigalixir
    - Create application on hosting platform
    - Configure PostgreSQL database
    - Set environment variables
    - Deploy application
    - Run database migrations
    - Verify deployment with smoke tests
    - _Requirements: All (deployment)_

- [ ] 14. Seed initial content library
  - [ ] 14.1 Process public domain classics
    - Select 15-20 public domain books (Project Gutenberg)
    - Upload PDFs via admin interface
    - Monitor processing pipeline completion
    - Review and approve all soundscape mappings
    - Publish books to user library
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 14.2 Create demo admin and user accounts
    - Create admin account for content management
    - Create test user accounts for each tier
    - Verify tier restrictions work correctly
    - Test complete user journey from signup to reading
    - _Requirements: 1.1, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 15. Final testing and launch preparation
  - [ ] 15.1 Run comprehensive test suite
    - Execute all unit tests
    - Run integration tests
    - Perform end-to-end tests with Wallaby
    - Fix any failing tests
    - _Requirements: All_
  
  - [ ] 15.2 Perform manual QA
    - Test all subscription tiers with Stripe test mode
    - Verify audio crossfading on Chrome, Firefox, Safari
    - Confirm reading progress syncs across devices
    - Test admin override flow with all soundscapes
    - Validate PDF processing with various formats
    - Check mobile responsiveness on iOS and Android
    - Verify email delivery for password reset
    - Test error scenarios (network loss, API failures)
    - _Requirements: All_
  
  - [ ] 15.3 Set up monitoring and alerts
    - Configure error tracking (AppSignal/Sentry)
    - Set up Phoenix LiveDashboard
    - Create alerts for error rates and queue depth
    - Add custom Telemetry events for business metrics
    - Test alert delivery
    - _Requirements: All (operations)_
  
  - [ ] 15.4 Prepare launch materials
    - Write user documentation
    - Create admin guide for content management
    - Prepare marketing landing page
    - Set up analytics tracking
    - _Requirements: All (launch)_
