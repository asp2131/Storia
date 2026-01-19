defmodule StoriaWeb.UserProfileLive do
  use StoriaWeb, :live_view

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
                <.link navigate={~p"/library"} class="text-[#929bc9] hover:text-white font-medium text-sm transition">
                  Library
                </.link>
                <.link navigate={~p"/"} class="text-white font-medium text-sm">
                  My Profile
                </.link>
              </div>
            </div>

            <!-- Right: Subscribe and User Menu -->
            <div class="flex items-center gap-4">
              <.link
                navigate={~p"/subscription"}
                class="px-4 py-2 bg-[#1337ec] text-white rounded-lg text-sm font-bold hover:bg-opacity-90 transition"
              >
                Subscribe
              </.link>

              <!-- User Dropdown -->
              <div class="relative" x-data="{ open: false }" @click.away="open = false">
                <button
                  @click="open = !open"
                  class="w-9 h-9 bg-[#e5e7eb] rounded-full flex items-center justify-center hover:bg-opacity-80 transition"
                >
                  <span class="text-[#0a0e1a] font-bold text-sm">
                    <%= String.first(@current_user.email) |> String.upcase() %>
                  </span>
                </button>

                <div
                  x-show="open"
                  x-transition:enter="transition ease-out duration-100"
                  x-transition:enter-start="transform opacity-0 scale-95"
                  x-transition:enter-end="transform opacity-100 scale-100"
                  x-transition:leave="transition ease-in duration-75"
                  x-transition:leave-start="transform opacity-100 scale-100"
                  x-transition:leave-end="transform opacity-0 scale-95"
                  class="absolute right-0 mt-2 w-48 bg-[#232948] rounded-lg shadow-lg border border-[#373c5a] py-1 z-50"
                >
                  <.link
                    navigate={~p"/"}
                    class="flex items-center gap-3 px-4 py-2 text-sm text-[#929bc9] hover:text-white hover:bg-[#373c5a] transition"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </.link>

                  <.link
                    navigate={~p"/users/settings"}
                    class="flex items-center gap-3 px-4 py-2 text-sm text-[#929bc9] hover:text-white hover:bg-[#373c5a] transition"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </.link>

                  <hr class="border-[#373c5a] my-1">

                  <.link
                    href={~p"/sessions/log_out"}
                    method="delete"
                    class="flex items-center gap-3 px-4 py-2 text-sm text-[#929bc9] hover:text-white hover:bg-[#373c5a] transition"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                  </.link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <!-- Main Content -->
      <div class="max-w-6xl mx-auto px-6 py-8">
        <!-- Profile Header -->
        <div class="bg-[#101322] rounded-lg border border-[#232948] p-8 mb-8">
          <div class="flex items-start gap-6">
            <!-- Avatar -->
            <div class="w-20 h-20 bg-[#e5e7eb] rounded-full flex items-center justify-center">
              <span class="text-[#0a0e1a] font-bold text-2xl">
                <%= String.first(@current_user.email) |> String.upcase() %>
              </span>
            </div>

            <!-- Profile Info -->
            <div class="flex-1">
              <h1 class="text-2xl font-bold text-white mb-2"><%= @current_user.email %></h1>
              <p class="text-[#929bc9] mb-4">
                <%= case @current_user.subscription_tier do %>
                  <% :free -> %>
                    Free Tier Member
                  <% :reader -> %>
                    Reader Tier Member
                  <% :bibliophile -> %>
                    Bibliophile Tier Member
                  <% _ -> %>
                    Free Tier Member
                <% end %>
              </p>

              <div class="flex items-center gap-4">
                <.link
                  navigate={~p"/users/settings"}
                  class="px-4 py-2 bg-[#1337ec] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition"
                >
                  Edit Profile
                </.link>
                <.link
                  navigate={~p"/subscription"}
                  class="px-4 py-2 bg-[#232948] text-white rounded-lg text-sm font-medium hover:bg-opacity-80 transition"
                >
                  Upgrade Plan
                </.link>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <!-- Books Read -->
          <div class="bg-[#101322] rounded-lg border border-[#232948] p-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-[#1337ec] rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-white"><%= @stats.books_read %></p>
                <p class="text-sm text-[#929bc9]">Books Read</p>
              </div>
            </div>
          </div>

          <!-- Reading Progress -->
          <div class="bg-[#101322] rounded-lg border border-[#232948] p-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-[#1337ec] rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-white"><%= @stats.currently_reading %></p>
                <p class="text-sm text-[#929bc9]">Currently Reading</p>
              </div>
            </div>
          </div>

          <!-- Total Minutes -->
          <div class="bg-[#101322] rounded-lg border border-[#232948] p-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-[#1337ec] rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold text-white"><%= @stats.total_minutes %></p>
                <p class="text-sm text-[#929bc9]">Minutes Listened</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Currently Reading -->
        <%= if @currently_reading do %>
          <div class="bg-[#101322] rounded-lg border border-[#232948] p-8 mb-8">
            <h2 class="text-xl font-bold text-white mb-6">Currently Reading</h2>

            <div class="flex items-start gap-6">
              <!-- Book Cover -->
              <div class="w-24 h-32 bg-[#232948] rounded-lg overflow-hidden flex-shrink-0">
                <%= if @currently_reading.book.cover_url do %>
                  <img
                    src={@currently_reading.book.cover_url}
                    alt={"Book cover for #{@currently_reading.book.title}"}
                    class="w-full h-full object-cover"
                  />
                <% else %>
                  <div class="w-full h-full flex items-center justify-center text-[#929bc9]">
                    <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                  </div>
                <% end %>
              </div>

              <!-- Book Info -->
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-white mb-2"><%= @currently_reading.book.title %></h3>
                <p class="text-[#929bc9] mb-4"><%= @currently_reading.book.author %></p>

                <div class="flex items-center gap-4 mb-4">
                  <div class="flex-1">
                    <div class="flex items-center justify-between text-sm text-[#929bc9] mb-1">
                      <span>Progress</span>
                      <span><%= @currently_reading.progress %>%</span>
                    </div>
                    <div class="w-full bg-[#232948] rounded-full h-2">
                      <div class="bg-[#1337ec] h-2 rounded-full" style={"width: #{@currently_reading.progress}%"}></div>
                    </div>
                  </div>
                </div>

                <.link
                  navigate={~p"/read/#{@currently_reading.book.id}"}
                  class="px-6 py-2 bg-[#1337ec] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition"
                >
                  Continue Reading
                </.link>
              </div>
            </div>
          </div>
        <% end %>

        <!-- Reading History -->
        <div class="bg-[#101322] rounded-lg border border-[#232948] p-8">
          <h2 class="text-xl font-bold text-white mb-6">Reading History</h2>

          <%= if Enum.empty?(@reading_history) do %>
            <div class="text-center py-12">
              <svg class="w-16 h-16 text-[#929bc9] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p class="text-[#929bc9] text-lg mb-2">No reading history yet</p>
              <p class="text-[#929bc9] text-sm mb-6">Start reading books from the library to see your progress here.</p>
              <.link
                navigate={~p"/library"}
                class="px-6 py-2 bg-[#1337ec] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition"
              >
                Browse Library
              </.link>
            </div>
          <% else %>
            <div class="space-y-4">
              <%= for progress <- @reading_history do %>
                <div class="flex items-center gap-4 p-4 bg-[#232948] rounded-lg">
                  <!-- Book Cover -->
                  <div class="w-12 h-16 bg-[#373c5a] rounded overflow-hidden flex-shrink-0">
                    <%= if progress.book.cover_url do %>
                      <img
                        src={progress.book.cover_url}
                        alt={"Book cover for #{progress.book.title}"}
                        class="w-full h-full object-cover"
                      />
                    <% else %>
                      <div class="w-full h-full flex items-center justify-center text-[#929bc9]">
                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                        </svg>
                      </div>
                    <% end %>
                  </div>

                  <!-- Book Info -->
                  <div class="flex-1">
                    <h4 class="text-white font-medium mb-1"><%= progress.book.title %></h4>
                    <p class="text-[#929bc9] text-sm"><%= progress.book.author %></p>
                  </div>

                  <!-- Progress -->
                  <div class="text-right">
                    <p class="text-white font-medium"><%= progress.progress %>%</p>
                    <p class="text-[#929bc9] text-sm">
                      <%= if progress.completed_at do %>
                        Completed
                      <% else %>
                        In progress
                      <% end %>
                    </p>
                  </div>

                  <!-- Action -->
                  <.link
                    navigate={~p"/read/#{progress.book.id}"}
                    class="px-3 py-1 bg-[#1337ec] text-white rounded text-sm font-medium hover:bg-opacity-90 transition"
                  >
                    <%= if progress.completed_at do %>
                      Read Again
                    <% else %>
                      Continue
                    <% end %>
                  </.link>
                </div>
              <% end %>
            </div>
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    user = socket.assigns.current_user

    # Calculate stats
    stats = %{
      books_read: Content.count_completed_books(user.id),
      currently_reading: Content.count_currently_reading_books(user.id),
      total_minutes: Content.count_total_listening_minutes(user.id)
    }

    # Get currently reading book
    currently_reading = Content.get_currently_reading_book(user.id)

    # Get reading history (recently read books)
    reading_history = Content.list_recent_reading_progress(user.id, 10)

    {:ok,
     socket
     |> assign(:page_title, "Profile")
     |> assign(:stats, stats)
     |> assign(:currently_reading, currently_reading)
     |> assign(:reading_history, reading_history)}
  end
end
