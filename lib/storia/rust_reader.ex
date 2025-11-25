defmodule RustReader do
  @moduledoc """
  NIF wrapper for Rust-based PDF extraction using extractous.
  """
  use Rustler, otp_app: :storia, crate: "rustreader"

  @doc """
  Extracts text content and metadata from a PDF file.

  Returns `{:ok, {pages_json_list, metadata_string}}` on success.
  Each string in `pages_json_list` is a JSON object with `page_number` and `text_content`.
  """
  def extract_pdf(_path), do: :erlang.nif_error(:nif_not_loaded)
end
