defmodule Storia.Repo.Migrations.CreateBooks do
  use Ecto.Migration

  def change do
    create table(:books) do
      add :title, :string, null: false
      add :author, :string, null: false
      add :pdf_url, :string
      add :total_pages, :integer, default: 0
      add :source_type, :string, null: false, default: "public_domain"
      add :is_published, :boolean, default: false, null: false
      add :processing_status, :string, default: "pending"
      add :processing_cost, :decimal, precision: 10, scale: 4
      add :processing_error, :text

      timestamps()
    end

    create index(:books, [:is_published])
    create index(:books, [:source_type])
    create index(:books, [:processing_status])
  end
end
