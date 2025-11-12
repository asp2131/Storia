# Storia Storage Module

The `Storia.Storage` module provides a clean interface for managing file storage with Cloudflare R2 (S3-compatible storage).

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_ACCOUNT_ID=your_r2_account_id
R2_BUCKET_NAME=storia-production
R2_ENDPOINT=your_account_id.r2.cloudflarestorage.com
```

### Getting R2 Credentials

1. Log in to your Cloudflare dashboard
2. Navigate to R2 Object Storage
3. Create a new bucket (e.g., `storia-production`)
4. Generate API tokens with read/write permissions
5. Note your account ID from the R2 dashboard URL

## Usage

### Uploading PDFs

```elixir
# Upload a PDF file for a book
{:ok, url} = Storia.Storage.upload_pdf("/path/to/book.pdf", book_id)
# Returns: {:ok, "https://account.r2.cloudflarestorage.com/storia-dev/pdfs/book-123.pdf"}
```

### Uploading Audio Files

```elixir
# Upload curated soundscape
{:ok, url} = Storia.Storage.upload_audio("/path/to/ambient.mp3", scene_id, :curated)
# Returns: {:ok, "https://account.r2.cloudflarestorage.com/storia-dev/audio/curated/scene-123.mp3"}

# Upload AI-generated soundscape
{:ok, url} = Storia.Storage.upload_audio("/path/to/generated.mp3", scene_id, :generated)
# Returns: {:ok, "https://account.r2.cloudflarestorage.com/storia-dev/audio/generated/scene-456.mp3"}
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
# Delete a file from R2
:ok = Storia.Storage.delete_file("pdfs/book-123.pdf")
```

### Extracting Keys from URLs

```elixir
url = "https://account.r2.cloudflarestorage.com/storia-dev/pdfs/book-123.pdf"
key = Storia.Storage.extract_key_from_url(url)
# Returns: "pdfs/book-123.pdf"
```

## File Organization

Files are organized in R2 with the following structure:

```
storia-bucket/
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

Run unit tests (no R2 credentials required):

```bash
mix test test/storia/storage_test.exs --exclude integration
```

### Integration Tests

Integration tests require valid R2 credentials. Set up your environment variables, then run:

```bash
# Remove the :skip tag from integration tests in storage_test.exs
mix test test/storia/storage_test.exs --only integration
```

## Cost Considerations

### Cloudflare R2 Pricing

- **Storage**: ~$0.015/GB per month
- **Class A Operations** (writes): $4.50 per million requests
- **Class B Operations** (reads): $0.36 per million requests
- **Egress**: **$0** (This is R2's key advantage over S3)

### Estimated Costs for MVP

With 20 books × 10MB PDFs + 30 audio files × 5MB:

- Storage: ~0.35GB × $0.015 = **$0.005/month**
- Operations: Negligible for MVP scale
- **Total: < $0.01/month**

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Use signed URLs** for audio streaming to prevent hotlinking
3. **Rotate API keys** periodically
4. **Set appropriate CORS policies** in R2 dashboard
5. **Use different buckets** for dev/staging/production

## Troubleshooting

### "Required key: :secret_access_key is nil in config!"

- Ensure environment variables are loaded
- Check that `.env` file exists and is properly formatted
- Verify `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are set

### "Upload failed: connection refused"

- Verify `R2_ENDPOINT` is correct
- Check internet connectivity
- Ensure R2 bucket exists and API token has write permissions

### "Failed to generate signed URL"

- Verify the file exists in R2
- Check that the key path is correct
- Ensure API token has read permissions
