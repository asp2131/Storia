defmodule Storia.Content.ReadingProgress do
  use Ecto.Schema
  import Ecto.Changeset

  schema "reading_progress" do
    field :current_page, :integer, default: 1
    field :last_read_at, :utc_datetime

    belongs_to :user, Storia.Accounts.User
    belongs_to :book, Storia.Content.Book

    timestamps()
  end

  @doc false
  def changeset(reading_progress, attrs) do
    reading_progress
    |> cast(attrs, [:current_page, :last_read_at, :user_id, :book_id])
    |> validate_required([:current_page, :user_id, :book_id])
    |> validate_number(:current_page, greater_than: 0)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:book_id)
    |> unique_constraint([:user_id, :book_id])
  end
end
