#!/usr/bin/env elixir

# Test script for Rust PDF extraction
IO.puts("Testing Rust PDF extraction...")

pdf_path = Path.join([File.cwd!(), "Alice_in_Wonderland.pdf"])

if File.exists?(pdf_path) do
  IO.puts("Found PDF at: #{pdf_path}")

  case RustReader.extract_pdf(pdf_path) do
    {content, metadata} ->
      IO.puts("\n✅ Extraction successful!")
      IO.puts("\nContent preview (first 500 chars):")
      IO.puts(String.slice(content, 0, 500))
      IO.puts("\n\nMetadata:")
      IO.puts(metadata)

    {:error, reason} ->
      IO.puts("\n❌ Extraction failed: #{inspect(reason)}")
  end
else
  IO.puts("❌ PDF not found at: #{pdf_path}")
  IO.puts("Please ensure Alice_in_Wonderland.pdf is in the project root.")
end
