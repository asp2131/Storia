defmodule StoriaWeb.UserResetPasswordLive do
  use StoriaWeb, :live_view

  alias Storia.Accounts

  def render(assigns) do
    ~H"""
    <div class="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1426] to-[#111827] flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-md">
        <div class="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8">
          <div class="text-center mb-8">
            <p class="text-sm uppercase tracking-[0.2em] text-[#7da2f2] font-semibold mb-3">Security</p>
            <h1 class="text-3xl font-black text-white tracking-tight">Reset your password</h1>
            <p class="text-[#9aa4c2] text-sm mt-3">Choose a strong new password to secure your account.</p>
          </div>

          <.simple_form
            for={@form}
            id="reset_password_form"
            phx-submit="reset_password"
            phx-change="validate"
            class="space-y-4"
          >
            <.error :if={@form.errors != []} class="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
              Oops, something went wrong! Please check the errors below.
            </.error>

            <.input field={@form[:password]} type="password" label="New password" required
              class="bg-white/5 border border-white/10 text-white placeholder:text-[#9aa4c2] focus:border-[#7da2f2] focus:ring-[#7da2f2]" />
            <.input
              field={@form[:password_confirmation]}
              type="password"
              label="Confirm new password"
              required
              class="bg-white/5 border border-white/10 text-white placeholder:text-[#9aa4c2] focus:border-[#7da2f2] focus:ring-[#7da2f2]"
            />
            <:actions>
              <.button phx-disable-with="Resetting..." class="w-full bg-gradient-to-r from-[#6c8dff] to-[#7da2f2] text-white font-bold py-3 rounded-lg shadow-lg hover:opacity-95 transition">
                Reset Password
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

  def mount(params, _session, socket) do
    socket = assign_user_and_token(socket, params)

    form_source =
      case socket.assigns do
        %{user: user} ->
          Accounts.change_user_password(user)

        _ ->
          %{}
      end

    {:ok, assign_form(socket, form_source), temporary_assigns: [form: nil]}
  end

  # Do not log in the user after reset password to avoid a
  # leaked token giving the user access to the account.
  def handle_event("reset_password", %{"user" => user_params}, socket) do
    case Accounts.reset_password(socket.assigns.user, user_params) do
      {:ok, _} ->
        {:noreply,
         socket
         |> put_flash(:info, "Password reset successfully.")
         |> redirect(to: ~p"/users/log_in")}

      {:error, changeset} ->
        {:noreply, assign_form(socket, Map.put(changeset, :action, :insert))}
    end
  end

  def handle_event("validate", %{"user" => user_params}, socket) do
    changeset = Accounts.change_user_password(socket.assigns.user, user_params)
    {:noreply, assign_form(socket, Map.put(changeset, :action, :validate))}
  end

  defp assign_user_and_token(socket, %{"token" => token}) do
    if user = Accounts.get_user_by_reset_password_token(token) do
      assign(socket, user: user, token: token)
    else
      socket
      |> put_flash(:error, "Reset password link is invalid or it has expired.")
      |> redirect(to: ~p"/")
    end
  end

  defp assign_form(socket, %{} = source) do
    assign(socket, :form, to_form(source, as: "user"))
  end
end
