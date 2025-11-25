defmodule RustReader do
  @moduledoc """
  NIF wrapper for Rust-based PDF extraction using extractous.
  """
  use Rustler, otp_app: :storia, crate: "rustreader"

  @doc """
  Extracts text content and metadata from a PDF file.

  Returns `{:ok, {content, metadata}}` on success or `{:error, reason}` on failure.
  """
  def extract_pdf(_path), do: :erlang.nif_error(:nif_not_loaded)
end
