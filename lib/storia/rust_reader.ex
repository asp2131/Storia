defmodule RustReader do
  @moduledoc """
  NIF wrapper for Rust-based PDF extraction using extractous.
  Uses lazy loading to prevent boot failures when native library is unavailable.
  """

  require Logger

  @doc """
  Extracts text content and metadata from a PDF file.

  Returns `{pages_json_list, metadata_string}` on success.
  Returns `{:error, :nif_not_available}` if the native library cannot be loaded.
  Each string in `pages_json_list` is a JSON object with `page_number` and `text_content`.
  """
  def extract_pdf(path) do
    case ensure_loaded() do
      :ok ->
        do_extract_pdf(path)

      {:error, reason} ->
        Logger.warning("RustReader NIF not available: #{inspect(reason)}")
        {:error, :nif_not_available}
    end
  rescue
    e ->
      Logger.warning("RustReader NIF extraction failed: #{inspect(e)}")
      {:error, :nif_not_available}
  end

  # Attempts to load the NIF, returns :ok or {:error, reason}
  defp ensure_loaded do
    case :erlang.load_nif(nif_path(), 0) do
      :ok ->
        :ok

      {:error, {:reload, _}} ->
        # Already loaded
        :ok

      {:error, {:upgrade, _}} ->
        # Already loaded, different version
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Returns the path to the compiled NIF library
  defp nif_path do
    case :code.priv_dir(:storia) do
      {:error, _} ->
        # Fallback for development
        Path.join([File.cwd!(), "priv", "native", "rustreader"])
        |> String.to_charlist()

      priv_dir ->
        Path.join([priv_dir, "native", "rustreader"])
        |> String.to_charlist()
    end
  end

  # NIF stub - will be replaced by native implementation when loaded
  defp do_extract_pdf(_path), do: :erlang.nif_error(:nif_not_loaded)
end
