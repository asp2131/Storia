defmodule StoriaWeb.AdminLive.LibraryManager do
  use StoriaWeb, :live_view

  alias Storia.Soundscapes

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Soundscape Library")
     |> assign(:active_tab, :soundscapes)
     |> assign(:search_query, "")
     |> assign(:filter_source, "all")
     |> load_soundscapes()}
  end

  @impl true
  def handle_params(_params, _url, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_event("search", %{"search" => %{"query" => query}}, socket) do
    {:noreply,
     socket
     |> assign(:search_query, query)
     |> load_soundscapes()}
  end

  @impl true
  def handle_event("filter_source", %{"source" => source}, socket) do
    {:noreply,
     socket
     |> assign(:filter_source, source)
     |> load_soundscapes()}
  end

  @impl true
  def handle_event("delete_soundscape", %{"id" => id}, socket) do
    soundscape = Soundscapes.get_soundscape!(id)

    # TODO: Check if soundscape is in use before deleting
    case Soundscapes.delete_soundscape(soundscape) do
      {:ok, _soundscape} ->
        {:noreply,
         socket
         |> put_flash(:info, "Soundscape deleted successfully")
         |> load_soundscapes()}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "Failed to delete soundscape")}
    end
  end

  defp load_soundscapes(socket) do
    query = socket.assigns.search_query
    filter = socket.assigns.filter_source

    soundscapes =
      cond do
        query != "" ->
          Soundscapes.search_soundscapes(query)

        filter != "all" ->
          Soundscapes.list_soundscapes_by_source(filter)

        true ->
          Soundscapes.list_soundscapes()
      end

    assign(socket, :soundscapes, soundscapes)
  end

  defp format_source_type("ai_generated"), do: "AI Generated"
  defp format_source_type("curated"), do: "Curated"
  defp format_source_type("user_uploaded"), do: "User Uploaded"
  defp format_source_type(type), do: String.capitalize(type)

  defp source_badge_class("ai_generated"),
    do: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-400"

  defp source_badge_class("curated"),
    do: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400"

  defp source_badge_class("user_uploaded"),
    do: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400"

  defp source_badge_class(_), do: "bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400"

  defp format_date(nil), do: "N/A"

  defp format_date(datetime) do
    Calendar.strftime(datetime, "%Y-%m-%d")
  end
end
