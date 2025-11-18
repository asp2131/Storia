defmodule Storia.Soundscapes do
  @moduledoc """
  The Soundscapes context handles soundscape management.
  """

  import Ecto.Query, warn: false
  alias Storia.Repo
  alias Storia.Soundscapes.Soundscape

  @doc """
  Returns the list of soundscapes.

  ## Examples

      iex> list_soundscapes()
      [%Soundscape{}, ...]

  """
  def list_soundscapes do
    Soundscape
    |> order_by([s], desc: s.inserted_at)
    |> Repo.all()
  end

  @doc """
  Gets a single soundscape.

  Raises `Ecto.NoResultsError` if the Soundscape does not exist.

  ## Examples

      iex> get_soundscape!(123)
      %Soundscape{}

      iex> get_soundscape!(456)
      ** (Ecto.NoResultsError)

  """
  def get_soundscape!(id), do: Repo.get!(Soundscape, id)

  @doc """
  Creates a soundscape.

  ## Examples

      iex> create_soundscape(%{field: value})
      {:ok, %Soundscape{}}

      iex> create_soundscape(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_soundscape(attrs \\ %{}) do
    %Soundscape{}
    |> Soundscape.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a soundscape.

  ## Examples

      iex> update_soundscape(soundscape, %{field: new_value})
      {:ok, %Soundscape{}}

      iex> update_soundscape(soundscape, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_soundscape(%Soundscape{} = soundscape, attrs) do
    soundscape
    |> Soundscape.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a soundscape.

  ## Examples

      iex> delete_soundscape(soundscape)
      {:ok, %Soundscape{}}

      iex> delete_soundscape(soundscape)
      {:error, %Ecto.Changeset{}}

  """
  def delete_soundscape(%Soundscape{} = soundscape) do
    Repo.delete(soundscape)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking soundscape changes.

  ## Examples

      iex> change_soundscape(soundscape)
      %Ecto.Changeset{data: %Soundscape{}}

  """
  def change_soundscape(%Soundscape{} = soundscape, attrs \\ %{}) do
    Soundscape.changeset(soundscape, attrs)
  end

  @doc """
  Searches soundscapes by tags or generation prompt.

  ## Examples

      iex> search_soundscapes("rain")
      [%Soundscape{}, ...]

  """
  def search_soundscapes(query) when is_binary(query) do
    search_term = "%#{query}%"

    Soundscape
    |> where([s], ilike(s.generation_prompt, ^search_term))
    |> order_by([s], desc: s.inserted_at)
    |> Repo.all()
  end

  @doc """
  Lists soundscapes filtered by source type.

  ## Examples

      iex> list_soundscapes_by_source("ai_generated")
      [%Soundscape{}, ...]

  """
  def list_soundscapes_by_source(source_type) do
    Soundscape
    |> where([s], s.source_type == ^source_type)
    |> order_by([s], desc: s.inserted_at)
    |> Repo.all()
  end

  @doc """
  Assigns a soundscape to a scene by creating a new soundscape record.

  This creates a copy of the soundscape assigned to the new scene, allowing
  the same audio to be used across multiple scenes without conflicts.

  ## Examples

      iex> assign_soundscape_to_scene(scene_id, soundscape_id)
      {:ok, %Soundscape{}}

  """
  def assign_soundscape_to_scene(scene_id, soundscape_id) do
    with {:ok, source_soundscape} <- get_soundscape_safe(soundscape_id),
         {:ok, new_soundscape} <- create_soundscape_copy(source_soundscape, scene_id) do
      {:ok, new_soundscape}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Removes all soundscapes from a scene.

  ## Examples

      iex> clear_scene_soundscapes(scene_id)
      {:ok, count}

  """
  def clear_scene_soundscapes(scene_id) do
    {count, _} =
      Soundscape
      |> where([s], s.scene_id == ^scene_id)
      |> Repo.delete_all()

    {:ok, count}
  end

  @doc """
  Lists all available curated soundscapes from the storage bucket.

  Returns soundscapes organized by category folder.

  ## Examples

      iex> list_curated_soundscapes_from_bucket()
      {:ok, %{
        "magic" => [
          %{name: "Fairy_Chimes.mp3", path: "audio/curated/magic/Fairy_Chimes.mp3", ...},
          ...
        ],
        "movement" => [...],
        ...
      }}
  """
  def list_curated_soundscapes_from_bucket do
    with {:ok, folders} <- Storia.Storage.list_curated_folders() do
      soundscapes_by_category =
        folders
        |> Enum.reduce(%{}, fn folder, acc ->
          case Storia.Storage.list_bucket_files(folder.path) do
            {:ok, files} ->
              Map.put(acc, folder.name, files)

            {:error, _} ->
              acc
          end
        end)

      {:ok, soundscapes_by_category}
    end
  end

  @doc """
  Creates a soundscape record from a bucket file and assigns it to a scene.

  ## Parameters
    - scene_id: The scene to assign the soundscape to
    - file_info: Map with :name, :path, :url from bucket listing
    - category: The category/folder name (e.g., "magic", "movement")

  ## Examples

      iex> create_soundscape_from_bucket(scene_id, %{name: "...", path: "...", url: "..."}, "magic")
      {:ok, %Soundscape{}}
  """
  def create_soundscape_from_bucket(scene_id, file_info, category) do
    # Extract a friendly name and tags from the filename
    file_name = file_info.name
    friendly_name =
      file_name
      |> Path.rootname()
      |> String.replace("_", " ")

    tags = [category, friendly_name]

    %Soundscape{}
    |> Soundscape.changeset(%{
      audio_url: file_info.url,
      source_type: "curated",
      confidence_score: 1.0,  # Curated soundscapes are fully confident
      admin_approved: true,
      tags: tags,
      generation_prompt: "Curated soundscape: #{friendly_name} (#{category})",
      scene_id: scene_id
    })
    |> Repo.insert()
  end

  @doc """
  Imports a curated soundscape from the bucket to a scene.

  This is a convenience function that combines listing and creating.

  ## Parameters
    - scene_id: The scene to assign the soundscape to
    - bucket_path: Full path to the file in the bucket (e.g., "audio/curated/magic/Fairy_Chimes.mp3")

  ## Examples

      iex> import_soundscape_from_bucket(scene_id, "audio/curated/magic/Fairy_Chimes.mp3")
      {:ok, %Soundscape{}}
  """
  def import_soundscape_from_bucket(scene_id, bucket_path) do
    # Parse the path to get category and filename
    case String.split(bucket_path, "/") do
      ["audio", "curated", category, file_name] ->
        file_info = %{
          name: file_name,
          path: bucket_path,
          url: Storia.Storage.build_public_url(bucket_path)
        }

        create_soundscape_from_bucket(scene_id, file_info, category)

      _ ->
        {:error, "Invalid bucket path format. Expected: audio/curated/{category}/{filename}"}
    end
  end

  # Private helpers

  defp get_soundscape_safe(soundscape_id) do
    case Repo.get(Soundscape, soundscape_id) do
      nil -> {:error, :soundscape_not_found}
      soundscape -> {:ok, soundscape}
    end
  end

  defp create_soundscape_copy(source, scene_id) do
    %Soundscape{}
    |> Soundscape.changeset(%{
      audio_url: source.audio_url,
      source_type: source.source_type,
      confidence_score: source.confidence_score,
      admin_approved: true,  # Mark as admin-approved since it's manually assigned
      tags: source.tags,
      generation_prompt: source.generation_prompt,
      scene_id: scene_id
    })
    |> Repo.insert()
  end
end
