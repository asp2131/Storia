defmodule Storia.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children =
      [
        StoriaWeb.Telemetry,
        Storia.Repo,
        {Phoenix.PubSub, name: Storia.PubSub},
        # Start the Finch HTTP client for sending emails
        {Finch, name: Storia.Finch},
        # Start to serve requests, typically the last entry
        StoriaWeb.Endpoint
      ] ++
      oban_child() ++
      dns_cluster_child()

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Storia.Supervisor]
    Supervisor.start_link(children, opts)
  end

  defp oban_child do
    # Temporarily disabled Oban entirely to debug connection issues
    []
  end

  defp dns_cluster_child do
    case Application.get_env(:storia, :dns_cluster_query) do
      nil -> []
      query -> [{DNSCluster, query: query}]
    end
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    StoriaWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
