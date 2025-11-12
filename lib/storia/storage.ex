defmodule Storia.Storage do
  @moduledoc """
  Handles file storage operations with Cloudflare R2 using ExAws.S3.
  
  Provides functions for uploading PDFs and audio files, generating signed URLs,
  and managing file lifecycle in R2 storage.
  """

  alias ExAws.S3

  @bucket System.get_env("R2_BUCKET_NAME", "storia-dev")
  @signed_url_expiry 3600 # 1 hour in seconds

  @doc """
  Uploads a PDF file to R2 storage.
  
  ## Parameters
    - file_path: Local path to the PDF file
    - book_id: Unique identifier for the book
    
  ## Returns
    - {:ok, url} on success
    - {:error, reason} on failure
    
  ## Examples
      iex> Storia.Storage.upload_pdf("/tmp/book.pdf", "uuid-123")
      {:ok, "https://account.r2.cloudflarestorage.com/storia-dev/pdfs/uuid-123.pdf"}
  """
  def upload_pdf(file_path, book_id) do
    key = generate_pdf_key(book_id)
    upload_file(file_path, key, "application/pdf")
  end

  @doc """
  Uploads an audio file to R2 storage.
  
  ## Parameters
    - file_path: Local path to the audio file
    - scene_id: Unique identifier for the scene
    - source_type: Either :curated or :generated
    
  ## Returns
    - {:ok, url} on success
    - {:error, reason} on failure
    
  ## Examples
      iex> Storia.Storage.upload_audio("/tmp/ambient.mp3", "scene-123", :curated)
      {:ok, "https://account.r2.cloudflarestorage.com/storia-dev/audio/curated/scene-123.mp3"}
  """
  def upload_audio(file_path, scene_id, source_type) when source_type in [:curated, :generated] do
    key = generate_audio_key(scene_id, source_type)
    content_type = determine_audio_content_type(file_path)
    upload_file(file_path, key, content_type)
  end

  @doc """
  Generates a signed URL for secure streaming of files from R2.
  
  ## Parameters
    - key: The object key in R2 storage
    - expiry: Optional expiry time in seconds (default: 1 hour)
    
  ## Returns
    - {:ok, signed_url} on success
    - {:error, reason} on failure
    
  ## Examples
      iex> Storia.Storage.generate_signed_url("audio/curated/scene-123.mp3")
      {:ok, "https://account.r2.cloudflarestorage.com/storia-dev/audio/curated/scene-123.mp3?X-Amz-Signature=..."}
  """
  def generate_signed_url(key, expiry \\ @signed_url_expiry) do
    config = ExAws.Config.new(:s3)
    
    case S3.presigned_url(config, :get, @bucket, key, expires_in: expiry) do
      {:ok, url} -> {:ok, url}
      error -> {:error, "Failed to generate signed URL: #{inspect(error)}"}
    end
  end

  @doc """
  Deletes a file from R2 storage.
  
  ## Parameters
    - key: The object key in R2 storage
    
  ## Returns
    - :ok on success
    - {:error, reason} on failure
    
  ## Examples
      iex> Storia.Storage.delete_file("pdfs/uuid-123.pdf")
      :ok
  """
  def delete_file(key) do
    case S3.delete_object(@bucket, key) |> ExAws.request() do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, "Failed to delete file: #{inspect(reason)}"}
    end
  end

  @doc """
  Extracts the R2 key from a full URL.
  
  ## Examples
      iex> Storia.Storage.extract_key_from_url("https://account.r2.cloudflarestorage.com/storia-dev/pdfs/uuid-123.pdf")
      "pdfs/uuid-123.pdf"
  """
  def extract_key_from_url(url) when is_binary(url) do
    uri = URI.parse(url)
    
    case uri.path do
      "/" <> path ->
        # Remove bucket name from path if present
        path
        |> String.split("/", parts: 2)
        |> List.last()
      _ -> 
        nil
    end
  end

  # Private functions

  defp upload_file(file_path, key, content_type) do
    case File.read(file_path) do
      {:ok, file_content} ->
        file_content
        |> S3.put_object(@bucket, key, content_type: content_type)
        |> ExAws.request()
        |> case do
          {:ok, _} -> {:ok, build_public_url(key)}
          {:error, reason} -> {:error, "Upload failed: #{inspect(reason)}"}
        end
      
      {:error, reason} ->
        {:error, "Failed to read file: #{inspect(reason)}"}
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

  defp build_public_url(key) do
    endpoint = System.get_env("R2_ENDPOINT", "")
    "https://#{endpoint}/#{@bucket}/#{key}"
  end
end
