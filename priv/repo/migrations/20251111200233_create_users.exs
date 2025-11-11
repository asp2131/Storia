defmodule Storia.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    create table(:users) do
      add :email, :string, null: false
      add :password_hash, :string, null: false
      add :subscription_tier, :string, null: false, default: "free"
      add :stripe_customer_id, :string
      add :subscription_status, :string
      add :role, :string, null: false, default: "user"

      timestamps()
    end

    create unique_index(:users, [:email])
  end
end
