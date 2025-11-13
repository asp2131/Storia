defmodule Storia.Repo.Migrations.AddCascadeDeletes do
  use Ecto.Migration

  def up do
    # Cascade deletes already exist from previous migrations
    # This migration just adds missing indices for performance

    # Add indices for better query performance
    create_if_not_exists index(:pages, [:book_id])
    create_if_not_exists index(:scenes, [:book_id])
    create_if_not_exists index(:soundscapes, [:scene_id])
    create_if_not_exists index(:reading_progress, [:book_id])
    create_if_not_exists index(:reading_progress, [:user_id])
  end

  def down do
    # Keep indices as they're beneficial regardless
    :ok
  end
end
