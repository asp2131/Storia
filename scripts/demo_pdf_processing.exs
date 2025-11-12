# Demo script for PDF processing pipeline
# Run with: mix run scripts/demo_pdf_processing.exs

alias Storia.{Content, Repo}
alias Storia.Workers.PDFProcessor

IO.puts("\n=== Storia PDF Processing Demo ===\n")

# Step 1: Create a test book
IO.puts("1. Creating a test book...")

{:ok, book} =
  Content.create_book(%{
    title: "The Adventures of Tom Sawyer",
    author: "Mark Twain",
    pdf_url: "test_sample.pdf",
    source_type: "public_domain"
  })

IO.puts("   ✓ Book created with ID: #{book.id}")
IO.puts("   Title: #{book.title}")
IO.puts("   Author: #{book.author}")
IO.puts("   Status: #{book.processing_status}")

# Step 2: Enqueue the PDF processing job
IO.puts("\n2. Enqueueing PDF processing job...")

# Note: In a real scenario, you would have an actual PDF file
# For this demo, we're showing the structure

job_args = %{
  "book_id" => book.id,
  "pdf_path" => "/path/to/actual/pdf/file.pdf"
}

IO.puts("   Job args: #{inspect(job_args)}")
IO.puts("   Note: To actually process a PDF, you need:")
IO.puts("   - A valid PDF file path")
IO.puts("   - Node.js installed")
IO.puts("   - npm packages installed in scripts/pdf_processor")

# Step 3: Show how to enqueue the job (commented out for demo)
IO.puts("\n3. To enqueue the job in production:")
IO.puts("""
   
   %{book_id: book.id, pdf_path: "/path/to/file.pdf"}
   |> Storia.Workers.PDFProcessor.new()
   |> Oban.insert()
""")

# Step 4: Show the processing flow
IO.puts("\n4. Processing flow:")
IO.puts("   a. PDFProcessor worker starts")
IO.puts("   b. Updates book status to 'extracting'")
IO.puts("   c. Calls Node.js extraction script")
IO.puts("   d. Parses JSON output")
IO.puts("   e. Batch inserts pages into database")
IO.puts("   f. Updates book metadata (total_pages, etc.)")
IO.puts("   g. Updates book status to 'analyzing'")
IO.puts("   h. Enqueues SceneAnalyzer job (when implemented)")

# Step 5: Show example of checking results
IO.puts("\n5. After processing, you can check results:")
IO.puts("""
   
   book = Content.get_book_with_pages!(book_id)
   IO.puts("Total pages: \#{book.total_pages}")
   IO.puts("Status: \#{book.processing_status}")
   IO.puts("Pages extracted: \#{length(book.pages)}")
""")

# Clean up
IO.puts("\n6. Cleaning up demo book...")
Content.delete_book(book)
IO.puts("   ✓ Demo book deleted")

IO.puts("\n=== Demo Complete ===\n")
IO.puts("Next steps:")
IO.puts("- Add a real PDF file to test with")
IO.puts("- Run: mix run scripts/demo_pdf_processing.exs")
IO.puts("- Check Oban dashboard for job status")
IO.puts("- Implement SceneAnalyzer worker (Task 6)")
