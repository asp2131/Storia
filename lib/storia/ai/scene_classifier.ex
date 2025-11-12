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
        "mood" => "tense",
        "setting" => "indoor",
        "time_of_day" => "night",
        "weather" => "stormy",
        "activity_level" => "high",
        "atmosphere" => "suspenseful"
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
    Analyze the following text excerpt from a book and classify the scene with descriptive attributes.

    Text:
    #{String.slice(page_text, 0, 2000)}

    Provide a JSON response with the following attributes:
    - mood: The emotional tone (e.g., "joyful", "tense", "melancholic", "peaceful", "mysterious")
    - setting: The location type (e.g., "indoor", "outdoor", "urban", "rural", "nature")
    - time_of_day: When the scene takes place (e.g., "morning", "afternoon", "evening", "night", "unknown")
    - weather: Weather conditions if mentioned (e.g., "sunny", "rainy", "stormy", "cloudy", "snowy", "clear", "unknown")
    - activity_level: The pace of action (e.g., "calm", "moderate", "high", "intense")
    - atmosphere: Overall feeling (e.g., "suspenseful", "romantic", "adventurous", "contemplative", "dramatic")

    Respond ONLY with valid JSON in this exact format:
    {
      "mood": "value",
      "setting": "value",
      "time_of_day": "value",
      "weather": "value",
      "activity_level": "value",
      "atmosphere": "value"
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
    required_keys = ["mood", "setting", "time_of_day", "weather", "activity_level", "atmosphere"]

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
    keys = Map.keys(descriptors1)

    matching_count =
      Enum.count(keys, fn key ->
        Map.get(descriptors1, key) == Map.get(descriptors2, key)
      end)

    matching_count / length(keys)
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
      "atmosphere" => "neutral"
    }
  end
end
