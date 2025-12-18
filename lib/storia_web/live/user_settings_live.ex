defmodule StoriaWeb.UserSettingsLive do
  use StoriaWeb, :live_view

  alias Storia.Accounts

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
                    href={~p"/users/log_out"}
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
      <div class="max-w-4xl mx-auto px-6 py-8">
        <div class="bg-[#101322] rounded-lg border border-[#232948] p-8">
          <h1 class="text-2xl font-bold text-white mb-6">Account Settings</h1>

          <div class="space-y-6">
            <!-- Email Section -->
            <div>
              <h2 class="text-lg font-semibold text-white mb-4">Email Address</h2>
              <div class="bg-[#232948] rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-[#929bc9] mb-1">Current email</p>
                    <p class="text-white font-medium"><%= @current_user.email %></p>
                  </div>
                  <button class="px-4 py-2 bg-[#1337ec] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition">
                    Change Email
                  </button>
                </div>
              </div>
            </div>

            <!-- Password Section -->
            <div>
              <h2 class="text-lg font-semibold text-white mb-4">Password</h2>
              <div class="bg-[#232948] rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-[#929bc9] mb-1">Password</p>
                    <p class="text-white font-medium">••••••••</p>
                  </div>
                  <button class="px-4 py-2 bg-[#1337ec] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition">
                    Change Password
                  </button>
                </div>
              </div>
            </div>

            <!-- Subscription Section -->
            <div>
              <h2 class="text-lg font-semibold text-white mb-4">Subscription</h2>
              <div class="bg-[#232948] rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-[#929bc9] mb-1">Current plan</p>
                    <p class="text-white font-medium">
                      <%= case @current_user.subscription_tier do %>
                        <% :free -> %>
                          Free Tier
                        <% :reader -> %>
                          Reader Tier
                        <% :bibliophile -> %>
                          Bibliophile Tier
                        <% _ -> %>
                          Free Tier
                      <% end %>
                    </p>
                  </div>
                  <.link
                    navigate={~p"/subscription"}
                    class="px-4 py-2 bg-[#1337ec] text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition"
                  >
                    Manage Subscription
                  </.link>
                </div>
              </div>
            </div>

            <!-- Danger Zone -->
            <div>
              <h2 class="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
              <div class="bg-[#232948] rounded-lg p-4 border border-red-500/20">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm text-[#929bc9] mb-1">Delete Account</p>
                    <p class="text-white font-medium">Permanently delete your account and all data</p>
                  </div>
                  <button class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, socket |> assign(:page_title, "Settings")}
  end
end
