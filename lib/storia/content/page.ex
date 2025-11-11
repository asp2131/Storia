defmodule Storia.Content.Page do
  use Ecto.Schema
  import Ecto.Changeset

  schema "pages" do
    field :page_number, :integer
    field :text_content, :string

    belongs_to :book, Storia.Content.Book
    belongs_to :scene, Storia.Content.Scene

    timestamps()
  end

  @doc false
  def changeset(page, attrs) do
    page
    |> cast(attrs, [:page_number, :text_content, :book_id, :scene_id])
    |> validate_required([:page_number, :book_id])
    |> validate_number(:page_number, greater_than: 0)
    |> foreign_key_constraint(:book_id)
    |> foreign_key_constraint(:scene_id)
    |> unique_constraint([:book_id, :page_number])
  end
end
