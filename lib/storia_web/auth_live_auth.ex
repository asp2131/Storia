defmodule StoriaWeb.Auth.LiveAuth do
  import Phoenix.LiveView
  import Phoenix.Component

  def on_mount(:ensure_authenticated, _params, session, socket) do
    # Check if we have a token in the session (standard Guardian key)
    token = session["guardian_default_token"]

    if token do
      case Storia.Guardian.resource_from_token(token) do
        {:ok, user, _claims} ->
          socket = assign_new(socket, :current_user, fn -> user end)
          {:cont, socket}
        _ ->
          socket = put_flash(socket, :error, "Please log in.")
          {:halt, redirect(socket, to: "/")}
      end
    else
      socket = put_flash(socket, :error, "Please log in.")
      {:halt, redirect(socket, to: "/")}
    end
  end
end
