# Storia

An immersive audiobook platform that enhances reading with AI-generated ambient soundscapes.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Development](#development)
- [Deployment](#deployment)
- [Documentation](#documentation)

## Overview

Storia transforms traditional ebooks into immersive audiovisual experiences by:
- Processing PDF books and extracting structured content
- Analyzing scenes and generating contextual ambient soundscapes
- Providing a beautiful reading interface with synchronized audio
- Supporting multiple subscription tiers with different feature access

## Prerequisites

- **Elixir** 1.14+ and **Erlang/OTP** 25+
- **PostgreSQL** (or Supabase account for cloud database)
- **Node.js** 18+ (for asset compilation)
- **Supabase Account** (for database and file storage)
- **Replicate API Key** (for AI audio generation)

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd storia
mix deps.get
cd assets && npm install && cd ..
```

### 2. Set Up Supabase

1. **Create a Supabase project** at https://supabase.com/dashboard
2. **Get your credentials**:
   - Navigate to **Project Settings** → **API**
   - Copy: `Project URL`, `anon public key`, `service_role key`
3. **Get database connection strings**:
   - Navigate to **Project Settings** → **Database**
   - Click **Connection string** → **URI**
   - Copy both **Transaction mode** and **Session mode** connection strings
   - Replace `[YOUR-PASSWORD]` with your actual database password
4. **Create storage bucket**:
   - Navigate to **Storage** → **New bucket**
   - Name: `storia-storage`
   - Make it **public**

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration (Supabase PostgreSQL)
# Transaction mode pooler - use for general queries (port 6543)
DATABASE_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:6543/postgres

# Session mode pooler - use for migrations and complex transactions (port 5432)
DIRECT_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:5432/postgres

# Supabase Configuration
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=storia-storage

# Phoenix Configuration
SECRET_KEY_BASE=generate_with_mix_phx_gen_secret
PHX_HOST=localhost
PORT=4000
PHX_SERVER=true

# Replicate API Configuration (for AI audio generation)
REPLICATE_API_KEY=your_replicate_api_key

# Stripe Configuration (optional - for payments)
STRIPE_API_KEY=your_stripe_api_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

**Generate a secret key base:**
```bash
mix phx.gen.secret
```

### 4. Set Up Database

```bash
# Run migrations
mix ecto.migrate

# Seed test users and data
mix run priv/repo/seeds.exs
```

### 5. Start the Server

```bash
mix phx.server
```

Visit http://localhost:4000 in your browser.

### 6. Test Login

The seed script creates test accounts:
- **Admin**: `admin@storia.app` / `Admin123!`
- **Free tier**: `free@storia.app` / `FreeUser123!`
- **Reader tier**: `reader@storia.app` / `Reader123!`
- **Bibliophile**: `bibliophile@storia.app` / `Bibliophile123!`

## Configuration

### Database Connection

Storia uses **two connection modes** for Supabase PostgreSQL:

1. **Transaction Mode** (port 6543) - `DATABASE_URL`
   - Used for general application queries
   - Connection pooling optimized for serverless/short-lived connections
   - **Important**: Prepared statements are disabled (`prepare: :unnamed`)

2. **Session Mode** (port 5432) - `DIRECT_URL`
   - Used for migrations and long-running transactions
   - Direct connection to the database

### Environment Loading

The application uses **dotenvy** to automatically load `.env` files in development and test environments. This means:
- ✅ No need to manually export environment variables
- ✅ `.env` file is automatically loaded when running `mix` commands
- ✅ Works seamlessly with `mix phx.server`, `mix ecto.migrate`, etc.

### Storage Architecture

Files are organized in Supabase Storage:

```
storia-storage/ (bucket)
├── pdfs/
│   └── {book_id}.pdf
└── audio/
    ├── curated/
    │   └── {scene_id}.mp3
    └── generated/
        └── {scene_id}.mp3
```

See [`lib/storia/storage/README.md`](lib/storia/storage/README.md) for detailed storage API documentation.

## Architecture

### Core Components

- **Phoenix LiveView** - Real-time UI without JavaScript complexity
- **Ecto** - Database wrapper and query interface
- **Oban** - Background job processing for PDF analysis and AI generation
- **Supabase** - PostgreSQL database and file storage
- **Replicate** - AI audio generation API

### Key Modules

- `Storia.Content` - Book, page, scene management
- `Storia.Accounts` - User authentication and authorization
- `Storia.Storage` - File upload/download with Supabase
- `Storia.AI.Workers` - Background jobs for PDF processing and audio generation
- `StoriaWeb.LiveViews` - User-facing reading and admin interfaces

### Processing Pipeline

1. **Upload** - Admin uploads PDF via web interface
2. **Extract** - PDF is parsed into pages and text content
3. **Analyze** - AI analyzes text to identify scenes and classify content
4. **Generate** - AI generates ambient soundscapes for each scene
5. **Review** - Admin reviews and adjusts soundscapes
6. **Publish** - Book becomes available to users

## Development

### Common Commands

```bash
# Install dependencies
mix deps.get

# Run database migrations
mix ecto.migrate

# Reset database
mix ecto.reset

# Run tests
mix test

# Start server
mix phx.server

# Start server with IEx console
iex -S mix phx.server

# Check migration status
mix ecto.migrations

# Seed database
mix run priv/repo/seeds.exs
```

### Database Management

```bash
# Create a new migration
mix ecto.gen.migration migration_name

# Rollback last migration
mix ecto.rollback

# Rollback multiple steps
mix ecto.rollback --step 3
```

### Background Jobs

Storia uses Oban for background processing. Monitor jobs in IEx:

```elixir
# Start IEx
iex -S mix

# Check pending jobs
Storia.Repo.all(Oban.Job) |> length()

# View job details
import Ecto.Query
Storia.Repo.all(from j in Oban.Job, select: {j.worker, j.state})

# Cancel all pending jobs
Oban.cancel_all_jobs(Storia.Repo)
```

### Testing

```bash
# Run all tests
mix test

# Run specific test file
mix test test/storia/storage_test.exs

# Run with coverage
mix test --cover

# Run tests matching a pattern
mix test --only integration
```

## Deployment

Storia is configured for deployment on Fly.io. See [`docs/deployment.md`](docs/deployment.md) for detailed instructions.

### Quick Deploy

```bash
# Install Fly CLI
brew install flyctl  # macOS
# or visit: https://fly.io/docs/hands-on/install-flyctl/

# Login to Fly
fly auth login

# Launch app (first time)
fly launch

# Set secrets
fly secrets set DATABASE_URL=your_database_url
fly secrets set SUPABASE_URL=your_supabase_url
fly secrets set SUPABASE_ANON_KEY=your_anon_key
fly secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
fly secrets set REPLICATE_API_KEY=your_replicate_key
fly secrets set SECRET_KEY_BASE=$(mix phx.gen.secret)

# Deploy
fly deploy
```

## Documentation

- [**Quick Start: Seeding Content**](SEEDING_QUICKSTART.md) - Getting started with uploading books
- [**Supabase Migration Guide**](docs/supabase_migration_guide.md) - Detailed Supabase setup
- [**Storage Module**](lib/storia/storage/README.md) - File storage API documentation
- [**Content Seeding Guide**](docs/seeding_content_library.md) - Comprehensive guide to building your library
- [**Migration Summary**](MIGRATION_SUMMARY.md) - Recent architecture changes

## Learn More

- **Phoenix Framework**: https://www.phoenixframework.org/
- **Phoenix Guides**: https://hexdocs.pm/phoenix/overview.html
- **Supabase Docs**: https://supabase.com/docs
- **Oban Documentation**: https://hexdocs.pm/oban/Oban.html

## Support

For issues and questions:
- Check existing documentation in `/docs`
- Review troubleshooting sections in relevant READMEs
- Open an issue on GitHub

---

Built with Phoenix, LiveView, and Supabase. Licensed under MIT.
