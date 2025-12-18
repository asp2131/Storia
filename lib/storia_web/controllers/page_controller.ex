defmodule StoriaWeb.PageController do
  use StoriaWeb, :controller

  def home(conn, _params) do
    # The home page is often custom made,
    # so skip the default app layout.
    render(conn, :home, layout: false)
  end

  def health(conn, _params) do
    conn
    |> put_status(:ok)
    |> text("ok")
  end

  # Temporary placeholder until subscription flow is implemented
  def subscription(conn, _params) do
    conn
    |> put_status(:not_implemented)
    |> text("Subscription page coming soon.")
  end

  # Temporary placeholder until user confirmation flow is implemented
  def confirm_placeholder(conn, _params) do
    conn
    |> put_status(:not_implemented)
    |> text("Email confirmation flow is not yet implemented.")
  end
end
