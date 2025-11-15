defmodule Storia.Content.Book do
  use Ecto.Schema
  import Ecto.Changeset

  schema "books" do
    field :title, :string
    field :author, :string
    field :pdf_url, :string
    field :cover_url, :string
    field :description, :string
    field :metadata, :map, default: %{}
    field :total_pages, :integer, default: 0
    field :source_type, :string, default: "public_domain"
    field :is_published, :boolean, default: false
    field :processing_status, :string, default: "pending"
    field :processing_cost, :decimal
    field :processing_error, :string

    has_many :pages, Storia.Content.Page
    has_many :scenes, Storia.Content.Scene
    has_many :reading_progress, Storia.Content.ReadingProgress

    timestamps()
  end

  @doc false
  def changeset(book, attrs) do
    book
    |> cast(attrs, [
      :title,
      :author,
      :pdf_url,
      :cover_url,
      :description,
      :metadata,
      :total_pages,
      :source_type,
      :is_published,
      :processing_status,
      :processing_cost,
      :processing_error
    ])
    |> validate_required([:title, :author])
    |> validate_inclusion(:source_type, ["public_domain", "user_upload", "publisher_verified"])
    |> validate_inclusion(:processing_status, [
      "pending",
      "extracting",
      "analyzing",
      "mapping",
      "ready_for_review",
      "published",
      "failed"
    ])
    |> validate_number(:total_pages, greater_than_or_equal_to: 0)
  end
end
