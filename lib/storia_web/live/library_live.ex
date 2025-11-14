defmodule StoriaWeb.LibraryLive do
  use StoriaWeb, :live_view

  alias Storia.{Content, Accounts}

  @per_page 10

  @impl true
  def mount(_params, _session, socket) do
    books = Content.list_published_books()
    user = socket.assigns.current_user

    # Calculate book access limits based on subscription tier
    {books_accessed, limit, can_access_more} = calculate_access_limits(user)

    {:ok,
     socket
     |> assign(:books, books)
     |> assign(:filtered_books, books)
     |> assign(:genre_filter, nil)
     |> assign(:author_filter, nil)
     |> assign(:sort_by, "recent")
     |> assign(:search_query, nil)
     |> assign(:current_page, 1)
     |> assign(:per_page, @per_page)
     |> assign(:books_accessed, books_accessed)
     |> assign(:book_limit, limit)
     |> assign(:can_access_more, can_access_more)
     |> assign(:page_title, "Library")
     |> paginate_books()}
  end

  @impl true
  def handle_event("filter_by_genre", %{"genre" => genre}, socket) do
    genre = if genre == "", do: nil, else: genre
    apply_filters(socket, genre, socket.assigns.author_filter, socket.assigns.search_query, socket.assigns.sort_by)
  end

  def handle_event("filter_by_author", %{"author" => author}, socket) do
    author = if author == "", do: nil, else: author
    apply_filters(socket, socket.assigns.genre_filter, author, socket.assigns.search_query, socket.assigns.sort_by)
  end

  def handle_event("search", %{"query" => query}, socket) do
    query = if query == "", do: nil, else: query
    apply_filters(socket, socket.assigns.genre_filter, socket.assigns.author_filter, query, socket.assigns.sort_by)
  end

  def handle_event("sort_by", %{"sort" => sort}, socket) do
    apply_filters(socket, socket.assigns.genre_filter, socket.assigns.author_filter, socket.assigns.search_query, sort)
  end

  def handle_event("clear_filters", _params, socket) do
    {:noreply,
     socket
     |> assign(:filtered_books, socket.assigns.books)
     |> assign(:genre_filter, nil)
     |> assign(:author_filter, nil)
     |> assign(:search_query, nil)
     |> assign(:sort_by, "recent")
     |> assign(:current_page, 1)
     |> paginate_books()}
  end

  def handle_event("select_book", %{"book-id" => book_id}, socket) do
    user = socket.assigns.current_user
    book_id = String.to_integer(book_id)

    # Check if user can access this book
    if can_access_book?(user, book_id) do
      {:noreply, push_navigate(socket, to: ~p"/read/#{book_id}")}
    else
      {:noreply,
       socket
       |> put_flash(:error, "You've reached your book limit. Please upgrade to continue reading.")
       |> push_navigate(to: ~p"/subscription")}
    end
  end

  def handle_event("go_to_page", %{"page" => page}, socket) do
    page_num = String.to_integer(page)
    {:noreply, socket |> assign(:current_page, page_num) |> paginate_books()}
  end

  def handle_event("next_page", _params, socket) do
    total_pages = calculate_total_pages(socket.assigns.filtered_books, socket.assigns.per_page)

    if socket.assigns.current_page < total_pages do
      {:noreply, socket |> assign(:current_page, socket.assigns.current_page + 1) |> paginate_books()}
    else
      {:noreply, socket}
    end
  end

  def handle_event("prev_page", _params, socket) do
    if socket.assigns.current_page > 1 do
      {:noreply, socket |> assign(:current_page, socket.assigns.current_page - 1) |> paginate_books()}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="min-h-screen bg-[#0a0e1a]">
      <!-- Navigation Bar -->
      <nav class="bg-[#101322] border-b border-[#232948]">
        <div class="max-w-7xl mx-auto px-6">
          <div class="flex items-center justify-between h-16">
            <!-- Left: Logo and Nav Links -->
            <div class="flex items-center gap-8">
              <.link navigate={~p"/"} class="flex items-center gap-2 text-white font-bold text-lg">
                <svg class="w-6 h-6 text-[#1337ec]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
                Soundscape Books
              </.link>

              <div class="flex items-center gap-6">
                <%= if Accounts.admin?(@current_user) do %>
                  <.link
                    navigate={~p"/admin/books"}
                    class="text-[#929bc9] hover:text-white font-medium text-sm transition flex items-center gap-1"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                      />
                    </svg>
                    Admin Dashboard
                  </.link>
                <% end %>
                <.link navigate={~p"/library"} class="text-white font-medium text-sm">
                  Library
                </.link>
                <.link navigate={~p"/"} class="text-[#929bc9] hover:text-white font-medium text-sm transition">
                  My Profile
                </.link>
              </div>
            </div>

            <!-- Right: Search and Subscribe -->
            <div class="flex items-center gap-4">
              <div class="relative">
                <input
                  type="text"
                  placeholder="Search"
                  phx-change="search"
                  phx-debounce="300"
                  name="query"
                  value={@search_query || ""}
                  class="w-64 h-9 pl-10 pr-4 bg-[#232948] text-white text-sm rounded-lg border-none focus:ring-2 focus:ring-[#1337ec] placeholder:text-[#929bc9]"
                />
                <svg
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#929bc9]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <.link
                navigate={~p"/subscription"}
                class="px-4 py-2 bg-[#1337ec] text-white rounded-lg text-sm font-bold hover:bg-opacity-90 transition"
              >
                Subscribe
              </.link>

              <!-- User Avatar -->
              <div class="w-9 h-9 bg-[#e5e7eb] rounded-full flex items-center justify-center">
                <span class="text-[#0a0e1a] font-bold text-sm">
                  <%= String.first(@current_user.email) |> String.upcase() %>
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <!-- Main Content -->
      <div class="max-w-7xl mx-auto px-6 py-8">
        <!-- Hero Section -->
        <div class="mb-8">
          <h1 class="text-white text-4xl font-black leading-tight tracking-[-0.033em] mb-2">
            Discover Your Next Read
          </h1>
          <p class="text-[#929bc9] text-base font-normal leading-normal">
            Browse, search, and select a book to begin your immersive reading experience.
          </p>
        </div>

        <!-- Filters Row -->
        <div class="flex items-center gap-3 mb-8">
          <!-- Filter by Genre -->
          <div class="relative">
            <select
              id="genre-filter"
              phx-change="filter_by_genre"
              name="genre"
              class="appearance-none h-10 pl-4 pr-10 bg-[#232948] text-white text-sm font-medium rounded-lg border-none focus:ring-2 focus:ring-[#1337ec] hover:bg-opacity-80 cursor-pointer min-w-[160px]"
            >
              <option value="">Filter by Genre</option>
              <option value="fiction" selected={@genre_filter == "fiction"}>Fiction</option>
              <option value="mystery" selected={@genre_filter == "mystery"}>Mystery</option>
              <option value="fantasy" selected={@genre_filter == "fantasy"}>Fantasy</option>
              <option value="science-fiction" selected={@genre_filter == "science-fiction"}>
                Science Fiction
              </option>
              <option value="romance" selected={@genre_filter == "romance"}>Romance</option>
              <option value="thriller" selected={@genre_filter == "thriller"}>Thriller</option>
            </select>
            <svg
              class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          <!-- Filter by Status (placeholder) -->
          <div class="relative">
            <select
              disabled
              class="appearance-none h-10 pl-4 pr-10 bg-[#232948] text-[#929bc9] text-sm font-medium rounded-lg border-none cursor-not-allowed min-w-[160px]"
            >
              <option>Filter by Status</option>
            </select>
            <svg
              class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#929bc9] pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          <!-- Sort by Title -->
          <div class="relative">
            <select
              id="sort-filter"
              phx-change="sort_by"
              name="sort"
              class="appearance-none h-10 pl-4 pr-10 bg-[#232948] text-white text-sm font-medium rounded-lg border-none focus:ring-2 focus:ring-[#1337ec] hover:bg-opacity-80 cursor-pointer min-w-[160px]"
            >
              <option value="title_asc" selected={@sort_by == "title_asc"}>Sort by Title (A-Z)</option>
              <option value="title_desc" selected={@sort_by == "title_desc"}>
                Sort by Title (Z-A)
              </option>
              <option value="author_asc" selected={@sort_by == "author_asc"}>
                Sort by Author (A-Z)
              </option>
              <option value="recent" selected={@sort_by == "recent"}>Recently Added</option>
            </select>
            <svg
              class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          <%= if @genre_filter || @search_query do %>
            <button
              phx-click="clear_filters"
              class="h-10 px-4 text-[#1337ec] hover:text-[#1337ec]/80 text-sm font-medium transition"
            >
              Clear filters
            </button>
          <% end %>
        </div>

        <!-- Books Grid -->
        <%= if Enum.empty?(@paginated_books) do %>
          <div class="text-center py-20">
            <p class="text-[#929bc9] text-lg mb-4">No books found matching your filters.</p>
            <button
              phx-click="clear_filters"
              class="text-[#1337ec] hover:text-opacity-80 font-medium"
            >
              Clear filters
            </button>
          </div>
        <% else %>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            <%= for book <- @paginated_books do %>
              <div
                class="group cursor-pointer relative"
                phx-click="select_book"
                phx-value-book-id={book.id}
              >
                <!-- Book Cover -->
                <div class="w-full aspect-[2/3] bg-[#232948] rounded-xl overflow-hidden shadow-lg group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300 relative">
                  <%= if book.cover_url do %>
                    <img
                      src={book.cover_url}
                      alt={"Book cover for #{book.title}"}
                      class="w-full h-full object-cover"
                    />
                  <% else %>
                    <div class="w-full h-full flex items-center justify-center text-[#929bc9] bg-gradient-to-br from-[#232948] to-[#1a1f3e]">
                      <svg class="w-20 h-20" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                      </svg>
                    </div>
                  <% end %>

                  <!-- Currently Reading Badge (if applicable) -->
                  <%= if has_reading_progress?(book, @current_user.id) do %>
                    <div class="absolute top-2 left-2 px-2 py-1 bg-[#1337ec] text-white text-xs font-bold rounded">
                      Currently Reading
                    </div>
                  <% end %>
                </div>

                <!-- Book Info -->
                <div class="mt-3">
                  <h3 class="text-white text-sm font-semibold leading-tight line-clamp-2 mb-1">
                    <%= book.title %>
                  </h3>
                  <p class="text-[#929bc9] text-xs font-normal">
                    <%= book.author %>
                  </p>
                  <%= if has_soundscape?(book) do %>
                    <p class="text-[#1337ec] text-xs font-medium mt-1">
                      🔊 Soundscape Available
                    </p>
                  <% end %>
                </div>
              </div>
            <% end %>
          </div>

          <!-- Pagination -->
          <%= if @total_pages > 1 do %>
            <div class="flex items-center justify-center gap-2 mt-12">
              <button
                phx-click="prev_page"
                disabled={@current_page == 1}
                class="w-8 h-8 flex items-center justify-center text-white hover:bg-[#232948] rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                ‹
              </button>

              <%= for page_num <- pagination_range(@current_page, @total_pages) do %>
                <%= if page_num == "..." do %>
                  <span class="w-8 h-8 flex items-center justify-center text-[#929bc9]">...</span>
                <% else %>
                  <button
                    phx-click="go_to_page"
                    phx-value-page={page_num}
                    class={[
                      "w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition",
                      if(page_num == @current_page,
                        do: "bg-[#1337ec] text-white",
                        else: "text-white hover:bg-[#232948]"
                      )
                    ]}
                  >
                    <%= page_num %>
                  </button>
                <% end %>
              <% end %>

              <button
                phx-click="next_page"
                disabled={@current_page == @total_pages}
                class="w-8 h-8 flex items-center justify-center text-white hover:bg-[#232948] rounded disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                ›
              </button>
            </div>
          <% end %>
        <% end %>
      </div>
    </div>
    """
  end

  # Private functions

  defp paginate_books(socket) do
    books = socket.assigns.filtered_books
    per_page = socket.assigns.per_page
    current_page = socket.assigns.current_page

    total_pages = calculate_total_pages(books, per_page)
    offset = (current_page - 1) * per_page

    paginated_books =
      books
      |> Enum.drop(offset)
      |> Enum.take(per_page)

    socket
    |> assign(:paginated_books, paginated_books)
    |> assign(:total_pages, total_pages)
  end

  defp calculate_total_pages(books, per_page) do
    ceil(length(books) / per_page)
  end

  defp pagination_range(current, total) when total <= 7 do
    1..total |> Enum.to_list()
  end

  defp pagination_range(current, total) do
    cond do
      current <= 4 ->
        [1, 2, 3, 4, 5, "...", total]

      current >= total - 3 ->
        [1, "...", total - 4, total - 3, total - 2, total - 1, total]

      true ->
        [1, "...", current - 1, current, current + 1, "...", total]
    end
  end

  defp calculate_access_limits(user) do
    books_accessed = Content.count_accessed_books(user.id)

    case user.subscription_tier do
      :free ->
        {books_accessed, 3, books_accessed < 3}

      :reader ->
        monthly_books = Content.count_monthly_books(user.id)
        {monthly_books, 20, monthly_books < 20}

      :bibliophile ->
        {books_accessed, :unlimited, true}

      _ ->
        {books_accessed, 3, books_accessed < 3}
    end
  end

  defp can_access_book?(user, book_id) do
    # Admins have unlimited access
    if Accounts.admin?(user) do
      true
    else
      # Check if user already has progress on this book
      existing_progress =
        Storia.Repo.get_by(Content.ReadingProgress, user_id: user.id, book_id: book_id)

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

  defp apply_filters(socket, genre, author, query, sort) do
    books = socket.assigns.books

    # Apply filters
    filtered_books =
      books
      |> filter_by_genre(genre)
      |> filter_by_author(author)
      |> filter_by_query(query)
      |> sort_books(sort)

    {:noreply,
     socket
     |> assign(:filtered_books, filtered_books)
     |> assign(:genre_filter, genre)
     |> assign(:author_filter, author)
     |> assign(:search_query, query)
     |> assign(:sort_by, sort)
     |> assign(:current_page, 1)
     |> paginate_books()}
  end

  defp filter_by_genre(books, nil), do: books

  defp filter_by_genre(books, genre) do
    Enum.filter(books, fn book ->
      case book.metadata do
        %{"genre" => ^genre} -> true
        _ -> false
      end
    end)
  end

  defp filter_by_author(books, nil), do: books

  defp filter_by_author(books, author) do
    author_lower = String.downcase(author)

    Enum.filter(books, fn book ->
      String.contains?(String.downcase(book.author), author_lower)
    end)
  end

  defp filter_by_query(books, nil), do: books

  defp filter_by_query(books, query) do
    query_lower = String.downcase(query)

    Enum.filter(books, fn book ->
      String.contains?(String.downcase(book.title), query_lower) ||
        String.contains?(String.downcase(book.author), query_lower)
    end)
  end

  defp sort_books(books, "title_asc") do
    Enum.sort_by(books, & &1.title, :asc)
  end

  defp sort_books(books, "title_desc") do
    Enum.sort_by(books, & &1.title, :desc)
  end

  defp sort_books(books, "author_asc") do
    Enum.sort_by(books, & &1.author, :asc)
  end

  defp sort_books(books, "recent") do
    Enum.sort_by(books, & &1.inserted_at, {:desc, DateTime})
  end

  defp sort_books(books, _), do: books

  defp subscription_tier_name(:free), do: "Free Tier"
  defp subscription_tier_name(:reader), do: "Reader Tier"
  defp subscription_tier_name(:bibliophile), do: "Bibliophile Tier"
  defp subscription_tier_name(_), do: "Free Tier"

  defp format_limit(:unlimited), do: "Unlimited"
  defp format_limit(limit), do: to_string(limit)

  defp has_soundscape?(book) do
    # Check if book has scenes with soundscapes
    # For now, we'll assume published books have soundscapes
    # This can be enhanced to check actual soundscape data
    book.is_published
  end

  defp has_reading_progress?(book, user_id) do
    Storia.Repo.get_by(Content.ReadingProgress, user_id: user_id, book_id: book.id) != nil
  end
end
