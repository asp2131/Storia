defmodule StoriaWeb.UserForgotPasswordLive do
  use StoriaWeb, :live_view

  alias Storia.Accounts

  def render(assigns) do
    ~H"""
    <div class="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1426] to-[#111827] flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-md">
        <div class="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8">
          <div class="text-center mb-8">
            <p class="text-sm uppercase tracking-[0.2em] text-[#7da2f2] font-semibold mb-3">Reset password</p>
            <h1 class="text-3xl font-black text-white tracking-tight">Forgot your password?</h1>
            <p class="text-[#9aa4c2] text-sm mt-3">We'll send a reset link to your email.</p>
          </div>

          <.simple_form for={@form} id="reset_password_form" phx-submit="send_email" class="space-y-4">
            <.input field={@form[:email]} type="email" placeholder="Email" required
              class="bg-white/5 border border-white/10 text-white placeholder:text-[#9aa4c2] focus:border-[#7da2f2] focus:ring-[#7da2f2]" />
            <:actions>
              <.button phx-disable-with="Sending..." class="w-full bg-gradient-to-r from-[#6c8dff] to-[#7da2f2] text-white font-bold py-3 rounded-lg shadow-lg hover:opacity-95 transition">
                Send reset instructions
              </.button>
            </:actions>
          </.simple_form>

          <p class="text-center text-sm mt-6 text-[#9aa4c2]">
            <.link navigate={~p"/users/register"} class="text-[#7da2f2] font-semibold hover:underline">Register</.link>
            <span class="mx-2 text-gray-600">•</span>
            <.link navigate={~p"/users/log_in"} class="text-[#7da2f2] font-semibold hover:underline">Log in</.link>
          </p>
        </div>
      </div>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, form: to_form(%{}, as: "user"))}
  end

  def handle_event("send_email", %{"user" => %{"email" => email}}, socket) do
    if user = Accounts.get_user_by_email(email) do
      Accounts.deliver_user_reset_password_instructions(
        user,
        &url(~p"/users/reset_password/#{&1}")
      )
    end

    info =
      "If your email is in our system, you will receive instructions to reset your password shortly."

    {:noreply,
     socket
     |> put_flash(:info, info)
     |> redirect(to: ~p"/")}
  end
end
