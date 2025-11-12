defmodule Storia.AI.ReplicateClient do
  @moduledoc """
  Client for interacting with the Replicate API.

  This module provides functions to create and retrieve predictions
  using Replicate's API, with support for retry logic and error handling.
  """

  require Logger

  @base_url "https://api.replicate.com/v1"
  @gemini_model "google/gemini-2.5-flash"
  @audiogen_version "sepal/audiogen:154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8"
  @max_retries 3
  @initial_backoff 1000

  @doc """
  Create a prediction using the Gemini Flash model.

  ## Parameters
  - `prompt`: The text prompt to send to the model
  - `opts`: Optional parameters
    - `:temperature` - Controls randomness (0.0 to 1.0, default: 0.7)
    - `:max_tokens` - Maximum tokens to generate (default: 1024)
    - `:system_prompt` - System instructions for the model

  ## Returns
  - `{:ok, prediction_id}` on success
  - `{:error, reason}` on failure
  """
  def create_prediction(prompt, opts \\ []) do
    temperature = Keyword.get(opts, :temperature, 0.7)
    max_tokens = Keyword.get(opts, :max_tokens, 1024)
    system_prompt = Keyword.get(opts, :system_prompt)

    input = %{
      prompt: prompt,
      temperature: temperature,
      max_tokens: max_tokens
    }

    input = if system_prompt, do: Map.put(input, :system_prompt, system_prompt), else: input

    body = %{
      version: get_model_version(),
      input: input
    }

    url = "#{@base_url}/predictions"

    case make_request(:post, url, body, 0) do
      {:ok, %{"id" => prediction_id}} ->
        Logger.info("Created prediction: #{prediction_id}")
        {:ok, prediction_id}

      {:error, reason} = error ->
        Logger.error("Failed to create prediction: #{inspect(reason)}")
        error
    end
  end

  @doc """
  Create an audio generation prediction using the AudioGen model.

  ## Parameters
  - `prompt`: The text description of the sound to generate
  - `opts`: Optional parameters
    - `:duration` - Duration in seconds (1-30, default: 10)
    - `:temperature` - Controls randomness (0.0 to 2.0, default: 1.0)
    - `:top_k` - Top-k sampling (default: 250)
    - `:top_p` - Top-p sampling (default: 0)
    - `:classifier_free_guidance` - CFG scale (default: 3)
    - `:output_format` - Audio format: "wav" or "mp3" (default: "mp3")

  ## Returns
  - `{:ok, prediction_id}` on success
  - `{:error, reason}` on failure
  """
  def create_audio_prediction(prompt, opts \\ []) do
    duration = Keyword.get(opts, :duration, 10)
    temperature = Keyword.get(opts, :temperature, 1.0)
    top_k = Keyword.get(opts, :top_k, 250)
    top_p = Keyword.get(opts, :top_p, 0)
    classifier_free_guidance = Keyword.get(opts, :classifier_free_guidance, 3)
    output_format = Keyword.get(opts, :output_format, "mp3")

    input = %{
      prompt: prompt,
      duration: duration,
      temperature: temperature,
      top_k: top_k,
      top_p: top_p,
      classifier_free_guidance: classifier_free_guidance,
      output_format: output_format
    }

    body = %{
      version: @audiogen_version,
      input: input
    }

    url = "#{@base_url}/predictions"

    case make_request(:post, url, body, 0) do
      {:ok, %{"id" => prediction_id}} ->
        Logger.info("Created audio prediction: #{prediction_id}")
        {:ok, prediction_id}

      {:error, reason} = error ->
        Logger.error("Failed to create audio prediction: #{inspect(reason)}")
        error
    end
  end

  @doc """
  Get the status and results of a prediction.

  ## Parameters
  - `prediction_id`: The ID of the prediction to retrieve

  ## Returns
  - `{:ok, prediction}` with the prediction data
  - `{:error, reason}` on failure

  The prediction map includes:
  - `status`: "starting", "processing", "succeeded", "failed", or "canceled"
  - `output`: The model's output (when status is "succeeded")
  - `error`: Error message (when status is "failed")
  """
  def get_prediction(prediction_id) do
    url = "#{@base_url}/predictions/#{prediction_id}"

    case make_request(:get, url, nil, 0) do
      {:ok, prediction} ->
        {:ok, prediction}

      {:error, reason} = error ->
        Logger.error("Failed to get prediction #{prediction_id}: #{inspect(reason)}")
        error
    end
  end

  @doc """
  Poll for prediction completion with exponential backoff.

  ## Parameters
  - `prediction_id`: The ID of the prediction to poll
  - `opts`: Optional parameters
    - `:max_attempts` - Maximum polling attempts (default: 60)
    - `:initial_delay` - Initial delay in ms (default: 1000)
    - `:max_delay` - Maximum delay in ms (default: 10000)

  ## Returns
  - `{:ok, output}` when prediction succeeds
  - `{:error, reason}` on failure or timeout
  """
  def poll_prediction(prediction_id, opts \\ []) do
    max_attempts = Keyword.get(opts, :max_attempts, 60)
    initial_delay = Keyword.get(opts, :initial_delay, 1000)
    max_delay = Keyword.get(opts, :max_delay, 10_000)

    poll_loop(prediction_id, 0, max_attempts, initial_delay, max_delay)
  end

  # Private functions

  defp poll_loop(prediction_id, attempt, max_attempts, delay, max_delay) do
    if attempt >= max_attempts do
      {:error, :polling_timeout}
    else
      case get_prediction(prediction_id) do
        {:ok, %{"status" => "succeeded", "output" => output}} ->
          {:ok, output}

        {:ok, %{"status" => "failed", "error" => error}} ->
          {:error, {:prediction_failed, error}}

        {:ok, %{"status" => "canceled"}} ->
          {:error, :prediction_canceled}

        {:ok, %{"status" => status}} when status in ["starting", "processing"] ->
          Logger.debug("Prediction #{prediction_id} status: #{status}, attempt #{attempt + 1}/#{max_attempts}")
          Process.sleep(delay)
          next_delay = min(delay * 2, max_delay)
          poll_loop(prediction_id, attempt + 1, max_attempts, next_delay, max_delay)

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp make_request(method, url, body, retry_count) do
    headers = [
      {"Authorization", "Bearer #{get_api_key()}"},
      {"Content-Type", "application/json"}
    ]

    request_body = if body, do: Jason.encode!(body), else: ""

    case HTTPoison.request(method, url, request_body, headers) do
      {:ok, %HTTPoison.Response{status_code: status, body: response_body}}
      when status in 200..299 ->
        case Jason.decode(response_body) do
          {:ok, data} -> {:ok, data}
          {:error, reason} -> {:error, {:json_decode_error, reason}}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}}
      when status in 400..499 ->
        Logger.error("Client error #{status}: #{response_body}")
        {:error, {:client_error, status, response_body}}

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}}
      when status in 500..599 ->
        if retry_count < @max_retries do
          backoff = @initial_backoff * :math.pow(2, retry_count) |> round()
          Logger.warning("Server error #{status}, retrying in #{backoff}ms (attempt #{retry_count + 1}/#{@max_retries})")
          Process.sleep(backoff)
          make_request(method, url, body, retry_count + 1)
        else
          Logger.error("Server error #{status} after #{@max_retries} retries: #{response_body}")
          {:error, {:server_error, status, response_body}}
        end

      {:error, %HTTPoison.Error{reason: reason}} ->
        if retry_count < @max_retries do
          backoff = @initial_backoff * :math.pow(2, retry_count) |> round()
          Logger.warning("Network error: #{inspect(reason)}, retrying in #{backoff}ms (attempt #{retry_count + 1}/#{@max_retries})")
          Process.sleep(backoff)
          make_request(method, url, body, retry_count + 1)
        else
          Logger.error("Network error after #{@max_retries} retries: #{inspect(reason)}")
          {:error, {:network_error, reason}}
        end
    end
  end

  defp get_api_key do
    System.get_env("REPLICATE_API_KEY") ||
      raise "REPLICATE_API_KEY environment variable not set"
  end

  defp get_model_version do
    # This should be the specific version ID for gemini-2.5-flash
    # For now, we'll use the model identifier and let Replicate resolve it
    @gemini_model
  end
end
