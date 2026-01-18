defmodule StoriaWeb.UserRegistrationLive do
  use StoriaWeb, :live_view

  alias Storia.Accounts
  alias Storia.Accounts.User

  def render(assigns) do
    ~H"""
    <div class="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1426] to-[#111827] flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-md">
        <div class="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8">
          <div class="text-center mb-8">
            <p class="text-sm uppercase tracking-[0.2em] text-[#7da2f2] font-semibold mb-3">Join Storia</p>
            <h1 class="text-3xl font-black text-white tracking-tight">Create your account</h1>
            <p class="text-[#9aa4c2] text-sm mt-3">
              Already registered?
              <.link navigate={~p"/users/log_in"} class="text-[#7da2f2] font-semibold hover:underline">
                Sign in
              </.link>
            </p>
          </div>

          <.simple_form
        for={@form}
        id="registration_form"
        phx-submit="save"
        phx-change="validate"
        phx-trigger-action={@trigger_submit}
        action={~p"/users/log_in?_action=registered"}
        method="post"
        class="space-y-4"
      >
            <.error :if={@check_errors} class="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
              Oops, something went wrong! Please check the errors below.
            </.error>

            <.input field={@form[:email]} type="email" label="Email" required
              class="bg-white/5 border border-white/10 text-white placeholder:text-[#9aa4c2] focus:border-[#7da2f2] focus:ring-[#7da2f2]" />
            <.input field={@form[:password]} type="password" label="Password" required
              class="bg-white/5 border border-white/10 text-white placeholder:text-[#9aa4c2] focus:border-[#7da2f2] focus:ring-[#7da2f2]" />

            <:actions>
              <.button phx-disable-with="Creating account..." class="w-full bg-gradient-to-r from-[#6c8dff] to-[#7da2f2] text-white font-bold py-3 rounded-lg shadow-lg hover:opacity-95 transition">
                Create account
              </.button>
            </:actions>
          </.simple_form>
        </div>
      </div>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    changeset = Accounts.change_user_registration(%User{})

    socket =
      socket
      |> assign(trigger_submit: false, check_errors: false)
      |> assign_form(changeset)

    {:ok, socket, temporary_assigns: [form: nil]}
  end

  def handle_event("save", %{"user" => user_params}, socket) do
    case Accounts.register_user(user_params) do
      {:ok, user} ->
        {:ok, _} =
          Accounts.deliver_user_confirmation_instructions(
            user,
            &url(~p"/users/confirm/#{&1}")
          )

        changeset = Accounts.change_user_registration(user)
        {:noreply, socket |> assign(trigger_submit: true) |> assign_form(changeset)}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply, socket |> assign(check_errors: true) |> assign_form(changeset)}
    end
  end

  def handle_event("validate", %{"user" => user_params}, socket) do
    changeset = Accounts.change_user_registration(%User{}, user_params)
    {:noreply, assign_form(socket, Map.put(changeset, :action, :validate))}
  end

  defp assign_form(socket, %Ecto.Changeset{} = changeset) do
    form = to_form(changeset, as: "user")

    if changeset.valid? do
      assign(socket, form: form, check_errors: false)
    else
      assign(socket, form: form)
    end
  end
end
