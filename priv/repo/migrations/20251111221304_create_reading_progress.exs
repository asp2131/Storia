defmodule Storia.Repo.Migrations.CreateReadingProgress do
  use Ecto.Migration

  def change do
    create table(:reading_progress) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :book_id, references(:books, on_delete: :delete_all), null: false
      add :current_page, :integer, null: false, default: 1
      add :last_read_at, :utc_datetime

      timestamps()
    end

    create unique_index(:reading_progress, [:user_id, :book_id])
    create index(:reading_progress, [:user_id])
  end
end
