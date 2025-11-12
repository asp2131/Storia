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

    max_concurrency = Application.get_env(:storia, :max_classification_concurrency, 5)
    total_count = length(pages)

    results =
      pages
      |> Task.async_stream(
        fn page ->
          case classify_page_with_retry(page) do
            {:ok, descriptors} ->
              {:ok, %{page_number: page.page_number, descriptors: descriptors}}

            {:error, reason} ->
              {:error, page.page_number, reason}
          end
        end,
        max_concurrency: max_concurrency,
        timeout: 60_000,
        on_timeout: :kill_task
      )
      |> Enum.to_list()

    # Separate successes and failures
    {successes, failures} =
      Enum.split_with(results, fn
        {:ok, {:ok, _}} -> true
        _ -> false
      end)

    failure_count = length(failures)
    failure_rate = if total_count > 0, do: failure_count / total_count, else: 0.0

    # Log failures
    Enum.each(failures, fn
      {:ok, {:error, page_number, reason}} ->
        Logger.warning("Failed to classify page #{page_number}: #{inspect(reason)}")

      {:exit, :timeout} ->
        Logger.warning("Page classification timed out")

      other ->
        Logger.warning("Unexpected classification result: #{inspect(other)}")
    end)

    # Fail if more than 30% of pages fail classification
    if failure_rate > 0.3 do
      Logger.error("Too many classification failures: #{failure_count}/#{total_count}")
      {:error, {:high_failure_rate, failure_count, total_count}}
    else
      # Build results with defaults for failed pages
      pages_with_descriptors =
        Enum.zip(pages, results)
        |> Enum.map(fn
          {_page, {:ok, {:ok, data}}} ->
            data

          {page, _failure} ->
            Logger.info("Using default descriptors for page #{page.page_number}")
            %{page_number: page.page_number, descriptors: default_descriptors()}
        end)

      Logger.info(
        "Classification complete: #{length(successes)} succeeded, #{failure_count} failed (#{Float.round(failure_rate * 100, 1)}%)"
      )

      {:ok, pages_with_descriptors}
    end
  end

  defp classify_page_with_retry(page, attempt \\ 1) do
    case SceneClassifier.classify_page(page.text_content) do
      {:ok, descriptors} ->
        {:ok, descriptors}

      {:error, _reason} when attempt < 3 ->
        # Add jitter to prevent thundering herd
        base_delay = 1000 * attempt
        jitter = :rand.uniform(500)
        delay = base_delay + jitter

        Logger.warning("Classification attempt #{attempt} failed, retrying in #{delay}ms...")
        Process.sleep(delay)
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

    if pages_count <= 0 do
      Logger.warning("No pages to calculate cost for")
      :ok
    else
      cost_float = pages_count * 0.00006
      estimated_cost = Decimal.from_float(cost_float) |> Decimal.round(6)

      case Content.update_book(book, %{processing_cost: estimated_cost}) do
        {:ok, _book} -> :ok
        {:error, changeset} -> {:error, {:cost_update_failed, changeset}}
      end
    end
  end

  defp enqueue_soundscape_generator(book_id) do
    Logger.info("Enqueueing SoundscapeGenerator for book_id: #{book_id}")

    %{book_id: book_id}
    |> Storia.Workers.SoundscapeGenerator.new()
    |> Oban.insert()
  end

  defp format_error(:book_not_found), do: "Book not found"
  defp format_error(:no_pages_found), do: "No pages found for book"
  defp format_error(:classification_failed), do: "Failed to classify pages"

  defp format_error({:high_failure_rate, failure_count, total_count}),
    do: "Too many classification failures: #{failure_count}/#{total_count}"

  defp format_error({:scene_creation_failed, reason}), do: "Scene creation failed: #{inspect(reason)}"
  defp format_error({:cost_update_failed, changeset}), do: "Cost update failed: #{inspect(changeset.errors)}"
  defp format_error(reason), do: inspect(reason)
end
