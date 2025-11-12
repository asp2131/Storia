defmodule Storia.Workers.PDFProcessor do
  @moduledoc """
  Oban worker for processing PDF files and extracting text content.

  This worker:
  1. Downloads the PDF from R2 storage (or uses local path)
  2. Calls the Node.js extraction script
  3. Parses the JSON output
  4. Batch inserts pages into the database
  5. Updates book processing status
  6. Enqueues the SceneAnalyzer job on success
  """

  use Oban.Worker,
    queue: :pdf_processing,
    max_attempts: 3

  require Logger

  alias Storia.{Content, Repo}
  alias Storia.Content.Book

  @doc """
  Perform the PDF processing job.

  ## Job args
  - `book_id`: The ID of the book to process
  - `pdf_path`: Optional local path to PDF (for testing)
  """
  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"book_id" => book_id} = args}) do
    Logger.info("Starting PDF processing for book_id: #{book_id}")

    with {:ok, book} <- fetch_book(book_id),
         {:ok, pdf_path} <- get_pdf_path(book, args),
         :ok <- Content.update_book_status(book_id, "extracting"),
         {:ok, extraction_result} <- extract_pdf_text(pdf_path),
         {:ok, _pages} <- save_pages(book_id, extraction_result),
         :ok <- update_book_metadata(book, extraction_result),
         :ok <- Content.update_book_status(book_id, "analyzing"),
         {:ok, _job} <- enqueue_scene_analyzer(book_id) do
      Logger.info("Successfully processed PDF for book_id: #{book_id}")
      :ok
    else
      {:error, reason} = error ->
        Logger.error("Failed to process PDF for book_id: #{book_id}, reason: #{inspect(reason)}")
        Content.update_book_status(book_id, "failed", format_error(reason))
        error
    end
  end

  # Fetch the book from database
  defp fetch_book(book_id) do
    case Repo.get(Book, book_id) do
      nil -> {:error, :book_not_found}
      book -> {:ok, book}
    end
  end

  # Get the PDF path (either from args or download from R2)
  defp get_pdf_path(_book, %{"pdf_path" => pdf_path}) when is_binary(pdf_path) do
    if File.exists?(pdf_path) do
      {:ok, pdf_path}
    else
      {:error, :pdf_file_not_found}
    end
  end

  defp get_pdf_path(%Book{pdf_url: pdf_url}, _args) when is_binary(pdf_url) do
    # For now, assume pdf_url is a local path or R2 key
    # In production, you'd download from R2 using Storia.Storage
    # For MVP, we'll support local paths
    if File.exists?(pdf_url) do
      {:ok, pdf_url}
    else
      {:error, :pdf_url_invalid}
    end
  end

  defp get_pdf_path(_book, _args) do
    {:error, :no_pdf_path}
  end

  # Extract text from PDF using Node.js script
  defp extract_pdf_text(pdf_path) do
    script_path = get_script_path()

    case System.cmd("node", [script_path, pdf_path], stderr_to_stdout: true) do
      {output, 0} ->
        parse_extraction_output(output)

      {output, exit_code} ->
        Logger.error("PDF extraction failed with exit code #{exit_code}: #{output}")
        {:error, {:extraction_failed, output}}
    end
  end

  # Get the path to the extraction script
  defp get_script_path do
    Path.join([
      Application.app_dir(:storia),
      "..",
      "..",
      "scripts",
      "pdf_processor",
      "extract.js"
    ])
    |> Path.expand()
  end

  # Parse the JSON output from the extraction script
  defp parse_extraction_output(output) do
    case Jason.decode(output) do
      {:ok, %{"success" => true} = result} ->
        {:ok, result}

      {:ok, %{"success" => false, "error" => error}} ->
        {:error, {:extraction_error, error}}

      {:error, reason} ->
        Logger.error("Failed to parse extraction output: #{inspect(reason)}")
        Logger.error("Output was: #{output}")
        {:error, {:json_parse_error, reason}}
    end
  end

  # Save pages to database in batch
  defp save_pages(book_id, %{"pages" => pages}) when is_list(pages) do
    pages_data =
      Enum.map(pages, fn page ->
        %{
          page_number: page["page_number"],
          text_content: page["text_content"]
        }
      end)

    case Content.create_pages_batch(book_id, pages_data) do
      {count, _} when count > 0 ->
        Logger.info("Inserted #{count} pages for book_id: #{book_id}")
        {:ok, count}

      {0, _} ->
        {:error, :no_pages_inserted}
    end
  end

  defp save_pages(_book_id, _result) do
    {:error, :invalid_pages_data}
  end

  # Update book metadata from extraction result
  defp update_book_metadata(book, %{"total_pages" => total_pages, "metadata" => metadata}) do
    attrs = %{
      total_pages: total_pages
    }

    # Update title and author if they're in metadata and not already set
    attrs =
      if is_nil(book.title) and metadata["title"] do
        Map.put(attrs, :title, metadata["title"])
      else
        attrs
      end

    attrs =
      if is_nil(book.author) and metadata["author"] do
        Map.put(attrs, :author, metadata["author"])
      else
        attrs
      end

    case Content.update_book(book, attrs) do
      {:ok, _book} -> :ok
      {:error, changeset} -> {:error, {:update_failed, changeset}}
    end
  end

  defp update_book_metadata(_book, _result) do
    {:error, :invalid_metadata}
  end

  # Enqueue the SceneAnalyzer job
  defp enqueue_scene_analyzer(book_id) do
    # This will be implemented when we create the SceneAnalyzer worker
    # For now, just return ok
    Logger.info("Would enqueue SceneAnalyzer for book_id: #{book_id}")
    {:ok, nil}

    # When SceneAnalyzer is implemented:
    # %{book_id: book_id}
    # |> Storia.Workers.SceneAnalyzer.new()
    # |> Oban.insert()
  end

  # Format error for storage
  defp format_error({:extraction_failed, output}), do: "Extraction failed: #{output}"
  defp format_error({:extraction_error, error}), do: "Extraction error: #{error}"
  defp format_error({:json_parse_error, reason}), do: "JSON parse error: #{inspect(reason)}"
  defp format_error(:book_not_found), do: "Book not found"
  defp format_error(:pdf_file_not_found), do: "PDF file not found"
  defp format_error(:pdf_url_invalid), do: "PDF URL is invalid"
  defp format_error(:no_pdf_path), do: "No PDF path provided"
  defp format_error(:no_pages_inserted), do: "No pages were inserted"
  defp format_error(:invalid_pages_data), do: "Invalid pages data"
  defp format_error(:invalid_metadata), do: "Invalid metadata"
  defp format_error({:update_failed, changeset}), do: "Update failed: #{inspect(changeset.errors)}"
  defp format_error(reason), do: inspect(reason)
end
