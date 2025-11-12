defmodule Storia.Workers.SoundscapeGenerator do
  @moduledoc """
  Oban worker for generating AI soundscapes for book scenes.

  This worker:
  1. Fetches all scenes for a book
  2. Generates audio for each scene using AudioGen
  3. Uploads audio files to R2 storage
  4. Creates soundscape records
  5. Updates book processing status
  6. Tracks generation costs
  """

  use Oban.Worker,
    queue: :ai_analysis,
    max_attempts: 3

  require Logger

  alias Storia.{Content, Repo}
  alias Storia.AI.SoundscapeGenerator, as: Generator
  alias Storia.Content.{Book, Scene}

  @default_duration 10
  @cost_per_second 0.0023

  @doc """
  Perform the soundscape generation job.

  ## Job args
  - `book_id`: The ID of the book to generate soundscapes for
  - `duration`: Optional audio duration in seconds (default: 10)
  """
  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"book_id" => book_id} = args}) do
    duration = Map.get(args, "duration", @default_duration)

    Logger.info("Starting soundscape generation for book_id: #{book_id}")

    with {:ok, book} <- fetch_book(book_id),
         {:ok, scenes} <- fetch_scenes(book_id),
         :ok <- validate_scenes(scenes),
         :ok <- Content.update_book_status(book_id, "mapping"),
         {:ok, soundscapes} <- generate_all_soundscapes(scenes, duration),
         :ok <- update_book_with_cost(book, soundscapes, duration),
         :ok <- Content.update_book_status(book_id, "ready_for_review") do
      Logger.info("Successfully generated #{length(soundscapes)} soundscapes for book_id: #{book_id}")
      :ok
    else
      {:error, :book_not_found} = error ->
        Logger.error("Failed to generate soundscapes for book_id: #{book_id}, reason: :book_not_found")
        error

      {:error, reason} = error ->
        Logger.error("Failed to generate soundscapes for book_id: #{book_id}, reason: #{inspect(reason)}")
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

  defp fetch_scenes(book_id) do
    import Ecto.Query

    scenes =
      from(s in Scene,
        where: s.book_id == ^book_id,
        order_by: [asc: s.scene_number]
      )
      |> Repo.all()

    {:ok, scenes}
  end

  defp validate_scenes([]), do: {:error, :no_scenes_found}
  defp validate_scenes(_scenes), do: :ok

  defp generate_all_soundscapes(scenes, duration) do
    Logger.info("Generating soundscapes for #{length(scenes)} scenes...")

    results =
      scenes
      |> Enum.with_index(1)
      |> Enum.map(fn {scene, idx} ->
        Logger.info("Generating soundscape #{idx}/#{length(scenes)} for scene #{scene.scene_number}")

        case generate_soundscape_with_retry(scene, duration) do
          {:ok, soundscape} ->
            {:ok, soundscape}

          {:error, reason} ->
            Logger.error("Failed to generate soundscape for scene #{scene.id}: #{inspect(reason)}")
            {:error, {:scene_generation_failed, scene.id, reason}}
        end
      end)

    # Check if all generations succeeded
    case Enum.split_with(results, &match?({:ok, _}, &1)) do
      {successes, []} ->
        soundscapes = Enum.map(successes, fn {:ok, soundscape} -> soundscape end)
        {:ok, soundscapes}

      {_successes, failures} ->
        Logger.error("#{length(failures)} soundscape generations failed")
        {:error, {:partial_generation_failure, failures}}
    end
  end

  defp generate_soundscape_with_retry(scene, duration, attempt \\ 1) do
    case Generator.generate_soundscape(scene, duration: duration) do
      {:ok, soundscape} ->
        {:ok, soundscape}

      {:error, _reason} when attempt < 3 ->
        Logger.warning("Generation attempt #{attempt} failed for scene #{scene.id}, retrying...")
        Process.sleep(2000 * attempt)
        generate_soundscape_with_retry(scene, duration, attempt + 1)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp update_book_with_cost(book, soundscapes, duration) do
    # Calculate cost based on AudioGen pricing
    # ~$0.0023 per second of audio
    total_seconds = length(soundscapes) * duration
    generation_cost = Decimal.new(total_seconds * @cost_per_second)

    # Add to existing processing cost (from scene analysis)
    current_cost = book.processing_cost || Decimal.new(0)
    total_cost = Decimal.add(current_cost, generation_cost)

    case Content.update_book(book, %{processing_cost: total_cost}) do
      {:ok, _book} ->
        Logger.info("Updated book cost: #{Decimal.to_string(total_cost)}")
        :ok

      {:error, changeset} ->
        {:error, {:cost_update_failed, changeset}}
    end
  end

  defp format_error(:book_not_found), do: "Book not found"
  defp format_error(:no_scenes_found), do: "No scenes found for book"

  defp format_error({:scene_generation_failed, scene_id, reason}),
    do: "Scene #{scene_id} generation failed: #{inspect(reason)}"

  defp format_error({:partial_generation_failure, failures}),
    do: "#{length(failures)} soundscape generations failed"

  defp format_error({:cost_update_failed, changeset}),
    do: "Cost update failed: #{inspect(changeset.errors)}"

  defp format_error(reason), do: inspect(reason)
end
