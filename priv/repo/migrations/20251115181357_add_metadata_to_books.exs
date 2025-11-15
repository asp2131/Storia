defmodule Storia.Repo.Migrations.AddMetadataToBooks do
  use Ecto.Migration

  def change do
    alter table(:books) do
      add :metadata, :map, default: %{}
      add :cover_url, :string
      add :description, :text
    end

    # Add GIN index for fast JSONB queries on metadata (genre filtering)
    create index(:books, [:metadata], using: :gin)
  end
end
