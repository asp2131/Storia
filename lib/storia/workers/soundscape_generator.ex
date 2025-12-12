defmodule Storia.Workers.SoundscapeGenerator do
  @moduledoc """
  Oban worker for assigning curated soundscapes to book scenes.

  This worker:
  1. Fetches all scenes for a book
  2. Loads curated audio from Supabase bucket
  3. Matches scenes to curated audio (threshold-based)
  4. Creates soundscape records (curated only)
  5. Updates book processing status
  """

  use Oban.Worker,
    queue: :ai_analysis,
    max_attempts: 3

  require Logger

  alias Storia.{Content, Repo, Soundscapes}
  alias Storia.Content.{Book, Scene}

  @default_duration 10
  @curated_threshold 0.35

  @doc """
  Perform the soundscape generation job.

  ## Job args
  - `book_id`: The ID of the book to generate soundscapes for
  - `duration`: Optional audio duration in seconds (default: 10)
  """
  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"book_id" => book_id} = args}) do
    _duration = Map.get(args, "duration", @default_duration)

    Logger.info("Starting soundscape generation for book_id: #{book_id}")

    with {:ok, _book} <- fetch_book(book_id),
         {:ok, scenes} <- fetch_scenes(book_id),
         :ok <- validate_scenes(scenes),
         curated <- load_curated_soundscapes(),
         :ok <- Content.update_book_status(book_id, "mapping"),
         {:ok, soundscapes} <- assign_curated_soundscapes(scenes, curated),
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

  defp load_curated_soundscapes do
    case Soundscapes.list_curated_soundscapes_from_bucket() do
      {:ok, curated} -> curated
      {:error, reason} ->
        Logger.warning("Failed to load curated soundscapes: #{inspect(reason)}")
        %{}
    end
  end

  defp assign_curated_soundscapes(scenes, curated_soundscapes) do
    Logger.info("Assigning curated soundscapes for #{length(scenes)} scenes...")

    results =
      scenes
      |> Enum.with_index(1)
      |> Enum.map(fn {scene, idx} ->
        Logger.info("Processing scene #{idx}/#{length(scenes)} (scene #{scene.scene_number})")

        case find_best_curated_match(scene.descriptors, curated_soundscapes) do
          {:ok, file_info, category, score} ->
            case Soundscapes.create_soundscape_from_bucket(scene.id, file_info, category) do
              {:ok, soundscape} ->
                Logger.info("Assigned curated soundscape #{file_info.name} (#{category}) to scene #{scene.id} with score #{Float.round(score, 3)}")
                {:ok, soundscape}

              {:error, reason} ->
                Logger.warning("Failed to assign curated soundscape for scene #{scene.id}: #{inspect(reason)}")
                {:error, {:assign_failed, scene.id, reason}}
            end

          {:error, :no_soundscapes_available} ->
            Logger.error("No curated soundscapes available in bucket")
            {:error, {:no_soundscapes_available, scene.id}}

          {:error, :low_confidence} ->
            Logger.info("Low confidence curated match for scene #{scene.id}; leaving unmapped")
            {:ok, nil}

          {:error, reason} ->
            Logger.warning("Curated match failed for scene #{scene.id}: #{inspect(reason)}")
            {:error, {:curated_match_failed, scene.id, reason}}
        end
      end)

    {successes, failures} = Enum.split_with(results, &match?({:ok, _}, &1))

    mapped =
      successes
      |> Enum.map(fn {:ok, s} -> s end)
      |> Enum.reject(&is_nil/1)

    if failures != [] do
      Logger.error("#{length(failures)} curated assignments failed; mapped #{length(mapped)}")
    end

    {:ok, mapped}
  end

  defp format_error(:book_not_found), do: "Book not found"
  defp format_error(:no_scenes_found), do: "No scenes found for book"
  defp format_error({:no_soundscapes_available, _scene_id}), do: "No curated soundscapes available"
  defp format_error({:assign_failed, scene_id, reason}), do: "Scene #{scene_id} assignment failed: #{inspect(reason)}"
  defp format_error({:curated_match_failed, scene_id, reason}), do: "Scene #{scene_id} curated match failed: #{inspect(reason)}"

  defp format_error(reason), do: inspect(reason)

  # Curated matching -------------------------------------------------------

  defp find_best_curated_match(_descriptors, curated_soundscapes) when map_size(curated_soundscapes) == 0 do
    {:error, :no_soundscapes_available}
  end

  defp find_best_curated_match(descriptors, curated_soundscapes) do
    scores =
      curated_soundscapes
      |> Enum.flat_map(fn {category, files} ->
        Enum.map(files, fn file ->
          score = calculate_match_score(descriptors, file, category)
          {file, category, score}
        end)
      end)
      |> Enum.sort_by(fn {_file, _category, score} -> score end, :desc)

    case List.first(scores) do
      {file, category, score} when score >= @curated_threshold ->
        {:ok, file, category, score}

      _ ->
        {:error, :low_confidence}
    end
  end

  defp calculate_match_score(descriptors, file_info, category) do
    file_name = String.downcase(file_info.name || "")
    category_lower = String.downcase(category)

    keywords =
      file_name
      |> String.replace(~r/\.(mp3|wav|ogg|m4a)$/, "")
      |> String.replace(~r/[._-]/, " ")
      |> String.split()
      |> Enum.map(&String.downcase/1)
      |> Enum.reject(&(&1 in ["sound", "audio", "ambience", "ambient"]))

    setting_synonyms = get_synonyms(descriptors["setting"])
    mood_synonyms = get_synonyms(descriptors["mood"])
    atmosphere_synonyms = get_synonyms(descriptors["atmosphere"])

    search_terms = keywords ++ (keywords |> Enum.flat_map(&get_synonyms/1))

    score = 0.0

    setting_matches =
      Enum.any?(search_terms, fn term ->
        term == String.downcase(descriptors["setting"] || "") or
          term in setting_synonyms
      end)

    score = if setting_matches, do: score + 0.4, else: score

    element_score =
      if descriptors["dominant_elements"] do
        elements =
          descriptors["dominant_elements"]
          |> String.downcase()
          |> String.split(",")
          |> Enum.map(&String.trim/1)
          |> Enum.flat_map(fn e -> [e | get_synonyms(e)] end)

        matches = Enum.count(elements, fn element ->
          Enum.any?(search_terms, &String.contains?(&1, element))
        end)

        matches * 0.15
      else
        0.0
      end

    score = score + element_score

    mood_matches =
      Enum.any?(search_terms, fn term ->
        term == String.downcase(descriptors["mood"] || "") or
          term in mood_synonyms or
          term == String.downcase(descriptors["atmosphere"] || "") or
          term in atmosphere_synonyms
      end)

    score = if mood_matches, do: score + 0.25, else: score

    score =
      if matches_category(category_lower, descriptors["setting"]) or
           matches_category(category_lower, descriptors["scene_type"]) do
        score + 0.2
      else
        score
      end

    min(score, 1.0)
  end

  defp get_synonyms(nil), do: []

  defp get_synonyms(term) do
    term = String.downcase(term)

    case term do
      "riverside" -> ["river", "stream", "brook", "creek", "water", "flow", "babbling", "nature"]
      "underground" -> ["cave", "cavern", "echo", "echoing", "deep", "earth", "subterranean", "rock"]
      "hall" -> ["castle", "grand", "interior", "corridor", "chamber", "room", "palace", "echo"]
      "chamber" -> ["room", "hall", "interior", "house", "echo", "cozy", "cabin"]
      "forest" -> ["wood", "grove", "trees", "nature", "glade", "enchanted", "eerie", "serene", "snowy"]
      "garden" -> ["nature", "flowers", "park", "meadow", "plants", "quiet", "grassy"]
      "meadow" -> ["grass", "grassy", "field", "nature", "flowers", "sun", "quiet"]
      "library" -> ["quiet", "books", "study", "interior", "silence"]
      "city" -> ["bustling", "medieval", "modern", "street", "town", "urban"]
      "magic" -> ["fantasy", "ethereal", "spell", "enchanted", "wizard", "mystical", "supernatural", "fairy"]
      "magical_realm" -> ["fantasy", "magic", "ethereal", "wonder", "dream", "enchanted", "forest"]
      "whimsical" -> ["playful", "wonder", "curious", "fun", "light", "fairy", "chimes"]
      "tense" -> ["suspense", "danger", "ominous", "scary", "fear", "dark", "anxious", "heartbeat"]
      "water" -> ["ocean", "sea", "river", "lake", "rain", "brook", "splash", "underwater"]
      "wind" -> ["breeze", "storm", "air", "blow", "howl", "howling", "mountain"]
      "footsteps" -> ["walk", "run", "step", "movement", "pace", "gravel", "snow"]
      "voices" -> ["speak", "talk", "whisper", "shout", "dialogue", "conversation", "crowd", "murmur"]
      "silence" -> ["quiet", "calm", "still", "serene", "peace"]
      "birds" -> ["chirp", "sing", "nature", "wings"]
      "rain" -> ["light", "gentle", "heavy", "storm", "thunder"]
      "storm" -> ["heavy", "thunderstorm", "rain", "lightning", "raging", "blizzard"]
      "giant" -> ["monster", "heavy", "loud", "thud", "stomp"]
      _ -> []
    end
  end

  defp matches_category(category, value) when is_binary(value) do
    value_lower = String.downcase(value)
    String.contains?(category, value_lower) or String.contains?(value_lower, category)
  end

  defp matches_category(_category, _value), do: false
end
