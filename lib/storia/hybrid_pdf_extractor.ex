defmodule Storia.HybridPdfExtractor do
  @moduledoc """
  Hybrid PDF text extraction that combines direct text extraction with OCR fallback.

  For text-based PDFs: Uses RustReader (fast)
  For image-based PDFs: Falls back to OCR (slower but works)
  """

  alias Storia.PdfOcr
  require Logger

  @min_text_threshold 50

  @doc """
  Extract all pages from a PDF, using OCR for pages with insufficient text.

  ## Parameters
  - `pdf_path`: Path to the PDF file
  - `opts`: Options
    - `:min_text_threshold` - Minimum characters to consider text extraction valid (default: 50)
    - `:use_ocr` - Whether to use OCR fallback (default: true)

  ## Returns
  - `{:ok, pages_data}` with list of page maps containing `page_number` and `text_content`
  - `{:error, reason}` on failure
  """
  def extract_all_pages(pdf_path, opts \\ []) do
    min_threshold = Keyword.get(opts, :min_text_threshold, @min_text_threshold)
    use_ocr = Keyword.get(opts, :use_ocr, true)

    Logger.info("Starting hybrid PDF extraction from #{pdf_path}")

    # Step 1: Try text extraction first (fast)
    case RustReader.extract_pdf(pdf_path) do
      {pages_json, _metadata} when is_list(pages_json) ->
        pages_data = parse_pages_json(pages_json)

        # Step 2: Identify pages with insufficient text
        pages_needing_ocr =
          if use_ocr do
            Enum.filter(pages_data, fn page ->
              String.length(page.text_content) < min_threshold
            end)
          else
            []
          end

        if Enum.empty?(pages_needing_ocr) do
          Logger.info("✓ All pages have sufficient text (#{length(pages_data)} pages)")
          {:ok, pages_data}
        else
          Logger.info(
            "⚠️  #{length(pages_needing_ocr)}/#{length(pages_data)} pages need OCR processing"
          )

          # Check OCR dependencies
          case PdfOcr.check_dependencies() do
            {:ok, _} ->
              # Step 3: Apply OCR to pages with insufficient text
              apply_ocr_to_pages(pdf_path, pages_data, pages_needing_ocr, min_threshold)

            {:error, tool, message} ->
              Logger.warning(
                "OCR not available (#{tool} missing): #{message}. Proceeding with text-only extraction."
              )

              {:ok, pages_data}
          end
        end

      {:error, reason} ->
        {:error, {:text_extraction_failed, reason}}
    end
  end

  @doc """
  Get page count from PDF without extracting all text.
  """
  def get_page_count(pdf_path) do
    case System.cmd("pdfinfo", [pdf_path], stderr_to_stdout: true) do
      {output, 0} ->
        # Parse output for "Pages: N"
        case Regex.run(~r/Pages:\s+(\d+)/, output) do
          [_, page_count] -> {:ok, String.to_integer(page_count)}
          nil -> {:error, :page_count_not_found}
        end

      {_error, _} ->
        # Fallback: count pages from text extraction
        case RustReader.extract_pdf(pdf_path) do
          {pages_json, _} when is_list(pages_json) -> {:ok, length(pages_json)}
          {:error, reason} -> {:error, reason}
        end
    end
  rescue
    _ ->
      # pdfinfo not available, fallback
      case RustReader.extract_pdf(pdf_path) do
        {pages_json, _} when is_list(pages_json) -> {:ok, length(pages_json)}
        {:error, reason} -> {:error, reason}
      end
  end

  # Private functions

  defp parse_pages_json(pages_json) do
    pages_json
    |> Enum.map(fn json_str ->
      page_data = Jason.decode!(json_str)

      %{
        page_number: page_data["page_number"],
        text_content: page_data["text_content"] || ""
      }
    end)
  end

  defp apply_ocr_to_pages(pdf_path, all_pages, pages_needing_ocr, min_threshold) do
    Logger.info("Starting OCR processing for #{length(pages_needing_ocr)} pages...")

    # Process OCR pages with progress tracking
    ocr_results =
      pages_needing_ocr
      |> Enum.with_index(1)
      |> Enum.map(fn {page, idx} ->
        Logger.info(
          "OCR [#{idx}/#{length(pages_needing_ocr)}] Page #{page.page_number}..."
        )

        case PdfOcr.extract_page_text(pdf_path, page.page_number) do
          {:ok, ocr_text} ->
            if String.length(ocr_text) > min_threshold do
              Logger.info("  ✓ OCR extracted #{String.length(ocr_text)} characters")
              {:ok, page.page_number, ocr_text}
            else
              Logger.warning(
                "  ⚠️  OCR only extracted #{String.length(ocr_text)} characters (below threshold)"
              )

              {:ok, page.page_number, ocr_text}
            end

          {:error, reason} ->
            Logger.error("  ✗ OCR failed: #{inspect(reason)}")
            {:error, page.page_number, reason}
        end
      end)

    # Merge OCR results back into pages
    ocr_map =
      ocr_results
      |> Enum.filter(&match?({:ok, _, _}, &1))
      |> Enum.map(fn {:ok, page_num, text} -> {page_num, text} end)
      |> Map.new()

    updated_pages =
      Enum.map(all_pages, fn page ->
        case Map.get(ocr_map, page.page_number) do
          nil -> page
          ocr_text -> %{page | text_content: ocr_text}
        end
      end)

    successful_ocr = Enum.count(ocr_results, &match?({:ok, _, _}, &1))
    Logger.info("✓ OCR completed: #{successful_ocr}/#{length(pages_needing_ocr)} successful")

    {:ok, updated_pages}
  end
end
