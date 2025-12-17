# Quick OCR verification script
# Run with: mix run test_ocr.exs

pdf_path = "wizard_of_oz.pdf"

IO.puts("=== OCR Dependency Check ===")

case Storia.PdfOcr.check_dependencies() do
  {:ok, _} ->
    IO.puts("✓ All OCR dependencies available")

  {:error, tool, message} ->
    IO.puts("✗ Missing dependency: #{tool}")
    IO.puts("  #{message}")
    System.halt(1)
end

IO.puts("\n=== Testing OCR on Page 7 ===")

case Storia.PdfOcr.extract_page_text(pdf_path, 7) do
  {:ok, text} ->
    IO.puts("✓ OCR successful!")
    IO.puts("Text length: #{String.length(text)} characters")
    IO.puts("\nFirst 500 characters:")
    IO.puts(String.slice(text, 0, 500))

  {:error, reason} ->
    IO.puts("✗ OCR failed: #{inspect(reason)}")
    System.halt(1)
end

IO.puts("\n=== Testing Hybrid Extraction (first 3 pages) ===")

case Storia.HybridPdfExtractor.extract_all_pages(pdf_path) do
  {:ok, pages} ->
    IO.puts("✓ Hybrid extraction successful!")
    IO.puts("Total pages: #{length(pages)}")

    pages
    |> Enum.take(3)
    |> Enum.each(fn page ->
      IO.puts("\nPage #{page.page_number}: #{String.length(page.text_content)} chars")
      IO.puts("Preview: #{String.slice(page.text_content, 0, 200)}...")
    end)

  {:error, reason} ->
    IO.puts("✗ Hybrid extraction failed: #{inspect(reason)}")
    System.halt(1)
end

IO.puts("\n✓ All tests passed!")
