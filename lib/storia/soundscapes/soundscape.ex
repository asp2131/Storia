defmodule Storia.Soundscapes.Soundscape do
  use Ecto.Schema
  import Ecto.Changeset

  schema "soundscapes" do
    field :audio_url, :string
    field :source_type, :string, default: "curated"
    field :confidence_score, :float
    field :admin_approved, :boolean, default: false
    field :tags, :map, default: %{}

    belongs_to :scene, Storia.Content.Scene

    timestamps()
  end

  @doc false
  def changeset(soundscape, attrs) do
    soundscape
    |> cast(attrs, [:audio_url, :source_type, :confidence_score, :admin_approved, :tags, :scene_id])
    |> validate_required([:audio_url])
    |> validate_inclusion(:source_type, ["curated", "generated"])
    |> validate_number(:confidence_score,
      greater_than_or_equal_to: 0.0,
      less_than_or_equal_to: 1.0
    )
    |> validate_tags()
    |> foreign_key_constraint(:scene_id)
  end

  defp validate_tags(changeset) do
    tags = get_field(changeset, :tags)

    if tags && is_map(tags) do
      valid_keys = ["mood", "setting", "intensity", "weather", "time_of_day"]
      tag_keys = Map.keys(tags)

      if Enum.all?(tag_keys, &(&1 in valid_keys)) do
        changeset
      else
        add_error(changeset, :tags, "contains invalid keys")
      end
    else
      changeset
    end
  end
end
