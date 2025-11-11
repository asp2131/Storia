# Requirements Document

## Introduction

Storia is an immersive reading platform that transforms digital reading by integrating AI-generated ambient soundscapes that dynamically correspond to the narrative. The MVP focuses on delivering a curated, admin-managed library of public domain classics with intelligent soundscape mapping, providing users with a multi-sensory reading experience through Phoenix LiveView.

## Glossary

- **Storia Platform**: The web-based immersive reading application built with Phoenix LiveView
- **Admin Interface**: The administrative dashboard for content management and quality control
- **Reader Interface**: The end-user reading experience with synchronized audio playback
- **Scene Classification Engine**: The AI-powered system using Gemini Flash 2.5 via Replicate for analyzing book content
- **Soundscape Mapping Algorithm**: The intelligent system that matches detected scenes to appropriate audio from the curated library
- **Curated Library**: The pre-selected collection of 25-30 royalty-free ambient soundscapes
- **Processing Pipeline**: The automated workflow for converting uploaded PDFs into immersive reading experiences
- **Web Audio System**: The browser-based audio playback system with crossfading capabilities
- **Cloudflare R2**: The S3-compatible storage service for PDFs and audio files
- **Subscription Tier**: The user's access level (Free, Reader, or Bibliophile)

## Requirements

### Requirement 1

**User Story:** As a reader, I want to sign up and log in securely, so that I can access my personalized reading experience and track my progress.

#### Acceptance Criteria

1. WHEN a new user provides valid email and password credentials, THE Storia Platform SHALL create a new user account with encrypted password storage
2. WHEN an existing user provides valid login credentials, THE Storia Platform SHALL authenticate the user and establish a secure session
3. WHEN a user requests password reset, THE Storia Platform SHALL send a secure reset link to the registered email address
4. THE Storia Platform SHALL enforce password complexity requirements of minimum 8 characters with at least one uppercase letter, one lowercase letter, and one number
5. WHEN a user session expires after 30 days of inactivity, THE Storia Platform SHALL require re-authentication

### Requirement 2

**User Story:** As an administrator, I want to upload and process PDF books through a dedicated interface, so that I can build the curated library of immersive reading experiences.

#### Acceptance Criteria

1. WHEN an administrator uploads a PDF file, THE Admin Interface SHALL validate the file format and size limit of 50MB
2. WHEN a valid PDF is uploaded, THE Processing Pipeline SHALL extract text content from all pages using pdf.js
3. WHEN text extraction completes, THE Processing Pipeline SHALL store the extracted content in the pages table with page numbers
4. THE Admin Interface SHALL display upload progress and processing status in real-time using LiveView updates
5. WHEN processing fails, THE Admin Interface SHALL display specific error messages and allow retry attempts

### Requirement 3

**User Story:** As an administrator, I want the system to automatically analyze book content and suggest soundscape mappings, so that I can efficiently create immersive experiences with minimal manual effort.

#### Acceptance Criteria

1. WHEN page text is extracted, THE Scene Classification Engine SHALL analyze content using Gemini Flash 2.5 to identify setting, mood, weather, time of day, and intensity
2. WHEN scene attributes are detected, THE Scene Classification Engine SHALL group consecutive pages with similar attributes into scenes
3. WHEN scenes are identified, THE Soundscape Mapping Algorithm SHALL match each scene to the most appropriate audio track from the Curated Library with a confidence score
4. THE Processing Pipeline SHALL store scene descriptors and soundscape mappings in the database with timestamps
5. WHEN analysis completes, THE Processing Pipeline SHALL calculate total processing cost and log it for budget tracking

### Requirement 4

**User Story:** As an administrator, I want to review and override automated soundscape mappings, so that I can ensure the highest quality immersive experience before publishing books.

#### Acceptance Criteria

1. WHEN an administrator views a processed book, THE Admin Interface SHALL display all detected scenes with their assigned soundscapes and confidence scores
2. WHEN an administrator selects a scene, THE Admin Interface SHALL allow playback of the assigned soundscape and display scene descriptors
3. WHEN an administrator overrides a mapping, THE Admin Interface SHALL present the full Curated Library with preview capabilities
4. WHEN an administrator saves changes, THE Admin Interface SHALL update the soundscapes table and mark the book as manually reviewed
5. THE Admin Interface SHALL prevent publishing books until administrator approval is recorded

### Requirement 5

**User Story:** As a reader, I want to browse and select books from the curated library, so that I can discover immersive reading experiences that interest me.

#### Acceptance Criteria

1. WHEN a user accesses the library, THE Reader Interface SHALL display all published books with title, author, cover image, and page count
2. WHEN a user filters by genre or author, THE Reader Interface SHALL update the displayed books in real-time using LiveView
3. WHEN a user selects a book, THE Reader Interface SHALL verify subscription tier access before allowing entry
4. THE Reader Interface SHALL display book limits based on subscription tier (3 for Free, 20 for Reader, unlimited for Bibliophile)
5. WHEN a Free tier user reaches the 3-book limit, THE Reader Interface SHALL display upgrade prompts with pricing information

### Requirement 6

**User Story:** As a reader, I want to read books with synchronized ambient soundscapes, so that I can experience an immersive multi-sensory reading experience.

#### Acceptance Criteria

1. WHEN a user opens a book, THE Reader Interface SHALL display the current page text with readable typography and proper formatting
2. WHEN a page is displayed, THE Web Audio System SHALL load and play the associated soundscape with smooth crossfading between scene transitions
3. WHEN a user navigates to the next page, THE Reader Interface SHALL update the display and trigger audio transitions within 200 milliseconds
4. THE Web Audio System SHALL maintain audio playback continuity when pages within the same scene are navigated
5. WHEN a user closes the book, THE Storia Platform SHALL save the current page number to the reading_progress table

### Requirement 7

**User Story:** As a reader, I want to control audio playback and volume, so that I can customize the immersive experience to my preferences.

#### Acceptance Criteria

1. WHEN a user adjusts the volume slider, THE Web Audio System SHALL update playback volume in real-time with values between 0 and 100 percent
2. WHEN a user clicks the mute button, THE Web Audio System SHALL silence audio while maintaining playback position
3. WHEN a user toggles audio off, THE Reader Interface SHALL continue displaying text content without audio playback
4. THE Reader Interface SHALL persist audio preferences in browser storage for future sessions
5. WHEN audio fails to load, THE Reader Interface SHALL display an error message and allow reading to continue without audio

### Requirement 8

**User Story:** As a reader, I want my reading progress automatically saved, so that I can resume reading from where I left off across devices.

#### Acceptance Criteria

1. WHEN a user navigates to a new page, THE Storia Platform SHALL update the reading_progress table within 2 seconds
2. WHEN a user reopens a book, THE Reader Interface SHALL load the last saved page number from the reading_progress table
3. WHEN a user accesses Storia from a different device, THE Reader Interface SHALL display the synchronized reading position
4. THE Storia Platform SHALL maintain reading progress for all books in the user's library indefinitely
5. WHEN database updates fail, THE Storia Platform SHALL retry the operation up to 3 times before logging an error

### Requirement 9

**User Story:** As a user, I want to subscribe to different tiers with secure payment processing, so that I can access features appropriate to my reading needs.

#### Acceptance Criteria

1. WHEN a user selects a subscription tier, THE Storia Platform SHALL display pricing and feature details for Free, Reader, and Bibliophile tiers
2. WHEN a user initiates payment, THE Storia Platform SHALL redirect to Stripe Checkout with the selected tier information
3. WHEN payment succeeds, THE Storia Platform SHALL update the user's subscription_tier field and grant immediate access to tier features
4. WHEN payment fails, THE Storia Platform SHALL display error messages and allow retry attempts
5. THE Storia Platform SHALL send confirmation emails for successful subscription changes within 5 minutes

### Requirement 10

**User Story:** As an administrator, I want to manage the curated soundscape library, so that I can maintain and expand the available audio options for scene mapping.

#### Acceptance Criteria

1. WHEN an administrator uploads an audio file, THE Admin Interface SHALL validate the format as MP3 or WAV with maximum size of 10MB
2. WHEN a valid audio file is uploaded, THE Admin Interface SHALL store it in Cloudflare R2 and create a soundscapes table entry with metadata
3. WHEN an administrator tags a soundscape, THE Admin Interface SHALL accept descriptors for mood, setting, intensity, weather, and time of day
4. THE Admin Interface SHALL display all soundscapes with preview playback and usage statistics showing how many scenes use each track
5. WHEN an administrator deletes a soundscape, THE Admin Interface SHALL prevent deletion if the soundscape is currently mapped to any published book scenes
