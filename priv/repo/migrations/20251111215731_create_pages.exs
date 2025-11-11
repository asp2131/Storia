defmodule Storia.Repo.Migrations.CreatePages do
  use Ecto.Migration

  def change do
    create table(:pages) do
      add :book_id, references(:books, on_delete: :delete_all), null: false
      add :page_number, :integer, null: false
      add :text_content, :text

      timestamps()
    end

    create unique_index(:pages, [:book_id, :page_number])
  end
end
