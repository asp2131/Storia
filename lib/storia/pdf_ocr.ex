defmodule Storia.PdfOcr do
  @moduledoc """
  Handles OCR extraction for image-based PDF pages using Tesseract.

  Requires system dependencies:
  - poppler-utils (for pdftoppm command)
  - tesseract-ocr (for OCR)

  Install on macOS:
    brew install poppler tesseract
  """

  require Logger

  @doc """
  Extract text from a specific PDF page using OCR.

  ## Parameters
  - `pdf_path`: Path to the PDF file
  - `page_number`: Page number to extract (1-indexed)

  ## Returns
  - `{:ok, text}` on success
  - `{:error, reason}` on failure
  """
  def extract_page_text(pdf_path, page_number) do
    with {:ok, image_path} <- pdf_page_to_image(pdf_path, page_number),
         {:ok, text} <- ocr_image(image_path),
         :ok <- File.rm(image_path) do
      {:ok, text}
    else
      {:error, reason} = error ->
        Logger.error("OCR extraction failed for page #{page_number}: #{inspect(reason)}")
        error
    end
  end

  @doc """
  Extract text from multiple PDF pages using OCR.

  Returns a list of `{page_number, text}` tuples.
  """
  def extract_pages_text(pdf_path, page_numbers) when is_list(page_numbers) do
    page_numbers
    |> Enum.map(fn page_num ->
      case extract_page_text(pdf_path, page_num) do
        {:ok, text} -> {:ok, page_num, text}
        {:error, reason} -> {:error, page_num, reason}
      end
    end)
  end

  @doc """
  Check if required OCR tools are installed.
  """
  def check_dependencies do
    pdftoppm_available = System.find_executable("pdftoppm") != nil
    tesseract_available = System.find_executable("tesseract") != nil

    cond do
      not pdftoppm_available ->
        {:error, :pdftoppm_not_found, "Install with: brew install poppler"}

      not tesseract_available ->
        {:error, :tesseract_not_found, "Install with: brew install tesseract"}

      true ->
        {:ok, :all_dependencies_available}
    end
  end

  # Private functions

  defp pdf_page_to_image(pdf_path, page_number) do
    # Create temp directory for images
    temp_dir = System.tmp_dir!()
    output_prefix = Path.join(temp_dir, "storia_ocr_#{:erlang.unique_integer([:positive])}")

    # pdftoppm uses 1-indexed pages, -f and -l specify first and last page
    # -png outputs PNG format, -r sets DPI (300 is good for OCR)
    args = [
      "-f", "#{page_number}",
      "-l", "#{page_number}",
      "-png",
      "-r", "300",
      pdf_path,
      output_prefix
    ]

    case System.cmd("pdftoppm", args, stderr_to_stdout: true) do
      {_output, 0} ->
        # pdftoppm creates files with zero-padded page numbers: prefix-001.png, prefix-007.png, etc.
        # Try different padding formats
        possible_paths = [
          "#{output_prefix}-#{String.pad_leading("#{page_number}", 3, "0")}.png",  # 001, 007, etc.
          "#{output_prefix}-#{String.pad_leading("#{page_number}", 2, "0")}.png",  # 01, 07, etc.
          "#{output_prefix}-#{page_number}.png"  # Fallback: no padding
        ]

        case Enum.find(possible_paths, &File.exists?/1) do
          nil -> {:error, :image_file_not_created}
          image_path -> {:ok, image_path}
        end

      {error, _exit_code} ->
        {:error, {:pdftoppm_failed, error}}
    end
  rescue
    e ->
      {:error, {:pdftoppm_exception, e}}
  end

  defp ocr_image(image_path) do
    # Use tesseract to extract text from image
    # stdout outputs to stdout instead of file
    args = [image_path, "stdout"]

    case System.cmd("tesseract", args, stderr_to_stdout: true) do
      {text, 0} ->
        # Clean up OCR text (remove extra whitespace, etc.)
        cleaned_text =
          text
          |> String.trim()
          |> String.replace(~r/\n{3,}/, "\n\n")
          |> String.replace(~r/ +/, " ")

        {:ok, cleaned_text}

      {error, _exit_code} ->
        {:error, {:tesseract_failed, error}}
    end
  rescue
    e ->
      {:error, {:tesseract_exception, e}}
  end
end
