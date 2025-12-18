defmodule Storia.Storage do
  @moduledoc """
  Handles file storage operations with Supabase Storage.

  Provides functions for uploading PDFs and audio files, generating signed URLs,
  and managing file lifecycle in Supabase storage buckets.
  """

  require Logger

  @signed_url_expiry 3600 # 1 hour in seconds

  defp config do
    Application.get_env(:storia, :supabase, [])
  end

  defp supabase_url, do: Keyword.get(config(), :url)
  defp service_role_key, do: Keyword.get(config(), :service_role_key)
  defp bucket, do: Keyword.get(config(), :storage_bucket, "storia-storage")

  @doc """
  Uploads a PDF file to Supabase storage.

  ## Parameters
    - file_path: Local path to the PDF file
    - book_id: Unique identifier for the book

  ## Returns
    - {:ok, url} on success
    - {:error, reason} on failure

  ## Examples
      iex> Storia.Storage.upload_pdf("/tmp/book.pdf", "uuid-123")
      {:ok, "https://[project].supabase.co/storage/v1/object/public/storia-storage/pdfs/uuid-123.pdf"}
  """
  def upload_pdf(file_path, book_id) do
    key = generate_pdf_key(book_id)
    upload_file(file_path, key, "application/pdf")
  end

  @doc """
  Uploads an audio file to Supabase storage.

  ## Parameters
    - file_path: Local path to the audio file
    - scene_id: Unique identifier for the scene
    - source_type: Either :curated or :generated

  ## Returns
    - {:ok, url} on success
    - {:error, reason} on failure

  ## Examples
      iex> Storia.Storage.upload_audio("/tmp/ambient.mp3", "scene-123", :curated)
      {:ok, "https://[project].supabase.co/storage/v1/object/public/storia-storage/audio/curated/scene-123.mp3"}
  """
  def upload_audio(file_path, scene_id, source_type) when source_type in [:curated, :generated] do
    key = generate_audio_key(scene_id, source_type)
    content_type = determine_audio_content_type(file_path)
    upload_file(file_path, key, content_type)
  end

  @doc """
  Uploads audio data (binary) directly to Supabase storage.

  ## Parameters
    - audio_data: Binary audio data
    - key: The full storage key path
    - content_type: MIME type of the audio file

  ## Returns
    - {:ok, url} on success
    - {:error, reason} on failure
  """
  def upload_audio_data(audio_data, key, content_type) when is_binary(audio_data) do
    upload_binary_data(audio_data, key, content_type)
  end

  @doc """
  Generates a signed URL for secure streaming of files from Supabase storage.

  ## Parameters
    - key: The object key in storage
    - expiry: Optional expiry time in seconds (default: 1 hour)

  ## Returns
    - {:ok, signed_url} on success
    - {:error, reason} on failure

  ## Examples
      iex> Storia.Storage.generate_signed_url("audio/curated/scene-123.mp3")
      {:ok, "https://[project].supabase.co/storage/v1/object/sign/storia-storage/audio/curated/scene-123.mp3?token=..."}
  """
  def generate_signed_url(key, expiry \\ @signed_url_expiry) do
    url = "#{supabase_url()}/storage/v1/object/sign/#{bucket()}/#{key}"
    headers = [
      {"Authorization", "Bearer #{service_role_key()}"},
      {"Content-Type", "application/json"}
    ]
    body = Jason.encode!(%{expiresIn: expiry})

    case HTTPoison.post(url, body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        case Jason.decode(response_body) do
          {:ok, %{"signedURL" => signed_url}} -> {:ok, signed_url}
          _ -> {:error, "Invalid response format"}
        end
      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "Failed to generate signed URL: HTTP #{status} - #{body}"}
      {:error, reason} ->
        {:error, "Request failed: #{inspect(reason)}"}
    end
  end

  @doc """
  Deletes a file from Supabase storage.

  ## Parameters
    - key: The object key in storage

  ## Returns
    - :ok on success
    - {:error, reason} on failure

  ## Examples
      iex> Storia.Storage.delete_file("pdfs/uuid-123.pdf")
      :ok
  """
  def delete_file(key) do
    url = "#{supabase_url()}/storage/v1/object/#{bucket()}/#{key}"
    headers = [
      {"Authorization", "Bearer #{service_role_key()}"}
    ]

    case HTTPoison.delete(url, headers) do
      {:ok, %HTTPoison.Response{status_code: status}} when status in [200, 204] ->
        :ok
      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        {:error, "Failed to delete file: HTTP #{status} - #{body}"}
      {:error, reason} ->
        {:error, "Request failed: #{inspect(reason)}"}
    end
  end

  @doc """
  Lists files in a specific folder/path in the Supabase storage bucket.

  ## Parameters
    - path: The folder path to list (e.g., "magic", "magic/nature")
    - opts: Optional parameters
      - :recursive - List files recursively (default: false)

  ## Returns
    - {:ok, files} on success, where files is a list of maps with :name, :path, :url
    - {:error, reason} on failure

  ## Examples
      iex> Storia.Storage.list_bucket_files("magic/nature")
      {:ok, [%{name: "Forest_Ambience.mp3", path: "magic/nature/Forest_Ambience.mp3", url: "..."}]}
  """
  def list_bucket_files(path, opts \\ []) do
    with :ok <- validate_storage_config() do
      _recursive = Keyword.get(opts, :recursive, false)

      # Ensure path doesn't start or end with /
      clean_path =
        path
        |> String.trim_leading("/")
        |> String.trim_trailing("/")

      url = "#{supabase_url()}/storage/v1/object/list/#{bucket()}"
      headers = [
        {"Authorization", "Bearer #{service_role_key()}"},
        {"Content-Type", "application/json"}
      ]

      body = Jason.encode!(%{
        prefix: clean_path,
        search: "",
        limit: 1000,
        offset: 0,
        sortBy: %{column: "name", order: "asc"}
      })

      case HTTPoison.post(url, body, headers) do
        {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
          case Jason.decode(response_body) do
            {:ok, files} when is_list(files) ->
              # Filter out folders (they have id: null) and map to friendly format
              file_list =
                files
                |> Enum.filter(fn file ->
                  Map.get(file, "id") != nil &&
                    String.ends_with?(Map.get(file, "name", ""), [".mp3", ".wav", ".ogg", ".m4a"])
                end)
                |> Enum.map(fn file ->
                  file_name = Map.get(file, "name")
                  file_path = if clean_path == "", do: file_name, else: "#{clean_path}/#{file_name}"

                  %{
                    name: file_name,
                    path: file_path,
                    url: build_public_url(file_path),
                    size: Map.get(file, "metadata", %{}) |> Map.get("size"),
                    updated_at: Map.get(file, "updated_at")
                  }
                end)

              {:ok, file_list}

            {:ok, _} ->
              {:error, "Unexpected response format"}

            {:error, reason} ->
              {:error, "Failed to decode response: #{inspect(reason)}"}
          end

        {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
          Logger.error("List files failed: HTTP #{status} - #{body}")
          {:error, "Failed to list files: HTTP #{status}"}

        {:error, reason} ->
          Logger.error("List files request failed: #{inspect(reason)}")
          {:error, "Request failed: #{inspect(reason)}"}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Lists all folders in the audio/curated directory with their file counts.

  ## Returns
    - {:ok, folders} where folders is a list of maps with :name, :path, :file_count
    - {:error, reason} on failure

  ## Examples
      iex> Storia.Storage.list_curated_folders()
      {:ok, [%{name: "magic", path: "audio/curated/magic", file_count: 10}, ...]}
  """
  def list_curated_folders do
    base_path = "audio/curated"

    with :ok <- validate_storage_config(),
         {:ok, folder_items} <- list_folders_in_path(base_path) do
      folders =
        folder_items
        |> Enum.map(fn folder_name ->
          folder_path = "#{base_path}/#{folder_name}"

          case list_bucket_files(folder_path) do
            {:ok, files} ->
              %{
                name: folder_name,
                path: folder_path,
                file_count: length(files)
              }

            {:error, _} ->
              %{
                name: folder_name,
                path: folder_path,
                file_count: 0
              }
          end
        end)
        |> Enum.sort_by(& &1.name)

      {:ok, folders}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Lists folders (directories) at a specific path in the bucket.

  Returns folder names only, not files.
  """
  def list_folders_in_path(path) do
    with :ok <- validate_storage_config() do
      clean_path =
        path
        |> String.trim_leading("/")
        |> String.trim_trailing("/")

      url = "#{supabase_url()}/storage/v1/object/list/#{bucket()}"
      headers = [
        {"Authorization", "Bearer #{service_role_key()}"},
        {"Content-Type", "application/json"}
      ]

      body = Jason.encode!(%{
        prefix: clean_path,
        search: "",
        limit: 1000,
        offset: 0
      })

      case HTTPoison.post(url, body, headers) do
        {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
          case Jason.decode(response_body) do
            {:ok, items} when is_list(items) ->
              # Filter for folders only (id == nil)
              folder_names =
                items
                |> Enum.filter(fn item -> Map.get(item, "id") == nil end)
                |> Enum.map(fn item -> Map.get(item, "name") end)
                |> Enum.reject(&is_nil/1)

              {:ok, folder_names}

            {:ok, _} ->
              {:error, "Unexpected response format"}

            {:error, reason} ->
              {:error, "Failed to decode response: #{inspect(reason)}"}
          end

        {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
          Logger.error("List folders failed: HTTP #{status} - #{body}")
          {:error, "Failed to list folders: HTTP #{status}"}

        {:error, reason} ->
          Logger.error("List folders request failed: #{inspect(reason)}")
          {:error, "Request failed: #{inspect(reason)}"}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Extracts the storage key from a full URL.

  ## Examples
      iex> Storia.Storage.extract_key_from_url("https://[project].supabase.co/storage/v1/object/public/storia-storage/pdfs/uuid-123.pdf")
      "pdfs/uuid-123.pdf"
  """
  def extract_key_from_url(url) when is_binary(url) do
    uri = URI.parse(url)
    bucket_name = bucket()

    case uri.path do
      "/" <> path ->
        # Extract key after bucket name in path
        # Expected format: /storage/v1/object/public/BUCKET/KEY
        case String.split(path, "/#{bucket_name}/", parts: 2) do
          [_, key] -> key
          _ -> nil
        end
      _ ->
        nil
    end
  end

  # Private functions

  defp upload_file(file_path, key, content_type) do
    case File.read(file_path) do
      {:ok, file_content} ->
        upload_binary_data(file_content, key, content_type)

      {:error, reason} ->
        {:error, "Failed to read file: #{inspect(reason)}"}
    end
  end

  defp upload_binary_data(binary_data, key, content_type) do
    case validate_storage_config() do
      :ok ->
        url = "#{supabase_url()}/storage/v1/object/#{bucket()}/#{key}"
        headers = [
          {"Authorization", "Bearer #{service_role_key()}"},
          {"Content-Type", content_type}
        ]

        # Extended timeouts for large file uploads
        options = [
          timeout: 60_000,       # Overall request timeout (60s)
          recv_timeout: 60_000   # Time to receive response after sending (60s)
        ]

        case HTTPoison.post(url, binary_data, headers, options) do
          {:ok, %HTTPoison.Response{status_code: 200}} ->
            {:ok, build_public_url(key)}

          {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
            Logger.error("Upload failed: HTTP #{status} - #{body}")
            {:error, "Upload failed: HTTP #{status}"}

          {:error, %HTTPoison.Error{reason: :timeout}} ->
            Logger.warning("Upload timed out for #{key}, but may have succeeded - check bucket")
            {:error, "Upload timed out (may have succeeded; check bucket)"}

          {:error, reason} ->
            Logger.error("Upload request failed: #{inspect(reason)}")
            {:error, "Request failed: #{inspect(reason)}"}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp generate_pdf_key(book_id) do
    "pdfs/#{book_id}.pdf"
  end

  defp generate_audio_key(scene_id, source_type) do
    "audio/#{source_type}/#{scene_id}.mp3"
  end

  defp determine_audio_content_type(file_path) do
    case Path.extname(file_path) do
      ".mp3" -> "audio/mpeg"
      ".wav" -> "audio/wav"
      ".ogg" -> "audio/ogg"
      ".m4a" -> "audio/mp4"
      _ -> "audio/mpeg" # default
    end
  end

  @doc """
  Builds a public URL for a storage key.

  ## Parameters
    - key: The storage key (e.g., "magic/Dark_Magic_Rumble.mp3")

  ## Returns
    - Public URL string

  ## Examples
      iex> Storia.Storage.build_public_url("magic/Dark_Magic_Rumble.mp3")
      "https://[project].supabase.co/storage/v1/object/public/storia-storage/magic/Dark_Magic_Rumble.mp3"
  """
  def build_public_url(key) do
    "#{supabase_url()}/storage/v1/object/public/#{bucket()}/#{key}"
  end

  defp validate_storage_config do
    cond do
      is_nil(supabase_url()) or supabase_url() == "" ->
        {:error, "Supabase URL is not configured"}

      is_nil(service_role_key()) or service_role_key() == "" ->
        {:error, "Supabase service role key is not configured"}

      true ->
        :ok
    end
  end
end
