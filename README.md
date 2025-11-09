# Immersive Reading Platform

Experience books with AI-generated soundscapes that adapt to the narrative content of each page.

## Features

- 📚 PDF book upload and text extraction
- 🤖 AI-powered content analysis with Google Gemini
- 🎵 Dynamic soundscape generation with Replicate API
- 📖 Immersive reading interface with page-flip animations
- 🔊 Seamless audio crossfading between scenes
- 💾 Reading progress tracking
- 👤 User authentication and subscription tiers

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (serverless)
- **Database:** PostgreSQL with Prisma ORM
- **AI Services:** Google Gemini (content analysis), Replicate (audio generation)
- **Storage:** Cloudflare R2
- **Audio:** Web Audio API
- **Deployment:** Fly.io

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- API keys for:
  - Google Gemini API
  - Replicate API
  - Cloudflare R2

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

4. Set up the database (after Prisma is configured):

```bash
npx prisma migrate dev
```

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── library/           # Book library page
│   ├── read/              # Reading interface
│   └── layout.tsx         # Root layout
├── components/            # React components
├── lib/                   # Utility functions and modules
│   ├── analyzeContent.ts  # Gemini content analysis
│   ├── generateSoundscape.ts  # Replicate audio generation
│   ├── pdfProcessor.ts    # PDF text extraction
│   ├── storage.ts         # Cloudflare R2 client
│   └── audioPlayer.ts     # Web Audio API wrapper
├── types/                 # TypeScript type definitions
└── prisma/                # Database schema and migrations
```

## Development Roadmap

See `.kiro/specs/immersive-reading-platform/tasks.md` for the complete implementation plan.

### Phase 1: MVP (Current)
- ✅ Project setup
- 🔄 Authentication system
- 🔄 PDF upload and processing
- 🔄 Content analysis with Gemini
- 🔄 Soundscape generation with Replicate
- 🔄 Reading interface with audio playback

### Phase 2: Enhancements
- Page-turning animations
- Improved scene detection
- Soundscape caching
- User preferences and bookmarks

### Phase 3: Monetization
- Subscription tiers with Stripe
- PWA capabilities
- Public domain book library

## Alternative Architecture

If scalability or real-time performance becomes a concern, consider pivoting to **Elixir/Phoenix LiveView** for:
- Superior concurrency with BEAM VM
- Native real-time WebSocket updates
- Robust background job processing with Oban
- Excellent Fly.io deployment support

See design document for details.

## License

MIT

## Contributing

Contributions are welcome! Please read the requirements and design documents in `.kiro/specs/` before submitting PRs.
