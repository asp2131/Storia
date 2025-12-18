defmodule Storia.Content.Scene do
  use Ecto.Schema
  import Ecto.Changeset

  schema "scenes" do
    field :scene_number, :integer
    field :start_page, :integer
    field :end_page, :integer
    field :descriptors, :map, default: %{}

    belongs_to :book, Storia.Content.Book
    has_many :pages, Storia.Content.Page
    has_one :soundscape, Storia.Soundscapes.Soundscape

    timestamps()
  end

  @doc false
  def changeset(scene, attrs) do
    scene
    |> cast(attrs, [:scene_number, :start_page, :end_page, :descriptors, :book_id])
    |> validate_required([:start_page, :end_page, :book_id])
    |> validate_number(:scene_number, greater_than: 0)
    |> validate_number(:start_page, greater_than: 0)
    |> validate_number(:end_page, greater_than: 0)
    |> validate_page_range()
    |> validate_descriptors()
    |> foreign_key_constraint(:book_id)
  end

  defp validate_page_range(changeset) do
    start_page = get_field(changeset, :start_page)
    end_page = get_field(changeset, :end_page)

    if start_page && end_page && start_page > end_page do
      add_error(changeset, :end_page, "must be greater than or equal to start_page")
    else
      changeset
    end
  end

  defp validate_descriptors(changeset) do
    descriptors = get_field(changeset, :descriptors)

    if descriptors && is_map(descriptors) do
      valid_keys = ["setting", "mood", "weather", "time_of_day", "activity_level", "atmosphere", "scene_type", "dominant_elements"]
      descriptor_keys = Map.keys(descriptors)

      if Enum.all?(descriptor_keys, &(&1 in valid_keys)) do
        changeset
      else
        add_error(changeset, :descriptors, "contains invalid keys")
      end
    else
      changeset
    end
  end
end
