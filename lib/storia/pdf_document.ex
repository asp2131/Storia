defmodule Storia.PdfDocument do
  @moduledoc """
  Struct and helper functions for working with extracted PDF documents.
  """

  @derive {Jason.Encoder, only: [:content, :metadata]}
  defstruct [:content, :metadata]

  @doc """
  Converts the raw Rust extraction result into a structured PdfDocument.

  ## Examples

      iex> Storia.RustReader.extract_pdf("path/to/file.pdf")
      ...> |> Storia.PdfDocument.from_rustler()
      {:ok, %Storia.PdfDocument{content: "...", metadata: %{...}}}
  """
  def from_rustler({content, metadata_json}) do
    with {:ok, metadata} <- Jason.decode(metadata_json) do
      {:ok,
       %__MODULE__{
         content: String.trim(content),
         metadata: metadata
       }}
    end
  end

  def from_rustler({:error, reason}), do: {:error, reason}
end
