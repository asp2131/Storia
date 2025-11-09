# Storage Module - Cloudflare R2

This module provides functions for interacting with Cloudflare R2 storage (S3-compatible).

## Configuration

Required environment variables:

```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY=your-access-key
CLOUDFLARE_R2_SECRET_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET=immersive-reading-audio
CLOUDFLARE_R2_PUBLIC_DOMAIN=your-domain.com
```

**Note:** The application will build successfully even without valid R2 credentials. The storage functions will only be called at runtime when users upload files or generate soundscapes.

## Storage Structure

```
bucket/
├── books/
│   └── {bookId}.pdf
└── soundscapes/
    └── {sceneId}.wav
```

## Functions

### `uploadPDFToR2(pdfBuffer: Buffer, bookId: string): Promise<string>`

Uploads a PDF file to R2 storage.

**Parameters:**
- `pdfBuffer` - The PDF file as a Buffer
- `bookId` - Unique book identifier

**Returns:** Public URL of the uploaded PDF

**Example:**
```typescript
const pdfUrl = await uploadPDFToR2(buffer, "book-123");
// Returns: https://your-domain.com/books/book-123.pdf
```

### `uploadToR2(sourceUrl: string, sceneId: string): Promise<string>`

Downloads an audio file from a URL and uploads it to R2 storage.

**Parameters:**
- `sourceUrl` - URL of the audio file (e.g., from Replicate)
- `sceneId` - Unique scene identifier

**Returns:** Public URL of the uploaded audio file

**Example:**
```typescript
const audioUrl = await uploadToR2(replicateUrl, "scene-456");
// Returns: https://your-domain.com/soundscapes/scene-456.wav
```

### `uploadBufferToR2(buffer: Buffer, key: string, contentType: string): Promise<string>`

Uploads any buffer directly to R2 storage.

**Parameters:**
- `buffer` - The file buffer
- `key` - Storage key/path (e.g., "images/cover.jpg")
- `contentType` - MIME type (e.g., "image/jpeg")

**Returns:** Public URL of the uploaded file

### `deleteFromR2(key: string): Promise<void>`

Deletes a file from R2 storage.

**Parameters:**
- `key` - Storage key/path of the file to delete

**Example:**
```typescript
await deleteFromR2("books/book-123.pdf");
```

### `getFromR2(key: string): Promise<Buffer>`

Retrieves a file from R2 storage.

**Parameters:**
- `key` - Storage key/path of the file

**Returns:** File buffer

### `isR2Configured(): boolean`

Checks if R2 storage is properly configured.

**Returns:** `true` if all required environment variables are set

### `getPublicUrl(key: string): string`

Generates the public URL for a stored file.

**Parameters:**
- `key` - Storage key/path

**Returns:** Public URL

## Error Handling

All functions include:
- Automatic retry with exponential backoff (3 attempts)
- Detailed error logging
- Custom `StorageError` exceptions

## Testing

Test the R2 configuration:

```bash
curl http://localhost:3000/api/storage/test
```

Expected response:
```json
{
  "status": "ok",
  "message": "R2 storage is properly configured and working",
  "testUploadUrl": "https://your-domain.com/test/test-1234567890.txt",
  "config": {
    "bucket": "immersive-reading-audio",
    "publicDomain": "your-domain.com"
  }
}
```

## Setting Up Cloudflare R2

1. **Create R2 Bucket:**
   - Go to Cloudflare Dashboard → R2
   - Create a new bucket (e.g., "immersive-reading-audio")
   - Enable public access if needed

2. **Generate API Tokens:**
   - Go to R2 → Manage R2 API Tokens
   - Create a new API token with read/write permissions
   - Save the Access Key ID and Secret Access Key

3. **Configure Custom Domain (Optional):**
   - Go to your bucket settings
   - Add a custom domain for public access
   - Update DNS records as instructed

4. **Update Environment Variables:**
   - Add all credentials to `.env` file
   - Restart the development server

## Cost Considerations

Cloudflare R2 pricing (as of 2024):
- Storage: $0.015/GB per month
- Class A operations (writes): $4.50 per million
- Class B operations (reads): $0.36 per million
- No egress fees (free bandwidth)

Estimated costs for this project:
- 300-page book PDF: ~5MB = $0.000075/month storage
- 50 soundscapes @ 30s each: ~50MB = $0.00075/month storage
- Upload operations: negligible
- **Total per book: ~$0.001/month**

## Security Best Practices

1. Never commit `.env` file to version control
2. Use separate buckets for development and production
3. Implement signed URLs for sensitive content
4. Set appropriate CORS policies
5. Enable versioning for important files
6. Regularly rotate API credentials
