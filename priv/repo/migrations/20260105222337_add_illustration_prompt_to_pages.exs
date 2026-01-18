defmodule Storia.Repo.Migrations.AddIllustrationPromptToPages do
  use Ecto.Migration

  def change do
    alter table(:pages) do
      add :illustration_prompt, :text
    end
  end
end
