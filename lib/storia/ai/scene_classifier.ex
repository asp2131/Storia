defmodule Storia.AI.SceneClassifier do
  @moduledoc """
  Classifies book pages into scenes with descriptive attributes.

  This module uses AI to analyze page text and extract scene descriptors
  such as mood, setting, time of day, weather, and activity level.
  It also detects scene boundaries by comparing descriptor similarity.
  """

  require Logger
  alias Storia.AI.ReplicateClient
  alias Storia.Content.{Scene, Page}
  alias Storia.Repo

  import Ecto.Query

  @similarity_threshold Application.compile_env(:storia, :scene_boundary_threshold, 0.6)

  @doc """
  Classify a single page and return scene descriptors.

  ## Parameters
  - `page_text`: The text content of the page

  ## Returns
  - `{:ok, descriptors}` with a map of scene attributes
  - `{:error, reason}` on failure

  ## Example descriptors
      %{
        "mood" => "curious",
        "setting" => "garden",
        "time_of_day" => "afternoon",
        "weather" => "sunny",
        "activity_level" => "moderate",
        "atmosphere" => "whimsical",
        "scene_type" => "discovery",
        "dominant_elements" => "birds, wind, wonder"
      }
  """
  def classify_page(nil), do: {:error, :empty_page_text}
  def classify_page(""), do: {:error, :empty_page_text}

  def classify_page(page_text) when is_binary(page_text) do
    prompt = build_classification_prompt(page_text)

    with {:ok, prediction_id} <- ReplicateClient.create_prediction(prompt, temperature: 0.3, max_tokens: 500),
         {:ok, output} <- ReplicateClient.poll_prediction(prediction_id) do
      parse_classification_output(output)
    end
  end

  def classify_page(_), do: {:error, :invalid_page_text}

  @doc """
  Detect scene boundaries in a list of pages based on descriptor similarity.

  ## Parameters
  - `pages`: List of pages with their descriptors
  - `threshold`: Optional similarity threshold (default from config: #{@similarity_threshold})

  ## Returns
  - List of scene boundary indices (page numbers where new scenes start)

  ## Algorithm
  Compares consecutive pages using descriptor similarity.
  A new scene is detected when similarity falls below threshold.
  """
  def detect_scene_boundaries(pages_with_descriptors, threshold \\ @similarity_threshold) do
    pages_with_descriptors
    |> Enum.chunk_every(2, 1, :discard)
    |> Enum.with_index(1)
    |> Enum.reduce([1], fn {[prev, curr], idx}, acc ->
      similarity = calculate_similarity(prev.descriptors, curr.descriptors)

      if similarity < threshold do
        [idx + 1 | acc]
      else
        acc
      end
    end)
    |> Enum.reverse()
  end

  @doc """
  Create scenes from pages grouped by boundaries.

  ## Parameters
  - `book_id`: The ID of the book
  - `pages_with_descriptors`: List of pages with their descriptors
  - `boundaries`: List of page numbers where scenes start

  ## Returns
  - `{:ok, scenes}` with list of created scenes
  - `{:error, reason}` on failure
  """
  def create_scenes(book_id, pages_with_descriptors, boundaries) do
    scenes =
      boundaries
      |> Enum.chunk_every(2, 1)
      |> Enum.with_index(1)
      |> Enum.map(fn {boundary_chunk, scene_number} ->
        {start_page, end_page} =
          case boundary_chunk do
            [start_page, next_start] -> {start_page, next_start - 1}
            [start_page] -> {start_page, length(pages_with_descriptors)}
          end

        pages_in_scene =
          Enum.filter(pages_with_descriptors, fn p ->
            p.page_number >= start_page and p.page_number <= end_page
          end)

        # Aggregate descriptors for the scene (use most common values)
        aggregated_descriptors = aggregate_descriptors(pages_in_scene)

        %{
          book_id: book_id,
          scene_number: scene_number,
          start_page: start_page,
          end_page: end_page,
          descriptors: aggregated_descriptors
        }
      end)

    # Insert scenes and update pages
    Repo.transaction(fn ->
      Enum.reduce_while(scenes, [], fn scene_attrs, acc ->
        case %Scene{}
             |> Scene.changeset(scene_attrs)
             |> Repo.insert() do
          {:ok, scene} ->
            # Update pages with scene_id
            from(p in Page,
              where: p.book_id == ^book_id,
              where: p.page_number >= ^scene_attrs.start_page,
              where: p.page_number <= ^scene_attrs.end_page
            )
            |> Repo.update_all(set: [scene_id: scene.id])

            {:cont, [scene | acc]}

          {:error, changeset} ->
            Repo.rollback({:scene_insert_failed, changeset})
        end
      end)
      |> Enum.reverse()
    end)
  end

  # Private functions

  defp build_classification_prompt(page_text) do
    """
    Analyze the following text excerpt from a book and classify the scene with rich, descriptive attributes that will be used to select ambient soundscapes.

    Text:
    #{String.slice(page_text, 0, 2000)}

    Provide a JSON response with the following attributes. Be specific and descriptive:

    - mood: The emotional tone. Choose the MOST SPECIFIC option:
      * Positive: "joyful", "playful", "whimsical", "serene", "hopeful", "content", "excited", "curious"
      * Negative: "tense", "anxious", "melancholic", "fearful", "ominous", "sorrowful", "angry", "desperate"
      * Neutral/Complex: "mysterious", "contemplative", "nostalgic", "bittersweet", "uncertain", "neutral"

    - setting: The location type. Be as specific as possible:
      * Nature: "forest", "meadow", "garden", "riverside", "lakeside", "mountain", "countryside", "wilderness"
      * Indoor: "home", "palace", "cottage", "library", "chamber", "hall", "underground", "cave"
      * Urban: "city", "town", "street", "marketplace", "village"
      * Special: "magical_realm", "dreamscape", "unknown"

    - time_of_day: When the scene takes place:
      * "dawn", "morning", "midday", "afternoon", "dusk", "evening", "night", "midnight", "unknown"

    - weather: Weather conditions if mentioned or implied:
      * "sunny", "clear", "cloudy", "overcast", "rainy", "drizzling", "stormy", "windy", "snowy", "foggy", "misty", "unknown"

    - activity_level: The pace and energy of the scene:
      * "still", "calm", "peaceful", "moderate", "active", "energetic", "intense", "chaotic"

    - atmosphere: Overall feeling and ambiance:
      * "peaceful", "tranquil", "suspenseful", "eerie", "magical", "romantic", "adventurous", "dramatic", "contemplative", "whimsical", "dark", "light", "ethereal"

    - scene_type: The nature of what's happening:
      * "dialogue", "action", "description", "introspection", "discovery", "conflict", "journey", "rest", "transformation", "revelation"

    - dominant_elements: Key environmental or sensory elements present (choose up to 3, comma-separated):
      * Natural: "birds", "wind", "water", "rain", "thunder", "fire", "leaves", "crickets", "ocean", "stream"
      * Ambient: "silence", "echoes", "footsteps", "voices", "music", "bells", "clock", "rustling"
      * Mood: "tension", "wonder", "mystery", "magic", "danger", "comfort", "isolation"

    IMPORTANT: Choose the most specific and evocative options that capture the scene's essence. These descriptors will be used to match ambient soundscapes, so be descriptive!

    Respond ONLY with valid JSON in this exact format:
    {
      "mood": "value",
      "setting": "value",
      "time_of_day": "value",
      "weather": "value",
      "activity_level": "value",
      "atmosphere": "value",
      "scene_type": "value",
      "dominant_elements": "element1, element2, element3"
    }
    """
  end

  defp parse_classification_output(output) when is_binary(output) do
    # Extract JSON from the output (model might include extra text)
    # Find the first { and last } to handle nested JSON
    case extract_json_from_text(output) do
      {:ok, json_str} ->
        case Jason.decode(json_str) do
          {:ok, descriptors} when is_map(descriptors) ->
            validate_descriptors(descriptors)

          {:error, reason} ->
            {:error, {:json_parse_error, reason}}
        end

      :error ->
        {:error, :no_json_found}
    end
  end

  defp parse_classification_output(output) when is_list(output) do
    # If output is a list, join it and parse
    output
    |> Enum.join("")
    |> parse_classification_output()
  end

  defp parse_classification_output(_output) do
    {:error, :invalid_output_format}
  end

  defp extract_json_from_text(text) do
    # Find the first { and last } to handle nested JSON
    start_pos = :binary.match(text, "{")
    end_pos = String.reverse(text) |> then(&:binary.match(&1, "}"))

    case {start_pos, end_pos} do
      {{start_idx, _}, {rev_idx, _}} ->
        end_idx = byte_size(text) - rev_idx
        length = end_idx - start_idx
        {:ok, binary_part(text, start_idx, length)}

      _ ->
        :error
    end
  end

  defp validate_descriptors(descriptors) do
    required_keys = ["mood", "setting", "time_of_day", "weather", "activity_level", "atmosphere", "scene_type", "dominant_elements"]

    if Enum.all?(required_keys, &Map.has_key?(descriptors, &1)) do
      {:ok, descriptors}
    else
      missing_keys = Enum.reject(required_keys, &Map.has_key?(descriptors, &1))
      {:error, {:missing_required_keys, missing_keys}}
    end
  end

  defp calculate_similarity(descriptors1, descriptors2)
       when map_size(descriptors1) == 0 or map_size(descriptors2) == 0 do
    0.0
  end

  defp calculate_similarity(descriptors1, descriptors2) do
    # Weights determine how much each attribute contributes to continuity.
    # Structural changes (Setting, Time) break scenes more than emotional ones.
    weights = %{
      "setting" => 0.30,
      "time_of_day" => 0.20,
      "scene_type" => 0.15,
      "dominant_elements" => 0.15,
      "weather" => 0.10,
      "atmosphere" => 0.05,
      "mood" => 0.05,
      "activity_level" => 0.00 # Activity often fluctuates within a scene
    }

    # Calculate weighted score
    Enum.reduce(weights, 0.0, fn {key, weight}, acc ->
      v1 = Map.get(descriptors1, key)
      v2 = Map.get(descriptors2, key)
      similarity = compare_attribute(key, v1, v2)
      acc + (similarity * weight)
    end)
  end

  defp compare_attribute("dominant_elements", v1, v2) do
    set1 = split_elements(v1)
    set2 = split_elements(v2)

    intersection = MapSet.intersection(set1, set2) |> MapSet.size()
    union = MapSet.union(set1, set2) |> MapSet.size()

    if union == 0, do: 1.0, else: intersection / union
  end

  defp compare_attribute(_key, v1, v2) when is_binary(v1) and is_binary(v2) do
    if String.downcase(v1) == String.downcase(v2), do: 1.0, else: 0.0
  end

  defp compare_attribute(_key, _v1, _v2), do: 0.0

  defp split_elements(nil), do: MapSet.new()
  defp split_elements(""), do: MapSet.new()
  defp split_elements(str) do
    str
    |> String.downcase()
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> MapSet.new()
  end

  defp aggregate_descriptors([]), do: default_descriptors()

  defp aggregate_descriptors(pages_in_scene) do
    # Get the most common value for each descriptor key
    all_descriptors =
      pages_in_scene
      |> Enum.map(& &1.descriptors)
      |> Enum.reject(&is_nil/1)

    if Enum.empty?(all_descriptors) do
      default_descriptors()
    else
      keys = all_descriptors |> List.first() |> Map.keys()

      Enum.reduce(keys, %{}, fn key, acc ->
        # Count occurrences of each value for this key
        value_counts =
          all_descriptors
          |> Enum.map(&Map.get(&1, key))
          |> Enum.reject(&is_nil/1)
          |> Enum.frequencies()

        if Enum.empty?(value_counts) do
          acc
        else
          # Get the most common value
          {most_common_value, _count} = Enum.max_by(value_counts, fn {_value, count} -> count end)
          Map.put(acc, key, most_common_value)
        end
      end)
    end
  end

  defp default_descriptors do
    %{
      "mood" => "neutral",
      "setting" => "unknown",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "activity_level" => "moderate",
      "atmosphere" => "neutral",
      "scene_type" => "description",
      "dominant_elements" => "silence"
    }
  end
end
