defmodule Storia.Repo.Migrations.AddGenerationPromptToSoundscapes do
  use Ecto.Migration

  def change do
    alter table(:soundscapes) do
      add :generation_prompt, :text
      # Change tags from map to array of strings
      remove :tags
      add :tags, {:array, :string}, default: []
    end

    # Update source_type to include "ai_generated"
    execute(
      "ALTER TABLE soundscapes DROP CONSTRAINT IF EXISTS soundscapes_source_type_check",
      "ALTER TABLE soundscapes ADD CONSTRAINT soundscapes_source_type_check CHECK (source_type IN ('curated', 'generated'))"
    )
  end
end
