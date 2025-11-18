# Migration Guide: Cloudflare R2 to Supabase

This guide walks you through migrating from Cloudflare R2 and local PostgreSQL to Supabase.

## Overview

The migration includes:
- **Database**: Local PostgreSQL → Supabase PostgreSQL
- **Storage**: Cloudflare R2 → Supabase Storage

## Prerequisites

- Active Supabase account (https://supabase.com)
- Access to your current local PostgreSQL database

## Step 1: Set Up Supabase Project

1. **Create or select a Supabase project**
   - Go to https://supabase.com/dashboard
   - Create a new project or select an existing one
   - Wait for the project to finish provisioning

2. **Get your credentials**
   - Navigate to **Project Settings** → **API**
   - Copy the following values:
     - `Project URL` → This is your `SUPABASE_URL`
     - `anon public` key → This is your `SUPABASE_ANON_KEY`
     - `service_role` key → This is your `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)
   
3. **Get your database connection strings**
   - Navigate to **Project Settings** → **Database**
   - Under "Connection string", select "URI" mode
   - **Important**: You need TWO connection strings:
     - **Transaction mode** (port 6543) → Use for `DATABASE_URL`
     - **Session mode** (port 5432) → Use for `DIRECT_URL`
   - Replace `[YOUR-PASSWORD]` with your actual database password

## Step 2: Create Storage Bucket

1. **Navigate to Storage**
   - In your Supabase dashboard, go to **Storage**
   - Click "Create bucket"
   
2. **Create the bucket**
   - Name: `storia-storage`
   - Public bucket: **Yes** (for public PDFs) or **No** (if you want to use signed URLs only)
   - Click "Create bucket"

3. **Configure bucket policies** (if private bucket)
   - Go to bucket settings
   - Set up RLS (Row Level Security) policies as needed
   - Or keep it public for simplicity

## Step 3: Update Environment Variables

Update your `.env` file with the new Supabase credentials:

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
```

**Important Notes:**
- Replace `[PROJECT_ID]` with your actual Supabase project ID
- Replace `[PASSWORD]` with your database password
- The hostname (`aws-1-ca-central-1`) may vary based on your region
- Transaction mode (6543) uses connection pooling and disables prepared statements
- Session mode (5432) is used for migrations and complex transactions

Remove the old R2 environment variables:
```bash
# Remove these:
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

## Step 4: Migrate Database Schema

1. **Run migrations on Supabase**
   ```bash
   # The DATABASE_URL in your .env now points to Supabase
   mix ecto.migrate
   ```

2. **Migrate existing data** (if you have local data to preserve)
   ```bash
   # Dump your local database
   pg_dump storia_dev > storia_backup.sql
   
   # Import to Supabase (replace with your Supabase connection string)
   psql "postgresql://postgres.[PROJECT_ID]:[PASSWORD]@[HOST]/postgres" < storia_backup.sql
   ```

## Step 5: Migrate Storage Files

If you have existing files in R2 that need to be migrated:

1. **Download from R2**
   - Use the AWS CLI or Cloudflare's wrangler CLI to download all files
   - Or manually download files from R2 dashboard

2. **Upload to Supabase Storage**
   ```elixir
   # Create a migration script
   # scripts/migrate_storage.exs
   
   # For each file in your local backup
   {:ok, url} = Storia.Storage.upload_pdf(local_path, book_id)
   # Or for audio files
   {:ok, url} = Storia.Storage.upload_audio(local_path, scene_id, :curated)
   ```

3. **Update database URLs**
   - Update any stored R2 URLs in your database to point to Supabase Storage URLs
   ```sql
   -- Example SQL to update URLs
   UPDATE books 
   SET pdf_url = REPLACE(pdf_url, 
     'https://account.r2.cloudflarestorage.com/storia-dev/', 
     'https://[PROJECT_ID].supabase.co/storage/v1/object/public/storia-storage/'
   );
   ```

## Step 6: Update Dependencies

The dependencies have been updated:
- ✅ Removed: `ex_aws` and `ex_aws_s3`
- ✅ Using: `HTTPoison` for Supabase Storage API calls
- ✅ Added: `dotenvy` for automatic `.env` file loading

Install dependencies:
```bash
mix deps.get
```

**About dotenvy:**
The application now automatically loads your `.env` file in development and test environments. This means:
- ✅ No need to manually `export` environment variables
- ✅ Just run `mix phx.server` or `mix ecto.migrate` directly
- ✅ Your `.env` file is loaded automatically

## Step 7: Test the Migration

1. **Test storage operations**
   ```bash
   # Start your app
   mix phx.server
   
   # Try uploading a test file through your UI
   # Or test in IEx
   iex -S mix
   Storia.Storage.upload_pdf("test.pdf", "test-id")
   ```

2. **Test database connectivity**
   ```bash
   # Run a simple query
   mix run -e "Storia.Repo.all(Storia.Content.Book) |> IO.inspect()"
   ```

3. **Run your test suite**
   ```bash
   mix test
   ```

## Step 8: Update Production Configuration

If deploying to production (e.g., Fly.io):

1. **Set environment variables in production**
   ```bash
   fly secrets set SUPABASE_URL=https://[PROJECT_ID].supabase.co
   fly secrets set SUPABASE_ANON_KEY=your_anon_key
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   fly secrets set SUPABASE_STORAGE_BUCKET=storia-storage
   fly secrets set DATABASE_URL=postgresql://postgres.[PROJECT_ID]:[PASSWORD]@[HOST]/postgres
   ```

2. **Deploy**
   ```bash
   fly deploy
   ```

## Rollback Plan

If you need to rollback to R2:

1. Keep your R2 credentials backed up
2. Restore the old `mix.exs` dependencies
3. Restore the old configuration files from git history
4. Update environment variables back to R2 credentials

## Benefits of Supabase

- ✅ **Unified platform**: Database + Storage in one place
- ✅ **Free tier**: 1GB storage, 2GB bandwidth/month
- ✅ **Managed backups**: Automated daily backups
- ✅ **Real-time subscriptions**: Built-in if needed in future
- ✅ **Dashboard**: Easy file and database management
- ✅ **No egress fees**: Unlike S3

## Troubleshooting

### Cannot connect to database
- **Verify connection string format**: Ensure you're using the correct format with project ID and hostname
- **Check password**: Make sure you've replaced `[YOUR-PASSWORD]` with your actual database password
- **Verify project is active**: Check that your Supabase project is running in the dashboard
- **Test with psql**: Try connecting directly with `psql "your_connection_string"`
- **Check port numbers**: Transaction mode uses port 6543, session mode uses port 5432

### "Tenant or user not found" error
- **Hostname mismatch**: The hostname in your connection string might be incorrect (check if it's `aws-0` vs `aws-1` or different region)
- **Password reset**: If you recently reset your database password, update the connection string
- **Get fresh connection string**: Go to Supabase dashboard → Database → Connection string and copy the latest one

### Environment variables not loaded
- **Check .env file exists**: Ensure `.env` file is in the project root
- **Verify dotenvy is installed**: Run `mix deps.get` to install all dependencies
- **Check file format**: Make sure there are no syntax errors in your `.env` file
- **No quotes needed**: Environment variables in `.env` don't need quotes (unless the value contains spaces)

### Upload fails with 401 error
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Make sure you're using the service role key, not anon key
- Check that the environment variables are being loaded (try `System.get_env("SUPABASE_SERVICE_ROLE_KEY")` in IEx)

### Bucket not found error
- Verify the bucket name matches `SUPABASE_STORAGE_BUCKET`
- Ensure the bucket exists in your Supabase project
- Check bucket is properly configured (public/private)

### Migrations fail with "prepared statement" error
- This should be fixed with the `prepare: :unnamed` configuration
- If you still see this error, verify `config/dev.exs` and `config/runtime.exs` have `prepare: :unnamed` set
- Make sure you're using transaction mode (port 6543) for `DATABASE_URL`

## Support

For issues:
- Check the [Supabase docs](https://supabase.com/docs)
- Review the updated `lib/storia/storage/README.md`
- Check Supabase dashboard logs for API errors
