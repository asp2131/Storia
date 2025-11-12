# Storia PDF Processor

Node.js script for extracting text content from PDF files.

## Installation

```bash
cd scripts/pdf_processor
npm install
```

## Usage

```bash
node extract.js <path_to_pdf_file>
```

## Output Format

The script outputs JSON with the following structure:

```json
{
  "success": true,
  "total_pages": 150,
  "pages": [
    {
      "page_number": 1,
      "text_content": "Page 1 text content..."
    },
    {
      "page_number": 2,
      "text_content": "Page 2 text content..."
    }
  ],
  "metadata": {
    "title": "Book Title",
    "author": "Author Name",
    "creator": "PDF Creator",
    "producer": "PDF Producer",
    "creation_date": "2024-01-01"
  }
}
```

## Error Handling

If an error occurs, the script outputs:

```json
{
  "success": false,
  "error": "Error message",
  "error_type": "ErrorType",
  "stack": "Error stack trace"
}
```

## Dependencies

- `pdf-parse`: PDF parsing library
- Node.js >= 14.0.0
