defmodule Storia.Repo.Migrations.UpdateBooksAndPagesForChildrenStories do
  use Ecto.Migration

  def change do
    alter table(:books) do
      add :book_type, :string, default: "pdf_book", null: false
    end

    alter table(:pages) do
      add :image_url, :string
      add :narration_url, :string
      add :narration_timestamps, :map
    end
  end
end
