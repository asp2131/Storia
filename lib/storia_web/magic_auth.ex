defmodule StoriaWeb.MagicAuth do
  use StoriaWeb, :html

  require Logger

  alias Storia.Accounts
  alias Storia.Mailer

  @behaviour MagicAuth.Callbacks

  attr :form, :any, required: true
  attr :flash, :map, required: true

  @impl true
  def log_in_form(assigns) do
    ~H"""
    <.flash_group flash={@flash} />
    <div class="min-h-screen flex items-center justify-center bg-[#0a0e1a] px-4 py-12">
      <div class="w-full max-w-md space-y-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8">
        <h1 class="text-2xl font-black text-white text-center">Sign in with email</h1>
        <p class="text-center text-sm text-[#9aa4c2]">We will send a one-time code.</p>
        <.form for={@form} phx-change="validate" phx-submit="login" class="space-y-4">
          <.input field={@form[:email]} type="email" label="Email" required
            class="bg-white/5 border border-white/10 text-white placeholder:text-[#9aa4c2] focus:border-[#7da2f2] focus:ring-[#7da2f2]" />
          <.button class="w-full bg-gradient-to-r from-[#6c8dff] to-[#7da2f2] text-white font-bold py-3 rounded-lg shadow-lg hover:opacity-95 transition">
            Send code
          </.button>
        </.form>
      </div>
    </div>
    """
  end

  attr :form, :any, required: true
  attr :error, :string, required: true
  attr :flash, :map, required: true
  attr :email, :string, required: true
  attr :rate_limited?, :boolean, required: true
  attr :countdown, :integer, required: true

  @impl true
  def verify_form(assigns) do
    ~H"""
    <.flash_group flash={@flash} />
    <div class="min-h-screen flex items-center justify-center bg-[#0a0e1a] px-4 py-12">
      <div class="w-full max-w-md space-y-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-8">
        <h1 class="text-2xl font-black text-white text-center">Enter your code</h1>
        <p class="text-center text-sm text-[#9aa4c2]">We sent a code to <%= @email %>.</p>
        <.form for={@form} phx-change="verify" class="space-y-4">
          <.input field={@form[:password]} type="text" label="Code" required
            class="bg-white/5 border border-white/10 text-white placeholder:text-[#9aa4c2] focus:border-[#7da2f2] focus:ring-[#7da2f2]" />
          <%= if @error do %>
            <p class="text-sm text-red-400"><%= @error %></p>
          <% end %>
          <.button class="w-full bg-gradient-to-r from-[#6c8dff] to-[#7da2f2] text-white font-bold py-3 rounded-lg shadow-lg hover:opacity-95 transition">
            Verify code
          </.button>
        </.form>

        <div class="text-center text-sm text-[#9aa4c2]">
          <%= if @rate_limited? do %>
            Please wait <%= @countdown %> seconds to request a new code.
          <% else %>
            <button type="button" phx-click="resend_code" class="underline">
              Resend code
            </button>
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  @impl true
  def one_time_password_requested(%{code: code, email: email}) do
    Swoosh.Email.new()
    |> Swoosh.Email.to(email)
    |> Swoosh.Email.from({"Storia", "noreply@storia.app"})
    |> Swoosh.Email.subject("Your Storia login code")
    |> Swoosh.Email.text_body(text_email_body(code))
    |> Swoosh.Email.html_body(html_email_body(code))
    |> Mailer.deliver()
    |> case do
      {:ok, _} ->
        Logger.debug("MagicAuth code sent to #{email}.")

      {:error, error} ->
        Logger.error("MagicAuth code delivery failed: #{inspect(error)}")
    end
  end

  @impl true
  def log_in_requested(%{email: email}) do
    case Accounts.get_user_by_email(email) do
      %{id: id} ->
        {:allow, id}

      nil ->
        password = generate_password()

        case Accounts.register_user(%{email: email, password: password}) do
          {:ok, user} -> {:allow, user.id}
          {:error, _} -> :deny
        end
    end
  end

  @impl true
  def translate_error(:invalid_code, _opts), do: "Invalid code"
  def translate_error(:code_expired, _opts), do: "Code expired"
  def translate_error(:unauthorized, _opts), do: "You need to log in to access this page."
  def translate_error(:access_denied, _opts), do: "You don't have permission to access this page."
  def translate_error(:too_many_one_time_password_requests, opts),
    do: "Too many requests. Wait #{display_countdown(opts[:countdown])} to request a new code."
  def translate_error(:code_resent, _opts), do: "Code resent"
  def translate_error(:too_many_login_attempts, opts),
    do: "Too many login attempts. Wait #{display_countdown(opts[:countdown])} to try again."

  defp display_countdown(countdown) when countdown < 60, do: "#{countdown} seconds"
  defp display_countdown(countdown), do: "#{div(countdown, 60)} minutes"

  defp generate_password do
    upper = Enum.random(?A..?Z)
    lower = Enum.random(?a..?z)
    digit = Enum.random(?0..?9)
    rest =
      for _ <- 1..9 do
        Enum.random(Enum.to_list(?A..?Z) ++ Enum.to_list(?a..?z) ++ Enum.to_list(?0..?9))
      end

    [upper, lower, digit | rest]
    |> Enum.shuffle()
    |> to_string()
  end

  defp text_email_body(code) do
    """
    Your Storia login code is: #{code}

    This code expires in #{MagicAuth.Config.one_time_password_expiration()} minutes.
    """
  end

  defp html_email_body(code) do
    """
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>Your Storia login code</h2>
      <p>Use this code to sign in:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">#{code}</p>
      <p style="color: #6b7280;">This code expires in #{MagicAuth.Config.one_time_password_expiration()} minutes.</p>
    </div>
    """
  end
end
