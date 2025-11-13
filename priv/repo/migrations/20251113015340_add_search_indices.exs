defmodule Storia.Repo.Migrations.AddSearchIndices do
  use Ecto.Migration

  def up do
    # Enable pg_trgm extension for better text search
    execute "CREATE EXTENSION IF NOT EXISTS pg_trgm"

    # Add GIN indices for faster ILIKE searches on books
    create index(:books, [:title], using: :gin, prefix: :gin_trgm_ops)
    create index(:books, [:author], using: :gin, prefix: :gin_trgm_ops)

    # Add composite index for title and author search
    execute """
    CREATE INDEX books_title_author_gin_idx
    ON books
    USING gin((title || ' ' || author) gin_trgm_ops)
    """

    # Add index for processing status (frequently queried)
    create_if_not_exists index(:books, [:processing_status])

    # Add index for is_published flag
    create_if_not_exists index(:books, [:is_published])

    # Add composite index for published books ordered by updated_at
    create index(:books, [:is_published, :updated_at])

    # Add GIN index for soundscape generation_prompt search
    create index(:soundscapes, [:generation_prompt], using: :gin, prefix: :gin_trgm_ops)

    # Add index for soundscape source_type (for filtering)
    create_if_not_exists index(:soundscapes, [:source_type])

    # Add GIN index for tags array search
    execute """
    CREATE INDEX soundscapes_tags_gin_idx
    ON soundscapes
    USING gin(tags)
    """

    # Add index for user email (for login lookups)
    create_if_not_exists index(:users, [:email])

    # Add index for user role (for admin checks)
    create_if_not_exists index(:users, [:role])
  end

  def down do
    # Drop custom indices
    drop_if_exists index(:books, [:title], using: :gin)
    drop_if_exists index(:books, [:author], using: :gin)
    execute "DROP INDEX IF EXISTS books_title_author_gin_idx"
    drop_if_exists index(:books, [:processing_status])
    drop_if_exists index(:books, [:is_published])
    drop_if_exists index(:books, [:is_published, :updated_at])

    drop_if_exists index(:soundscapes, [:generation_prompt], using: :gin)
    drop_if_exists index(:soundscapes, [:source_type])
    execute "DROP INDEX IF EXISTS soundscapes_tags_gin_idx"

    drop_if_exists index(:users, [:email])
    drop_if_exists index(:users, [:role])

    # Note: We don't drop pg_trgm extension as it might be used by other apps
    # execute "DROP EXTENSION IF EXISTS pg_trgm"
  end
end
