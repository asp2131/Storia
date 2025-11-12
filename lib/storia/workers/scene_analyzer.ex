defmodule Storia.Workers.SceneAnalyzer do
  @moduledoc """
  Oban worker for analyzing book pages and creating scenes with AI classification.

  This worker:
  1. Fetches all pages for a book
  2. Classifies each page using Gemini Flash
  3. Detects scene boundaries based on descriptor similarity
  4. Creates scene records with aggregated descriptors
  5. Updates book processing status
  6. Enqueues SoundscapeGenerator job on success
  """

  use Oban.Worker,
    queue: :ai_analysis,
    max_attempts: 3

  require Logger

  alias Storia.{Content, Repo}
  alias Storia.AI.SceneClassifier
  alias Storia.Content.Book

  @doc """
  Perform the scene analysis job.

  ## Job args
  - `book_id`: The ID of the book to analyze
  """
  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"book_id" => book_id}}) do
    Logger.info("Starting scene analysis for book_id: #{book_id}")

    with {:ok, book} <- fetch_book(book_id),
         {:ok, pages} <- fetch_pages(book_id),
         :ok <- validate_pages(pages),
         :ok <- Content.update_book_status(book_id, "analyzing"),
         {:ok, pages_with_descriptors} <- classify_all_pages(pages),
         {:ok, boundaries} <- detect_boundaries(pages_with_descriptors),
         {:ok, scenes} <- create_scenes(book_id, pages_with_descriptors, boundaries),
         :ok <- update_book_with_cost(book, pages_with_descriptors),
         :ok <- Content.update_book_status(book_id, "mapping"),
         {:ok, _job} <- enqueue_soundscape_generator(book_id) do
      Logger.info("Successfully analyzed scenes for book_id: #{book_id}, created #{length(scenes)} scenes")
      :ok
    else
      {:error, reason} = error ->
        Logger.error("Failed to analyze scenes for book_id: #{book_id}, reason: #{inspect(reason)}")
        Content.update_book_status(book_id, "failed", format_error(reason))
        error
    end
  end

  # Private functions

  defp fetch_book(book_id) do
    case Repo.get(Book, book_id) do
      nil -> {:error, :book_not_found}
      book -> {:ok, book}
    end
  end

  defp fetch_pages(book_id) do
    pages = Content.list_pages_for_book(book_id)
    {:ok, pages}
  end

  defp validate_pages([]), do: {:error, :no_pages_found}
  defp validate_pages(_pages), do: :ok

  defp classify_all_pages(pages) do
    Logger.info("Classifying #{length(pages)} pages...")

    results =
      pages
      |> Enum.with_index(1)
      |> Enum.map(fn {page, idx} ->
        Logger.debug("Classifying page #{idx}/#{length(pages)}")

        case classify_page_with_retry(page) do
          {:ok, descriptors} ->
            {:ok, %{page_number: page.page_number, descriptors: descriptors}}

          {:error, reason} ->
            Logger.warning("Failed to classify page #{page.page_number}: #{inspect(reason)}")
            # Use default descriptors for failed classifications
            {:ok,
             %{
               page_number: page.page_number,
               descriptors: default_descriptors()
             }}
        end
      end)

    # Check if all classifications succeeded (or used defaults)
    case Enum.all?(results, &match?({:ok, _}, &1)) do
      true ->
        pages_with_descriptors = Enum.map(results, fn {:ok, data} -> data end)
        {:ok, pages_with_descriptors}

      false ->
        {:error, :classification_failed}
    end
  end

  defp classify_page_with_retry(page, attempt \\ 1) do
    case SceneClassifier.classify_page(page.text_content) do
      {:ok, descriptors} ->
        {:ok, descriptors}

      {:error, _reason} when attempt < 3 ->
        Logger.warning("Classification attempt #{attempt} failed, retrying...")
        Process.sleep(1000 * attempt)
        classify_page_with_retry(page, attempt + 1)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp default_descriptors do
    %{
      "mood" => "neutral",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "activity_level" => "moderate",
      "atmosphere" => "neutral"
    }
  end

  defp detect_boundaries(pages_with_descriptors) do
    Logger.info("Detecting scene boundaries...")

    boundaries = SceneClassifier.detect_scene_boundaries(pages_with_descriptors)
    Logger.info("Detected #{length(boundaries)} scene boundaries")

    {:ok, boundaries}
  end

  defp create_scenes(book_id, pages_with_descriptors, boundaries) do
    Logger.info("Creating scene records...")

    case SceneClassifier.create_scenes(book_id, pages_with_descriptors, boundaries) do
      {:ok, scenes} ->
        Logger.info("Created #{length(scenes)} scenes")
        {:ok, scenes}

      {:error, reason} ->
        Logger.error("Failed to create scenes: #{inspect(reason)}")
        {:error, {:scene_creation_failed, reason}}
    end
  end

  defp update_book_with_cost(book, pages_with_descriptors) do
    # Estimate cost based on Gemini Flash pricing
    # Input: ~$0.000075 per 1K tokens, Output: ~$0.0003 per 1K tokens
    # Rough estimate: ~500 input tokens + 100 output tokens per page
    pages_count = length(pages_with_descriptors)
    estimated_cost = Decimal.new(pages_count * 0.00006)

    case Content.update_book(book, %{processing_cost: estimated_cost}) do
      {:ok, _book} -> :ok
      {:error, changeset} -> {:error, {:cost_update_failed, changeset}}
    end
  end

  defp enqueue_soundscape_generator(book_id) do
    Logger.info("Enqueueing SoundscapeGenerator for book_id: #{book_id}")

    # This will be implemented in Task 7
    # For now, just return ok
    {:ok, nil}

    # When SoundscapeGenerator worker is implemented:
    # %{book_id: book_id}
    # |> Storia.Workers.SoundscapeGenerator.new()
    # |> Oban.insert()
  end

  defp format_error(:book_not_found), do: "Book not found"
  defp format_error(:no_pages_found), do: "No pages found for book"
  defp format_error(:classification_failed), do: "Failed to classify pages"
  defp format_error({:scene_creation_failed, reason}), do: "Scene creation failed: #{inspect(reason)}"
  defp format_error({:cost_update_failed, changeset}), do: "Cost update failed: #{inspect(changeset.errors)}"
  defp format_error(reason), do: inspect(reason)
end
