defmodule Storia.Repo.Migrations.AddCascadeDeletes do
  use Ecto.Migration

  def up do
    # Drop existing foreign key constraints
    drop_if_exists constraint(:pages, "pages_book_id_fkey")
    drop_if_exists constraint(:scenes, "scenes_book_id_fkey")
    drop_if_exists constraint(:soundscapes, "soundscapes_scene_id_fkey")
    drop_if_exists constraint(:reading_progress, "reading_progress_book_id_fkey")
    drop_if_exists constraint(:reading_progress, "reading_progress_user_id_fkey")

    # Add foreign key constraints with cascade deletes
    alter table(:pages) do
      modify :book_id, references(:books, on_delete: :delete_all), from: references(:books)
    end

    alter table(:scenes) do
      modify :book_id, references(:books, on_delete: :delete_all), from: references(:books)
    end

    alter table(:soundscapes) do
      modify :scene_id, references(:scenes, on_delete: :delete_all), from: references(:scenes)
    end

    alter table(:reading_progress) do
      modify :book_id, references(:books, on_delete: :delete_all), from: references(:books)
      modify :user_id, references(:users, on_delete: :delete_all), from: references(:users)
    end

    # Add indices for better query performance
    create_if_not_exists index(:pages, [:book_id])
    create_if_not_exists index(:scenes, [:book_id])
    create_if_not_exists index(:soundscapes, [:scene_id])
    create_if_not_exists index(:reading_progress, [:book_id])
    create_if_not_exists index(:reading_progress, [:user_id])
  end

  def down do
    # Drop the new foreign key constraints
    drop_if_exists constraint(:pages, "pages_book_id_fkey")
    drop_if_exists constraint(:scenes, "scenes_book_id_fkey")
    drop_if_exists constraint(:soundscapes, "soundscapes_scene_id_fkey")
    drop_if_exists constraint(:reading_progress, "reading_progress_book_id_fkey")
    drop_if_exists constraint(:reading_progress, "reading_progress_user_id_fkey")

    # Restore original foreign key constraints without cascade
    alter table(:pages) do
      modify :book_id, references(:books), from: references(:books, on_delete: :delete_all)
    end

    alter table(:scenes) do
      modify :book_id, references(:books), from: references(:books, on_delete: :delete_all)
    end

    alter table(:soundscapes) do
      modify :scene_id, references(:scenes), from: references(:scenes, on_delete: :delete_all)
    end

    alter table(:reading_progress) do
      modify :book_id, references(:books), from: references(:books, on_delete: :delete_all)
      modify :user_id, references(:users), from: references(:users, on_delete: :delete_all)
    end
  end
end
