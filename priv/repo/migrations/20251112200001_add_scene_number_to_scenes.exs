defmodule Storia.Repo.Migrations.AddSceneNumberToScenes do
  use Ecto.Migration

  def change do
    alter table(:scenes) do
      add :scene_number, :integer
    end

    create index(:scenes, [:book_id, :scene_number])
  end
end
