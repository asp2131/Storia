defmodule StoriaWeb.UserLoginLive do
  use StoriaWeb, :live_view

  def render(assigns) do
    ~H"""
    <div class="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1426] to-[#111827] flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-md">
        <div class="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8">
          <div class="text-center mb-8">
            <p class="text-sm uppercase tracking-[0.2em] text-[#7da2f2] font-semibold mb-3">Welcome back</p>
            <h1 class="text-3xl font-black text-white tracking-tight">Sign in to Storia</h1>
            <p class="text-[#9aa4c2] text-sm mt-3">
              Don't have an account?
              <.link navigate={~p"/users/register"} class="text-[#7da2f2] font-semibold hover:underline">
                Sign up
              </.link>
            </p>
          </div>

          <.simple_form for={@form} id="login_form" action={~p"/users/log_in"} phx-update="ignore" class="space-y-4">
            <.input field={@form[:email]} type="email" label="Email" required
              class="bg-white/5 border border-white/10 text-white placeholder:text-[#9aa4c2] focus:border-[#7da2f2] focus:ring-[#7da2f2]" />
            <.input field={@form[:password]} type="password" label="Password" required
              class="bg-white/5 border border-white/10 text-white placeholder:text-[#9aa4c2] focus:border-[#7da2f2] focus:ring-[#7da2f2]" />

            <:actions>
              <div class="flex items-center justify-between text-sm">
                <.input field={@form[:remember_me]} type="checkbox" label="Keep me logged in" />
                <.link href={~p"/users/reset_password"} class="text-[#7da2f2] font-semibold hover:underline">
                  Forgot password?
                </.link>
              </div>
            </:actions>
            <:actions>
              <.button phx-disable-with="Signing in..." class="w-full bg-gradient-to-r from-[#6c8dff] to-[#7da2f2] text-white font-bold py-3 rounded-lg shadow-lg hover:opacity-95 transition">
                Sign in
              </.button>
            </:actions>
          </.simple_form>
        </div>
      </div>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    email = Phoenix.Flash.get(socket.assigns.flash, :email)
    form = to_form(%{"email" => email}, as: "user")
    {:ok, assign(socket, form: form), temporary_assigns: [form: form]}
  end
end
