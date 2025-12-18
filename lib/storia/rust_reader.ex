defmodule RustReader do
  @moduledoc """
  NIF wrapper for Rust-based PDF extraction using extractous.
  Uses lazy loading to prevent boot failures when native library is unavailable.
  """

  require Logger

  @on_load :load_nif

  def load_nif do
    case :erlang.load_nif(nif_path(), 0) do
      :ok -> :ok
      {:error, {:reload, _}} -> :ok
      {:error, {:upgrade, _}} -> :ok
      {:error, reason} ->
        Logger.warning("RustReader NIF not loaded: #{inspect(reason)}")
        :ok
    end
  end

  @doc """
  Extracts text content and metadata from a PDF file.

  Returns `{pages_json_list, metadata_string}` on success.
  Returns `{:error, :nif_not_available}` if the native library cannot be loaded.
  Each string in `pages_json_list` is a JSON object with `page_number` and `text_content`.
  """
  def extract_pdf(_path), do: :erlang.nif_error(:nif_not_loaded)

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
end
