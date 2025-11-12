defmodule Storia.Soundscapes.Soundscape do
  use Ecto.Schema
  import Ecto.Changeset

  schema "soundscapes" do
    field :audio_url, :string
    field :source_type, :string, default: "curated"
    field :confidence_score, :float
    field :admin_approved, :boolean, default: false
    field :tags, {:array, :string}, default: []
    field :generation_prompt, :string

    belongs_to :scene, Storia.Content.Scene

    timestamps()
  end

  @doc false
  def changeset(soundscape, attrs) do
    soundscape
    |> cast(attrs, [:audio_url, :source_type, :confidence_score, :admin_approved, :tags, :generation_prompt, :scene_id])
    |> validate_required([:audio_url])
    |> validate_inclusion(:source_type, ["curated", "ai_generated"])
    |> validate_number(:confidence_score,
      greater_than_or_equal_to: 0.0,
      less_than_or_equal_to: 1.0
    )
    |> foreign_key_constraint(:scene_id)
  end
end
