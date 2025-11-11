defmodule Storia.Repo.Migrations.CreateSoundscapes do
  use Ecto.Migration

  def change do
    create table(:soundscapes) do
      add :scene_id, references(:scenes, on_delete: :delete_all)
      add :audio_url, :string, null: false
      add :source_type, :string, null: false, default: "curated"
      add :confidence_score, :float
      add :admin_approved, :boolean, default: false, null: false
      add :tags, :map, default: %{}

      timestamps()
    end

    create index(:soundscapes, [:scene_id])
    create index(:soundscapes, [:source_type])
    create index(:soundscapes, [:admin_approved])
  end
end
