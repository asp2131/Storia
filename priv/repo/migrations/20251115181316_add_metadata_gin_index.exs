defmodule Storia.Repo.Migrations.AddMetadataGinIndex do
  use Ecto.Migration

  def change do
    # This migration intentionally left empty - metadata index will be created
    # in the add_metadata_to_books migration to ensure proper ordering
  end
end
