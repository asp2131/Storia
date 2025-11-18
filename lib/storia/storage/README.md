# Storia Storage Module

The `Storia.Storage` module provides a clean interface for managing file storage with Supabase Storage.

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=storia-storage
```

### Getting Supabase Credentials

1. Log in to your Supabase dashboard (https://supabase.com/dashboard)
2. Select your project or create a new one
3. Navigate to Project Settings > API
4. Copy the following values:
   - **Project URL** → `SUPABASE_URL`
   - **Anon public key** → `SUPABASE_ANON_KEY`
   - **Service role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)
5. Navigate to Storage and create a bucket named `storia-storage`
6. Set the bucket to public for PDFs, or use signed URLs for private access

## Usage

### Uploading PDFs

```elixir
# Upload a PDF file for a book
{:ok, url} = Storia.Storage.upload_pdf("/path/to/book.pdf", book_id)
# Returns: {:ok, "https://[project].supabase.co/storage/v1/object/public/storia-storage/pdfs/book-123.pdf"}
```

### Uploading Audio Files

```elixir
# Upload curated soundscape
{:ok, url} = Storia.Storage.upload_audio("/path/to/ambient.mp3", scene_id, :curated)
# Returns: {:ok, "https://[project].supabase.co/storage/v1/object/public/storia-storage/audio/curated/scene-123.mp3"}

# Upload AI-generated soundscape
{:ok, url} = Storia.Storage.upload_audio("/path/to/generated.mp3", scene_id, :generated)
# Returns: {:ok, "https://[project].supabase.co/storage/v1/object/public/storia-storage/audio/generated/scene-456.mp3"}
```

### Generating Signed URLs

For secure streaming of audio files:

```elixir
# Generate a signed URL (expires in 1 hour by default)
{:ok, signed_url} = Storia.Storage.generate_signed_url("audio/curated/scene-123.mp3")

# Custom expiry (2 hours)
{:ok, signed_url} = Storia.Storage.generate_signed_url("audio/curated/scene-123.mp3", 7200)
```

### Deleting Files

```elixir
# Delete a file from Supabase Storage
:ok = Storia.Storage.delete_file("pdfs/book-123.pdf")
```

### Extracting Keys from URLs

```elixir
url = "https://[project].supabase.co/storage/v1/object/public/storia-storage/pdfs/book-123.pdf"
key = Storia.Storage.extract_key_from_url(url)
# Returns: "pdfs/book-123.pdf"
```

## File Organization

Files are organized in Supabase Storage with the following structure:

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

## Error Handling

All functions return tuples for easy pattern matching:

```elixir
case Storia.Storage.upload_pdf(file_path, book_id) do
  {:ok, url} -> 
    # Success - use the URL
    IO.puts("Uploaded to: #{url}")
  
  {:error, reason} -> 
    # Handle error
    Logger.error("Upload failed: #{reason}")
end
```

## Testing

### Unit Tests

Run unit tests (no Supabase credentials required):

```bash
mix test test/storia/storage_test.exs --exclude integration
```

### Integration Tests

Integration tests require valid Supabase credentials. Set up your environment variables, then run:

```bash
# Remove the :skip tag from integration tests in storage_test.exs
mix test test/storia/storage_test.exs --only integration
```

## Cost Considerations

### Supabase Storage Pricing

- **Storage**: Included in free tier (1GB), then $0.021/GB per month
- **Bandwidth**: 2GB/month on free tier, then $0.09/GB
- **API Requests**: Unlimited on all plans

### Estimated Costs for MVP

With 20 books × 10MB PDFs + 30 audio files × 5MB:

- Storage: ~0.35GB = **Free** (within 1GB free tier)
- Bandwidth: Depends on usage, likely within free tier for MVP
- **Total: $0/month** (on free tier)

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Use signed URLs** for audio streaming to prevent hotlinking
3. **Rotate API keys** periodically
4. **Set appropriate CORS policies** in Supabase Storage settings
5. **Use different buckets** for dev/staging/production
6. **Use service role key server-side only** - Never expose it to the client

## Troubleshooting

### "Upload failed: HTTP 401" or "Authorization error"

- Ensure environment variables are loaded
- Check that `.env` file exists and is properly formatted
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Make sure you're using the service role key, not the anon key, for uploads

### "Upload failed: HTTP 404" or "Bucket not found"

- Verify `SUPABASE_STORAGE_BUCKET` matches your bucket name in Supabase
- Check that the bucket exists in your Supabase project
- Ensure the bucket is properly configured (public/private settings)

### "Failed to generate signed URL"

- Verify the file exists in Supabase Storage
- Check that the key path is correct
- Ensure you're using the service role key for generating signed URLs
