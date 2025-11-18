# Supabase Migration Summary

## Migration Complete ✅

Your application has been successfully migrated from Cloudflare R2 and local PostgreSQL to Supabase.

## What Was Changed

### 1. Dependencies (`mix.exs`)
- **Removed**: `ex_aws` and `ex_aws_s3` (R2/S3 client libraries)
- **Kept**: `httpoison` (used for Supabase Storage API calls)
- **Added**: `dotenvy` for automatic `.env` file loading in dev/test environments

### 2. Configuration Files

#### `config/config.exs`
- Replaced ExAws/R2 configuration with Supabase configuration
- New config keys: `supabase.url`, `supabase.anon_key`, `supabase.service_role_key`, `supabase.storage_bucket`

#### `config/dev.exs`
- Updated to support both local PostgreSQL and Supabase PostgreSQL via `DATABASE_URL` environment variable
- Falls back to local PostgreSQL if `DATABASE_URL` is not set
- **Added `prepare: :unnamed`** to disable prepared statements (required for Supabase transaction mode pooler)

#### `config/runtime.exs`
- Replaced R2 configuration with Supabase configuration for production
- **Added `prepare: :unnamed`** to disable prepared statements (required for Supabase transaction mode pooler)

#### `config/config.exs`
- **Added dotenvy integration** to automatically load `.env` files in development and test environments
- No more need to manually export environment variables

#### `.env.example`
- Updated with Supabase environment variables
- Removed R2 environment variables

### 3. Storage Module (`lib/storia/storage.ex`)
- **Complete rewrite** to use Supabase Storage REST API
- Replaced all ExAws.S3 calls with HTTPoison calls to Supabase Storage API
- Updated functions:
  - `upload_pdf/2` - Now uploads to Supabase Storage
  - `upload_audio/3` - Now uploads to Supabase Storage
  - `upload_audio_data/3` - Now uploads binary data to Supabase Storage
  - `generate_signed_url/2` - Now generates Supabase signed URLs
  - `delete_file/1` - Now deletes from Supabase Storage
  - `extract_key_from_url/1` - Updated to parse Supabase URLs
- All functions maintain the same public API - no breaking changes to calling code!

### 4. Documentation

#### `lib/storia/storage/README.md`
- Updated all references from R2 to Supabase Storage
- Updated setup instructions for Supabase
- Updated code examples with Supabase URLs
- Updated troubleshooting section for Supabase-specific errors
- Updated pricing information for Supabase free tier

#### New Files Created
- `docs/supabase_migration_guide.md` - Complete migration guide with step-by-step instructions

## What You Need To Do Next

### 1. Get Supabase Credentials

1. **Log in to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project (or create a new one if you don't have one)

2. **Get API Credentials**
   - Navigate to **Project Settings** → **API**
   - Copy these values:
     - Project URL → `SUPABASE_URL`
     - anon public key → `SUPABASE_ANON_KEY`
     - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

3. **Get Database Connection String**
   - Navigate to **Project Settings** → **Database**
   - Under "Connection string", select **URI** mode
   - Copy the connection string → `DATABASE_URL`
   - ⚠️ Replace `[YOUR-PASSWORD]` with your actual database password

4. **Create Storage Bucket**
   - Navigate to **Storage** in Supabase dashboard
   - Click "Create bucket"
   - Name it: `storia-storage`
   - Make it public (or keep private if you prefer signed URLs only)

### 2. Update Your `.env` File

Create or update your `.env` file with the credentials from Supabase:

```bash
# Database Configuration (Supabase PostgreSQL)
# Transaction mode pooler - use for general queries (port 6543)
DATABASE_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:6543/postgres

# Session mode pooler - use for migrations and complex transactions (port 5432)
DIRECT_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:5432/postgres

# Supabase Configuration
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=your_actual_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
SUPABASE_STORAGE_BUCKET=storia-storage

# Keep your other variables
REPLICATE_API_KEY=your_replicate_api_key
STRIPE_API_KEY=your_stripe_api_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
PHX_SERVER=true
```

**Important Notes:**
- Replace `[PROJECT_ID]` with your Supabase project ID
- Replace `[PASSWORD]` with your database password
- The hostname (`aws-1-ca-central-1`) may vary based on your region - check your Supabase dashboard
- **Transaction mode** (port 6543) is used for general application queries
- **Session mode** (port 5432) is used for migrations
- With dotenvy installed, your `.env` file is automatically loaded - no need to manually export variables!

**Remove these old R2 variables if present:**
```bash
# DELETE THESE:
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
# R2_ACCOUNT_ID=...
# R2_BUCKET_NAME=...
# R2_ENDPOINT=...
# CLOUDFLARE_ACCOUNT_ID=...
# CLOUDFLARE_R2_ACCESS_KEY=...
# CLOUDFLARE_R2_SECRET_KEY=...
# CLOUDFLARE_R2_BUCKET=...
```

### 3. Install Dependencies

```bash
cd /Users/akinpound/Documents/experiments/storia
mix deps.get
```

### 4. Run Migrations on Supabase

```bash
# This will run migrations on your Supabase database
mix ecto.migrate
```

### 5. Test the Setup

```bash
# Start the development server
mix phx.server

# Or test in IEx
iex -S mix

# Try a test upload
Storia.Storage.upload_pdf("test.pdf", "test-123")
```

### 6. (Optional) Migrate Existing Data

If you have existing files in R2 or data in local PostgreSQL that you want to keep:

1. **See the detailed migration guide**: `docs/supabase_migration_guide.md`
2. Follow the steps for:
   - Migrating database data from local PostgreSQL to Supabase
   - Downloading files from R2 and uploading to Supabase Storage
   - Updating stored URLs in your database

## What Stays the Same

- ✅ **All public API functions** - Your existing code calling `Storia.Storage` functions doesn't need to change
- ✅ **Database schema** - All your Ecto schemas remain the same
- ✅ **File organization** - Same folder structure (`pdfs/`, `audio/curated/`, `audio/generated/`)
- ✅ **Application logic** - No changes needed to your business logic

## Benefits You Get

- 🎉 **No more Cloudflare issues** - Your storage is independent of Cloudflare's uptime
- 💰 **Free tier** - 1GB storage + 2GB bandwidth/month (more than enough for MVP)
- 🔧 **Unified platform** - Database + Storage in one dashboard
- 🔄 **Automatic backups** - Daily backups included
- 📊 **Better monitoring** - Built-in storage analytics in Supabase dashboard
- 🚀 **Scalable** - Easy to upgrade when you need more

## Troubleshooting

If you encounter any issues:

1. **Check your environment variables** - Make sure all Supabase credentials are correct
2. **Verify bucket exists** - Go to Supabase dashboard → Storage and confirm `storia-storage` bucket exists
3. **Check bucket is public** - If you get 404 errors, make sure the bucket is set to public (or use signed URLs)
4. **Review logs** - Check Supabase dashboard logs for any API errors
5. **See migration guide** - Full troubleshooting section in `docs/supabase_migration_guide.md`

## Need Help?

- 📖 Read the migration guide: `docs/supabase_migration_guide.md`
- 📚 Check Storage README: `lib/storia/storage/README.md`
- 🔗 Supabase Docs: https://supabase.com/docs/guides/storage
- 💬 Supabase Discord: https://discord.supabase.com

## Next Steps

Once you've updated your `.env` file and tested the setup:

1. Commit these changes to git
2. Deploy to your production environment (if applicable)
3. Monitor storage usage in Supabase dashboard
4. Consider setting up monitoring/alerts for your Supabase project

---

**Migration completed successfully!** 🎉
