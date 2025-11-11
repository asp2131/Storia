defmodule Storia.Repo.Migrations.CreateScenes do
  use Ecto.Migration

  def change do
    create table(:scenes) do
      add :book_id, references(:books, on_delete: :delete_all), null: false
      add :start_page, :integer, null: false
      add :end_page, :integer, null: false
      add :descriptors, :map, default: %{}

      timestamps()
    end

    create index(:scenes, [:book_id])
    create index(:scenes, [:book_id, :start_page, :end_page])
  end
end
