defmodule Storia.Repo.Migrations.AddSceneIdToPages do
  use Ecto.Migration

  def change do
    alter table(:pages) do
      add :scene_id, references(:scenes, on_delete: :nilify_all)
    end

    create index(:pages, [:scene_id])
  end
end
