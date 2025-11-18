defmodule StoriaWeb.AdminLive.SceneReview do
  use StoriaWeb, :live_view

  alias Storia.{Content, Soundscapes}

  @impl true
  def mount(%{"id" => book_id}, _session, socket) do
    case Content.get_book_with_scenes_and_soundscapes(book_id) do
      nil ->
        {:ok,
         socket
         |> put_flash(:error, "Book not found")
         |> push_navigate(to: ~p"/admin/books")}

      book ->
        {:ok,
         socket
         |> assign(:page_title, "Scene Review - #{book.title}")
         |> assign(:active_tab, :books)
         |> assign(:book, book)
         |> assign(:selected_scene, nil)
         |> assign(:show_override_modal, false)
         |> assign(:available_soundscapes, [])
         |> assign(:curated_soundscapes, %{})
         |> assign(:selected_category, nil)
         |> assign(:show_curated_browser, false)}
    end
  end

  @impl true
  def handle_params(_params, _url, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_event("select_scene", %{"scene_id" => scene_id}, socket) do
    scene_id = String.to_integer(scene_id)
    scene = Enum.find(socket.assigns.book.scenes, &(&1.id == scene_id))

    {:noreply, assign(socket, :selected_scene, scene)}
  end

  @impl true
  def handle_event("show_override_modal", %{"scene_id" => scene_id}, socket) do
    scene_id = String.to_integer(scene_id)
    scene = Enum.find(socket.assigns.book.scenes, &(&1.id == scene_id))

    # Load available soundscapes for override (existing AI-generated ones)
    soundscapes = Soundscapes.list_soundscapes()

    # Load curated soundscapes from bucket (with error handling)
    curated_soundscapes =
      case Soundscapes.list_curated_soundscapes_from_bucket() do
        {:ok, soundscapes} -> soundscapes
        {:error, _} -> %{}
      end

    {:noreply,
     socket
     |> assign(:selected_scene, scene)
     |> assign(:show_override_modal, true)
     |> assign(:available_soundscapes, soundscapes)
     |> assign(:curated_soundscapes, curated_soundscapes)
     |> assign(:selected_category, nil)
     |> assign(:show_curated_browser, false)}
  end

  @impl true
  def handle_event("hide_override_modal", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_override_modal, false)
     |> assign(:selected_scene, nil)}
  end

  @impl true
  def handle_event("toggle_curated_browser", _params, socket) do
    {:noreply, assign(socket, :show_curated_browser, !socket.assigns.show_curated_browser)}
  end

  @impl true
  def handle_event("select_category", %{"category" => category}, socket) do
    {:noreply, assign(socket, :selected_category, category)}
  end

  @impl true
  def handle_event("import_curated_soundscape", %{"path" => bucket_path}, socket) do
    scene = socket.assigns.selected_scene

    # Clear existing soundscapes from scene
    Soundscapes.clear_scene_soundscapes(scene.id)

    # Import the curated soundscape
    case Soundscapes.import_soundscape_from_bucket(scene.id, bucket_path) do
      {:ok, _soundscape} ->
        {:noreply,
         socket
         |> put_flash(:info, "Curated soundscape successfully assigned to scene #{scene.scene_number}")
         |> assign(:show_override_modal, false)
         |> assign(:show_curated_browser, false)
         |> assign(:selected_scene, nil)
         |> assign(:selected_category, nil)
         |> reload_book()}

      {:error, reason} ->
        {:noreply,
         socket
         |> put_flash(:error, "Failed to import soundscape: #{inspect(reason)}")
         |> assign(:show_override_modal, false)}
    end
  end

  @impl true
  def handle_event("override_soundscape", %{"soundscape_id" => soundscape_id}, socket) do
    scene = socket.assigns.selected_scene
    soundscape_id = String.to_integer(soundscape_id)

    # Clear existing soundscapes from scene
    Soundscapes.clear_scene_soundscapes(scene.id)

    # Assign the new soundscape to the scene
    case Soundscapes.assign_soundscape_to_scene(scene.id, soundscape_id) do
      {:ok, _new_soundscape} ->
        {:noreply,
         socket
         |> put_flash(:info, "Soundscape successfully assigned to scene #{scene.scene_number}")
         |> assign(:show_override_modal, false)
         |> assign(:selected_scene, nil)
         |> reload_book()}

      {:error, :soundscape_not_found} ->
        {:noreply,
         socket
         |> put_flash(:error, "Selected soundscape not found")
         |> assign(:show_override_modal, false)}

      {:error, _reason} ->
        {:noreply,
         socket
         |> put_flash(:error, "Failed to assign soundscape to scene")
         |> assign(:show_override_modal, false)}
    end
  end

  @impl true
  def handle_event("publish_book", _params, socket) do
    book = socket.assigns.book

    # Validate all scenes have soundscapes
    scenes_without_soundscapes =
      Enum.filter(book.scenes, fn scene ->
        Enum.empty?(scene.soundscapes)
      end)

    if Enum.empty?(scenes_without_soundscapes) do
      case Content.update_book(book, %{is_published: true, processing_status: "published"}) do
        {:ok, _book} ->
          {:noreply,
           socket
           |> put_flash(:info, "Book published successfully!")
           |> push_navigate(to: ~p"/admin/books")}

        {:error, _changeset} ->
          {:noreply, put_flash(socket, :error, "Failed to publish book")}
      end
    else
      {:noreply,
       put_flash(
         socket,
         :error,
         "Cannot publish: #{length(scenes_without_soundscapes)} scene(s) missing soundscapes"
       )}
    end
  end

  @impl true
  def handle_event("noop", _params, socket) do
    {:noreply, socket}
  end

  defp reload_book(socket) do
    book = Content.get_book_with_scenes_and_soundscapes!(socket.assigns.book.id)
    assign(socket, :book, book)
  end

  defp format_descriptors(descriptors) when is_map(descriptors) do
    descriptors
    |> Enum.map(fn {key, value} ->
      "#{String.capitalize(key)}: #{value}"
    end)
    |> Enum.join(" • ")
  end

  defp format_descriptors(_), do: "No descriptors"

  defp scene_color(index) do
    colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-yellow-500",
      "bg-indigo-500",
      "bg-red-500",
      "bg-orange-500"
    ]

    Enum.at(colors, rem(index, length(colors)))
  end

  defp scene_coverage_percent(book) do
    total_pages = book.total_pages || 0

    if total_pages > 0 do
      pages_with_scenes =
        book.scenes
        |> Enum.map(fn scene -> scene.end_page - scene.start_page + 1 end)
        |> Enum.sum()

      round(pages_with_scenes / total_pages * 100)
    else
      0
    end
  end

  defp soundscape_coverage_percent(book) do
    total_scenes = length(book.scenes)

    if total_scenes > 0 do
      scenes_with_soundscapes =
        book.scenes
        |> Enum.count(fn scene -> !Enum.empty?(scene.soundscapes) end)

      round(scenes_with_soundscapes / total_scenes * 100)
    else
      0
    end
  end
end
