defmodule StoriaWeb.ReaderLive do
  use StoriaWeb, :live_view

  alias Storia.{Content, Accounts}

  @impl true
  def mount(%{"id" => book_id}, _session, socket) do
    user = socket.assigns.current_user
    book_id = String.to_integer(book_id)

    # Check access permissions
    unless can_access_book?(user, book_id) do
      {:ok,
       socket
       |> put_flash(:error, "You don't have access to this book.")
       |> push_navigate(to: ~p"/library")}
    else
      # Load book and reading progress
      case load_book_data(user.id, book_id) do
        {:ok, data} ->
          {:ok,
           socket
           |> assign(:book, data.book)
           |> assign(:current_page, data.current_page)
           |> assign(:page_content, data.page_content)
           |> assign(:current_scene, data.current_scene)
           |> assign(:audio_url, data.audio_url)
           |> assign(:total_pages, data.book.total_pages)
           |> assign(:page_title, data.book.title)
           |> assign(:audio_enabled, true)
           |> assign(:playing, true)
           |> assign(:volume, 0.7)
           |> assign(:navigating, false)}

        {:error, :book_not_found} ->
          {:ok,
           socket
           |> put_flash(:error, "Book not found.")
           |> push_navigate(to: ~p"/library")}

        {:error, :not_published} ->
          {:ok,
           socket
           |> put_flash(:error, "This book is not yet available.")
           |> push_navigate(to: ~p"/library")}
      end
    end
  end

  @impl true
  def handle_event("next_page", _params, socket) do
    # Prevent race conditions from rapid clicking
    if socket.assigns[:navigating] do
      {:noreply, socket}
    else
      current_page = socket.assigns.current_page
      total_pages = socket.assigns.total_pages

      if current_page < total_pages do
        socket
        |> assign(:navigating, true)
        |> navigate_to_page(current_page + 1)
      else
        {:noreply, socket}
      end
    end
  end

  def handle_event("previous_page", _params, socket) do
    # Prevent race conditions from rapid clicking
    if socket.assigns[:navigating] do
      {:noreply, socket}
    else
      current_page = socket.assigns.current_page

      if current_page > 1 do
        socket
        |> assign(:navigating, true)
        |> navigate_to_page(current_page - 1)
      else
        {:noreply, socket}
      end
    end
  end

  def handle_event("go_to_page", %{"page" => page_str}, socket) do
    case Integer.parse(page_str) do
      {page, _} when page >= 1 and page <= socket.assigns.total_pages ->
        navigate_to_page(socket, page)

      _ ->
        {:noreply, put_flash(socket, :error, "Invalid page number")}
    end
  end

  def handle_event("toggle_audio", _params, socket) do
    {:noreply, assign(socket, :audio_enabled, !socket.assigns.audio_enabled)}
  end

  def handle_event("toggle_playback", _params, socket) do
    {:noreply, assign(socket, :playing, !socket.assigns.playing)}
  end

  def handle_event("update_volume", %{"volume" => volume_str}, socket) do
    case Float.parse(volume_str) do
      {volume, _} when volume >= 0.0 and volume <= 1.0 ->
        {:noreply, assign(socket, :volume, volume)}

      _ ->
        {:noreply, socket}
    end
  end

  def handle_event("save_progress", %{"page" => page_str}, socket) do
    case Integer.parse(page_str) do
      {page, _} ->
        user_id = socket.assigns.current_user.id
        book_id = socket.assigns.book.id

        # Save progress asynchronously
        Task.start(fn ->
          case Content.update_reading_progress(user_id, book_id, page) do
            {:ok, _progress} ->
              :ok

            {:error, changeset} ->
              require Logger

              Logger.error(
                "Failed to update reading progress for user=#{user_id} book=#{book_id} page=#{page}: #{inspect(changeset.errors)}"
              )
          end
        end)

        {:noreply, socket}

      _ ->
        {:noreply, socket}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div
      class="min-h-screen bg-[#0a0e1a]"
      id="reader-container"
    >
      <!-- Header -->
      <div class="bg-[#101322] border-b border-[#232948] sticky top-0 z-10">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <%= if Accounts.admin?(@current_user) do %>
                <.link
                  navigate={~p"/admin/books"}
                  class="text-[#929bc9] hover:text-white flex items-center gap-2 transition text-sm"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Admin
                </.link>
              <% end %>
              <.link
                navigate={~p"/library"}
                class="text-[#929bc9] hover:text-white flex items-center gap-2 transition"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Library
              </.link>
            </div>

            <div class="flex items-center gap-4">
              <!-- Audio Controls -->
              <div class="flex items-center gap-2">
                <!-- Play/Pause Button -->
                <button
                  phx-click="toggle_playback"
                  class="p-2 text-[#929bc9] hover:text-white rounded-lg hover:bg-[#232948] transition"
                  title={if @playing, do: "Pause audio", else: "Play audio"}
                >
                  <%= if @playing do %>
                    <!-- Pause Icon -->
                    <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  <% else %>
                    <!-- Play Icon -->
                    <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                    </svg>
                  <% end %>
                </button>

                <!-- Mute/Unmute Button -->
                <button
                  phx-click="toggle_audio"
                  class="p-2 text-[#929bc9] hover:text-white rounded-lg hover:bg-[#232948] transition"
                  title={if @audio_enabled, do: "Mute audio", else: "Unmute audio"}
                >
                  <%= if @audio_enabled do %>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  <% else %>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  <% end %>
                </button>

                <form phx-change="update_volume" class="flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={@volume}
                    name="volume"
                    class="w-24"
                  />
                </form>
              </div>

              <!-- Page Navigation -->
              <div class="flex items-center gap-2 text-sm">
                <span class="text-[#929bc9]">Page</span>
                <form phx-submit="go_to_page">
                  <input
                    type="number"
                    min="1"
                    max={@total_pages}
                    value={@current_page}
                    name="page"
                    class="w-16 px-2 py-1 bg-[#232948] border border-[#232948] text-white rounded text-center focus:ring-2 focus:ring-[#1337ec]"
                  />
                </form>
                <span class="text-[#929bc9]">of <%= @total_pages %></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Book Content -->
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="bg-[#101322] rounded-lg p-8 md:p-12">
          <!-- Book Title -->
          <div class="mb-8 text-center border-b border-[#232948] pb-6">
            <h1 class="text-3xl font-serif font-bold text-white mb-2">
              <%= @book.title %>
            </h1>
            <p class="text-lg text-[#929bc9]">
              by <%= @book.author %>
            </p>
          </div>

          <!-- Page Content -->
          <div
            class="prose prose-lg prose-invert max-w-none text-[#e5e7eb]"
            style="font-family: 'Georgia', serif; line-height: 1.8; font-size: 1.125rem;"
          >
            <%= if @page_content do %>
              <%= raw(HtmlSanitizeEx.basic_html(format_page_content(@page_content))) %>
            <% else %>
              <p class="text-[#929bc9] italic">Loading page content...</p>
            <% end %>
          </div>

          <!-- Navigation Buttons -->
          <div class="mt-12 flex items-center justify-between border-t border-[#232948] pt-6">
            <button
              phx-click="previous_page"
              disabled={@current_page == 1}
              class="px-6 py-3 bg-[#232948] text-white rounded-lg hover:bg-opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
            >
              ← Previous
            </button>

            <span class="text-sm text-[#929bc9]">
              Page <%= @current_page %> of <%= @total_pages %>
            </span>

            <button
              phx-click="next_page"
              disabled={@current_page == @total_pages}
              class="px-6 py-3 bg-[#1337ec] text-white rounded-lg hover:bg-opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition font-medium"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <div
        id="audio-crossfade"
        phx-hook="AudioCrossfade"
        data-audio-url={@audio_url || ""}
        data-audio-enabled={"#{@audio_enabled}"}
        data-playing={"#{@playing}"}
        data-volume={@volume}
      ></div>
    </div>
    """
  end

  # Private functions

  defp load_book_data(user_id, book_id) do
    with {:ok, book} <- get_book(book_id),
         {:ok, progress} <- Content.get_or_create_reading_progress(user_id, book_id),
         page <- Content.get_page_with_scene(book_id, progress.current_page),
         scene <- Content.get_scene_for_page(book_id, progress.current_page) do
      audio_url = get_audio_url(scene)

      {:ok,
       %{
         book: book,
         current_page: progress.current_page,
         page_content: page && page.text_content,
         current_scene: scene,
         audio_url: audio_url
       }}
    else
      {:error, reason} -> {:error, reason}
      nil -> {:error, :page_not_found}
    end
  end

  defp get_book(book_id) do
    case Content.get_book(book_id) do
      nil -> {:error, :book_not_found}
      book ->
        if book.is_published do
          {:ok, book}
        else
          {:error, :not_published}
        end
    end
  end

  defp get_audio_url(nil), do: nil

  defp get_audio_url(scene) do
    if scene.soundscape do
      scene.soundscape.audio_url
    else
      nil
    end
  end

  defp navigate_to_page(socket, new_page) do
    book_id = socket.assigns.book.id
    user_id = socket.assigns.current_user.id

    # Load new page content
    page = Content.get_page_with_scene(book_id, new_page)

    # Check if page exists
    if is_nil(page) do
      {:noreply,
       socket
       |> put_flash(:error, "Page #{new_page} not found")
       |> assign(:navigating, false)}
    else
      scene = Content.get_scene_for_page(book_id, new_page)
      audio_url = get_audio_url(scene)

      # Update progress asynchronously
      Task.start(fn ->
        case Content.update_reading_progress(user_id, book_id, new_page) do
          {:ok, _progress} ->
            :ok

          {:error, changeset} ->
            require Logger

            Logger.error(
              "Failed to update reading progress for user=#{user_id} book=#{book_id} page=#{new_page}: #{inspect(changeset.errors)}"
            )
        end
      end)

      socket =
        socket
        |> assign(:current_page, new_page)
        |> assign(:page_content, page.text_content)
        |> assign(:current_scene, scene)
        |> assign(:audio_url, audio_url)
        |> assign(:navigating, false)

      {:noreply, socket}
    end
  end

  defp can_access_book?(user, book_id) do
    # Admins have unlimited access
    if Accounts.admin?(user) do
      true
    else
      # Check if user already has progress on this book
      existing_progress = Content.get_reading_progress(user.id, book_id)

      if existing_progress do
        true
      else
        # Check subscription limits
        case user.subscription_tier do
          :free -> Content.count_accessed_books(user.id) < 3
          :reader -> Content.count_monthly_books(user.id) < 20
          :bibliophile -> true
          _ -> false
        end
      end
    end
  end

  defp format_page_content(content) do
    content
    |> String.replace("\n\n", "</p><p class='mb-4'>")
    |> then(&("<p class='mb-4'>" <> &1 <> "</p>"))
  end
end
