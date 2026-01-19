defmodule StoriaWeb.Router do
  use StoriaWeb, :router
  use MagicAuth.Router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {StoriaWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :fetch_magic_auth_session
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :admin do
    plug StoriaWeb.Plugs.RequireAdmin
  end

  pipeline :require_authenticated_user do
    plug :require_authenticated
  end

  pipeline :redirect_if_user_is_authenticated do
    plug :redirect_if_authenticated
  end

  scope "/", StoriaWeb do
    pipe_through :browser

    get "/", PageController, :home
    get "/health", PageController, :health
  end

  magic_auth("/sessions", signed_in: "/library")

  # Authentication routes (legacy password flow)
  scope "/", StoriaWeb do
    pipe_through [:browser, :redirect_if_user_is_authenticated]

    live_session :redirect_if_user_is_authenticated,
      on_mount: [{MagicAuth, :redirect_if_authenticated}] do
      live "/users/register", UserRegistrationLive, :new
      live "/users/log_in", UserLoginLive, :new
      live "/users/reset_password", UserForgotPasswordLive, :new
      live "/users/reset_password/:token", UserResetPasswordLive, :edit
    end

    post "/users/log_in", UserSessionController, :create
    post "/users/register", UserRegistrationController, :create
  end

  scope "/", StoriaWeb do
    pipe_through [:browser]

    post "/auth/request_code", MagicAuthController, :request_code
    post "/auth/verify", MagicAuthController, :verify
  end

  scope "/", StoriaWeb do
    pipe_through [:browser, :require_authenticated_user]

    live_session :require_authenticated_user,
      on_mount: [{MagicAuth, :require_authenticated}] do
      live "/users/settings", UserSettingsLive, :edit
      live "/users/settings/confirm_email/:token", UserSettingsLive, :confirm_email

      # Reader routes - accessible to all authenticated users including admins
      live "/library", LibraryLive, :index
      live "/read/:id", ReaderLive, :show
    end

    # Placeholder subscription route to satisfy navigation targets
    get "/subscription", PageController, :subscription
  end

  scope "/", StoriaWeb do
    pipe_through [:browser]

    delete "/users/log_out", UserSessionController, :delete
    # Placeholder confirmation route (full email confirmation flow not yet implemented)
    get "/users/confirm/:token", PageController, :confirm_placeholder
  end

  # Admin routes
  scope "/admin", StoriaWeb.AdminLive do
    pipe_through [:browser, :require_authenticated_user, :admin]

    live_session :admin,
      on_mount: [{MagicAuth, :require_authenticated}],
      layout: {StoriaWeb.Layouts, :admin} do
      live "/books", BookList, :index
      live "/books/:id/scenes", SceneReview, :show
      live "/soundscapes", LibraryManager, :index
    end
  end

  # Other scopes may use custom stacks.
  # scope "/api", StoriaWeb do
  #   pipe_through :api
  # end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:storia, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: StoriaWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
