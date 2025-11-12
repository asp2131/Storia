defmodule Storia.AI.SoundscapeGenerator do
  @moduledoc """
  Generates soundscapes for book scenes using AI audio generation.

  This module creates audio soundscapes by:
  1. Converting scene descriptors into AudioGen prompts
  2. Generating audio using the sepal/audiogen model on Replicate
  3. Uploading generated audio to R2 storage
  4. Storing metadata in the database
  """

  require Logger
  alias Storia.AI.ReplicateClient
  alias Storia.Storage
  alias Storia.Soundscapes.Soundscape
  alias Storia.Repo

  @default_duration 10
  @max_duration 30

  @doc """
  Generate a soundscape for a scene.

  ## Parameters
  - `scene`: The scene struct with descriptors
  - `opts`: Optional parameters
    - `:duration` - Audio duration in seconds (default: 10)
    - `:temperature` - Generation temperature (default: 1.0)

  ## Returns
  - `{:ok, soundscape}` with the created soundscape record
  - `{:error, reason}` on failure
  """
  def generate_soundscape(scene, opts \\ []) do
    duration = Keyword.get(opts, :duration, @default_duration)
    temperature = Keyword.get(opts, :temperature, 1.0)

    with {:ok, prompt} <- generate_prompt_from_descriptors(scene.descriptors),
         {:ok, prediction_id} <- create_audio_generation(prompt, duration, temperature),
         {:ok, audio_url} <- poll_and_retrieve_audio(prediction_id),
         {:ok, r2_url} <- upload_to_storage(audio_url, scene),
         {:ok, soundscape} <- create_soundscape_record(scene, r2_url, prompt) do
      Logger.info("Successfully generated soundscape for scene #{scene.id}")
      {:ok, soundscape}
    else
      {:error, reason} = error ->
        Logger.error("Failed to generate soundscape for scene #{scene.id}: #{inspect(reason)}")
        error
    end
  end

  @doc """
  Generate an AudioGen prompt from scene descriptors.

  ## Parameters
  - `descriptors`: Map of scene attributes (mood, setting, etc.)

  ## Returns
  - `{:ok, prompt}` with the generated prompt text
  - `{:error, reason}` if descriptors are invalid

  ## Example
      descriptors = %{
        "mood" => "tense",
        "setting" => "indoor",
        "time_of_day" => "night",
        "weather" => "stormy",
        "activity_level" => "high",
        "atmosphere" => "suspenseful"
      }

      generate_prompt_from_descriptors(descriptors)
      # => {:ok, "Tense and suspenseful indoor soundscape at night with stormy weather, high activity"}
  """
  def generate_prompt_from_descriptors(descriptors) when is_map(descriptors) do
    mood = Map.get(descriptors, "mood", "neutral")
    setting = Map.get(descriptors, "setting", "ambient")
    time_of_day = Map.get(descriptors, "time_of_day", "")
    weather = Map.get(descriptors, "weather", "")
    activity_level = Map.get(descriptors, "activity_level", "moderate")
    atmosphere = Map.get(descriptors, "atmosphere", "")

    # Build a natural language prompt for AudioGen
    parts = [
      mood,
      if(atmosphere != "" and atmosphere != mood, do: "and #{atmosphere}", else: nil),
      setting,
      "soundscape"
    ]

    # Add time context
    parts = if time_of_day != "" and time_of_day != "unknown" do
      parts ++ ["at #{time_of_day}"]
    else
      parts
    end

    # Add weather if relevant
    parts = if weather != "" and weather != "unknown" and weather != "clear" do
      parts ++ ["with #{weather} weather"]
    else
      parts
    end

    # Add activity level
    parts = parts ++ ["#{activity_level} activity"]

    prompt =
      parts
      |> Enum.filter(&(&1 != nil))
      |> Enum.join(" ")
      |> String.trim()

    {:ok, prompt}
  end

  def generate_prompt_from_descriptors(_), do: {:error, :invalid_descriptors}

  # Private functions

  defp create_audio_generation(prompt, duration, temperature) do
    Logger.info("Creating audio generation with prompt: #{prompt}")

    ReplicateClient.create_audio_prediction(prompt,
      duration: min(duration, @max_duration),
      temperature: temperature,
      output_format: "mp3"
    )
  end

  defp poll_and_retrieve_audio(prediction_id) do
    Logger.info("Polling for audio generation completion: #{prediction_id}")

    case ReplicateClient.poll_prediction(prediction_id, max_attempts: 120, initial_delay: 2000) do
      {:ok, output} when is_binary(output) ->
        # Output is the URL to the generated audio file
        {:ok, output}

      {:ok, output} when is_list(output) ->
        # Sometimes output is a list with one URL
        case output do
          [url | _] when is_binary(url) -> {:ok, url}
          _ -> {:error, :invalid_output_format}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp upload_to_storage(audio_url, scene) do
    Logger.info("Downloading and uploading audio to R2 for scene #{scene.id}")

    # Download the audio file from Replicate
    case HTTPoison.get(audio_url, [], follow_redirect: true) do
      {:ok, %HTTPoison.Response{status_code: 200, body: audio_data}} ->
        # Generate a unique key for R2
        key = "soundscapes/scene_#{scene.id}_#{:os.system_time(:millisecond)}.mp3"

        # Upload to R2
        case Storage.upload_audio(audio_data, key, "audio/mpeg") do
          {:ok, r2_url} ->
            Logger.info("Successfully uploaded audio to R2: #{r2_url}")
            {:ok, r2_url}

          {:error, reason} ->
            Logger.error("Failed to upload audio to R2: #{inspect(reason)}")
            {:error, {:upload_failed, reason}}
        end

      {:ok, %HTTPoison.Response{status_code: status}} ->
        {:error, {:download_failed, status}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, {:download_error, reason}}
    end
  end

  defp create_soundscape_record(scene, audio_url, prompt) do
    attrs = %{
      scene_id: scene.id,
      audio_url: audio_url,
      generation_prompt: prompt,
      source_type: "ai_generated",
      tags: extract_tags_from_descriptors(scene.descriptors)
    }

    %Soundscape{}
    |> Soundscape.changeset(attrs)
    |> Repo.insert()
  end

  defp extract_tags_from_descriptors(descriptors) do
    descriptors
    |> Map.values()
    |> Enum.filter(&(&1 != "" and &1 != "unknown"))
    |> Enum.uniq()
  end
end
