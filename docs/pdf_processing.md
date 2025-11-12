# PDF Processing Pipeline

This document describes the PDF processing pipeline implemented in Storia.

## Overview

The PDF processing pipeline extracts text content from PDF files and stores it page-by-page in the database. It uses:

- **Oban**: Background job processing
- **Node.js**: PDF text extraction via `pdf-parse` library
- **Elixir**: Job orchestration and data persistence

## Architecture

```
PDF Upload → PDFProcessor Worker → Node.js Script → Database
                ↓
         SceneAnalyzer Worker (Task 6)
```

## Components

### 1. Oban Configuration

Located in `config/config.exs`:

```elixir
config :storia, Oban,
  repo: Storia.Repo,
  plugins: [Oban.Plugins.Pruner],
  queues: [
    pdf_processing: 2,  # Max 2 concurrent PDF processing jobs
    ai_analysis: 5,
    default: 10
  ]
```

### 2. Node.js Extraction Script

**Location**: `scripts/pdf_processor/extract.js`

**Dependencies**: 
- `pdf-parse`: PDF parsing library

**Installation**:
```bash
cd scripts/pdf_processor
npm install
```

**Usage**:
```bash
node extract.js <path_to_pdf>
```

**Output Format**:
```json
{
  "success": true,
  "total_pages": 150,
  "pages": [
    {
      "page_number": 1,
      "text_content": "Page 1 text..."
    }
  ],
  "metadata": {
    "title": "Book Title",
    "author": "Author Name"
  }
}
```

### 3. PDFProcessor Worker

**Location**: `lib/storia/workers/pdf_processor.ex`

**Queue**: `pdf_processing`

**Max Attempts**: 3

**Job Arguments**:
- `book_id` (required): ID of the book to process
- `pdf_path` (optional): Local path to PDF file (for testing)

**Processing Steps**:

1. Fetch book from database
2. Get PDF path (from args or book.pdf_url)
3. Update book status to "extracting"
4. Call Node.js extraction script via `System.cmd/3`
5. Parse JSON output
6. Batch insert pages into database
7. Update book metadata (total_pages, title, author)
8. Update book status to "analyzing"
9. Enqueue SceneAnalyzer job (when implemented)

**Error Handling**:
- On failure, updates book status to "failed"
- Stores error message in `book.processing_error`
- Retries up to 3 times with exponential backoff

### 4. Content Context

**Location**: `lib/storia/content.ex`

**Key Functions**:

- `create_book/1`: Create a new book
- `update_book/2`: Update book attributes
- `update_book_status/3`: Update processing status
- `create_pages_batch/2`: Batch insert pages
- `list_pages_for_book/1`: Get all pages for a book
- `get_book_with_pages!/1`: Get book with preloaded pages

## Usage

### Enqueue a PDF Processing Job

```elixir
# Create a book
{:ok, book} = Storia.Content.create_book(%{
  title: "My Book",
  author: "Author Name",
  pdf_url: "/path/to/file.pdf"
})

# Enqueue processing job
%{book_id: book.id}
|> Storia.Workers.PDFProcessor.new()
|> Oban.insert()
```

### Check Processing Status

```elixir
book = Storia.Content.get_book!(book_id)
IO.inspect(book.processing_status)  # "pending", "extracting", "analyzing", etc.
IO.inspect(book.total_pages)
IO.inspect(book.processing_error)  # nil if successful
```

### View Extracted Pages

```elixir
book = Storia.Content.get_book_with_pages!(book_id)
Enum.each(book.pages, fn page ->
  IO.puts("Page #{page.page_number}: #{String.slice(page.text_content, 0, 100)}...")
end)
```

## Testing

### Unit Tests

```bash
# Test Content context
mix test test/storia/content_test.exs

# Test PDFProcessor worker
mix test test/storia/workers/pdf_processor_test.exs
```

### Integration Test

```bash
# Run demo script
mix run scripts/demo_pdf_processing.exs
```

### Manual Testing with Real PDF

1. Download a public domain PDF (e.g., from Project Gutenberg)
2. Create a book and enqueue job:

```elixir
{:ok, book} = Storia.Content.create_book(%{
  title: "Test Book",
  author: "Test Author",
  pdf_url: "/path/to/downloaded.pdf"
})

%{book_id: book.id}
|> Storia.Workers.PDFProcessor.new()
|> Oban.insert()
```

3. Monitor job in Oban dashboard or check book status

## Book Processing States

- `pending`: Initial state, not yet processed
- `extracting`: PDF text extraction in progress
- `analyzing`: AI scene classification in progress (Task 6)
- `mapping`: Soundscape mapping in progress (Task 7)
- `ready_for_review`: Processing complete, awaiting admin review
- `published`: Approved and available to users
- `failed`: Processing failed, check `processing_error` field

## Performance Considerations

- **Concurrency**: Limited to 2 concurrent PDF processing jobs to avoid overwhelming the system
- **Batch Inserts**: Pages are inserted in a single batch operation for efficiency
- **Memory**: Large PDFs may require significant memory for the Node.js process
- **Timeouts**: Default Oban timeout applies (15 minutes)

## Future Improvements

1. **R2 Integration**: Download PDFs from Cloudflare R2 instead of using local paths
2. **Better Page Splitting**: Use pdf.js directly for more accurate page boundaries
3. **Progress Tracking**: Real-time progress updates during extraction
4. **Cleanup**: Delete temporary files after processing
5. **Validation**: Verify PDF integrity before processing
6. **Metrics**: Track processing time and success rates

## Troubleshooting

### "PDF file not found" Error

- Ensure the PDF file exists at the specified path
- Check file permissions
- Verify the path is absolute, not relative

### "Extraction failed" Error

- Check Node.js is installed: `node --version`
- Verify npm packages are installed: `cd scripts/pdf_processor && npm install`
- Test extraction script manually: `node scripts/pdf_processor/extract.js /path/to/file.pdf`
- Check PDF is not corrupted

### "No pages inserted" Error

- Verify the PDF contains extractable text (not scanned images)
- Check the extraction script output for errors
- Ensure the JSON output format is correct

## Related Tasks

- **Task 5.1**: ✅ Set up Oban for background jobs
- **Task 5.2**: ✅ Create Node.js PDF extraction script
- **Task 5.3**: ✅ Implement PDFProcessor Oban worker
- **Task 5.4**: ✅ Test PDF processing pipeline
- **Task 6**: 🔜 Implement AI scene classification (next)
- **Task 7**: 🔜 Build soundscape mapping system
