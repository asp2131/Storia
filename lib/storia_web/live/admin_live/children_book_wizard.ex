defmodule StoriaWeb.AdminLive.ChildrenBookWizard do
  use StoriaWeb, :live_view

  require Logger
  alias Storia.Content
  alias Storia.AI.StoryGenerator

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(Storia.PubSub, "book_processing")
    end

    {:ok,
     socket
     |> assign(:page_title, "Create Children's Book")
     |> assign(:active_tab, :books)
     |> assign(:step, :details) # Steps: :details, :generating_story, :review_story, :illustrations, :narration, :soundscapes
     |> assign(:book, nil)
     |> assign(:form, to_form(%{
       "title" => "",
       "theme" => "Adventure",
       "target_age" => "3-5",
       "summary" => ""
     }))
     |> assign(:story_data, nil)}
  end

  @impl true
  def handle_event("generate_story", %{"title" => title, "theme" => theme, "target_age" => age, "summary" => summary}, socket) do
    # Store the params to use later when creating the book
    story_params = %{
      title: title,
      theme: theme,
      target_age: age,
      summary: summary
    }

    # Start the AI generation task asynchronously (linked to this LiveView)
    task = Task.async(fn ->
      StoryGenerator.generate_story(story_params)
    end)

    {:noreply,
     socket
     |> assign(:step, :generating_story)
     |> assign(:story_params, story_params) # Save for later
     |> assign(:generation_task, task)      # Track the task
     |> put_flash(:info, "Asking Gemini to write your story...")}
  end

  @impl true
  def handle_event("generate_illustrations", _params, socket) do
    book = socket.assigns.book

    # Kick off an image generation job for each page
    Enum.each(book.pages, fn page ->
      %{page_id: page.id}
      |> Storia.Workers.ImageGenerator.new()
      |> Oban.insert()
    end)

    case Content.update_book_status(book.id, "generating_images") do
      {:ok, book} ->
        {:noreply,
         socket
         |> assign(:book, book)
         |> assign(:step, :illustrations)
         |> put_flash(:info, "Illustration generation started for #{length(book.pages)} pages.")}
      {:error, _} ->
        {:noreply, put_flash(socket, :error, "Failed to update book status.")}
    end
  end

  @impl true
  def handle_event("generate_narration", _params, socket) do
    book = socket.assigns.book

    # Kick off a narration generation job for each page
    Enum.each(book.pages, fn page ->
      %{page_id: page.id}
      |> Storia.Workers.NarrationGenerator.new()
      |> Oban.insert()
    end)

    case Content.update_book_status(book.id, "generating_narration") do
      {:ok, book} ->
        {:noreply,
         socket
         |> assign(:book, book)
         |> assign(:step, :narration)
         |> put_flash(:info, "Narration generation started for #{length(book.pages)} pages.")}
      {:error, _} ->
        {:noreply, put_flash(socket, :error, "Failed to update book status.")}
    end
  end

  @impl true
  def handle_info({ref, result}, socket) when socket.assigns.generation_task.ref == ref do
    # Handle the result of the AI generation task
    Process.demonitor(ref, [:flush])

    case result do
      {:ok, story_data} ->
        # NOW we create the book with the generated content
        create_book_from_story(socket, story_data)

      {:error, reason} ->
        Logger.error("Story generation failed: #{inspect(reason)}")
        {:noreply,
         socket
         |> assign(:step, :details)
         |> put_flash(:error, "Story generation failed: #{inspect(reason)}")}
    end
  end

  # Handle task crashes
  @impl true
  def handle_info({:DOWN, ref, :process, _pid, reason}, socket) when socket.assigns.generation_task.ref == ref do
    Logger.error("Story generation task crashed: #{inspect(reason)}")
    {:noreply,
     socket
     |> assign(:step, :details)
     |> put_flash(:error, "Story generation crashed. Please try again.")}
  end

  @impl true
  def handle_info({:book_updated, book_id}, socket) do
    if socket.assigns.book && socket.assigns.book.id == book_id do
      book = Content.get_book_with_pages!(book_id)

      case book.processing_status do
        # "ready_for_review" is handled by the synchronous flow now
        "ready_for_audio" ->
          {:noreply,
           socket
           |> assign(:book, book)
           |> assign(:step, :illustrations_complete)
           |> put_flash(:info, "All illustrations generated successfully!")}

        "ready_for_soundscapes" ->
          {:noreply,
           socket
           |> assign(:book, book)
           |> assign(:step, :narration_complete)
           |> put_flash(:info, "All narration generated successfully!")}

        "failed" ->
          {:noreply, put_flash(socket, :error, "Processing update: #{book.processing_error}")}

        _ ->
          {:noreply, assign(socket, :book, book)}
      end
    else
      {:noreply, socket}
    end
  end

  defp create_book_from_story(socket, story_data) do
    user_params = socket.assigns.story_params

    # 1. Create the book record
    case Content.create_book(%{
      title: story_data["title"] || user_params.title,
      author: "Storia AI", # Could come from current_user
      book_type: "children_story",
      processing_status: "ready_for_review",
      metadata: %{
        "theme" => user_params.theme,
        "target_age" => user_params.target_age,
        "summary" => user_params.summary,
        "generated_at" => DateTime.utc_now()
      }
    }) do
      {:ok, book} ->
        # 2. Create the pages
        pages_data =
          story_data["pages"]
          |> Enum.map(fn p ->
            %{
              page_number: p["page_number"],
              text_content: p["text"],
              illustration_prompt: p["illustration_prompt"]
            }
          end)

        Content.create_pages_batch(book.id, pages_data)

        # 3. Refresh book with associations
        book = Content.get_book_with_pages!(book.id)

        {:noreply,
         socket
         |> assign(:book, book)
         |> assign(:step, :review_story)
         |> put_flash(:info, "Story created! Review the beats below.")}

      {:error, changeset} ->
        Logger.error("Failed to create book record: #{inspect(changeset)}")
        {:noreply,
         socket
         |> assign(:step, :details)
         |> put_flash(:error, "Failed to save the generated story to the database.")}
    end
  end

  # Render logic...
  @impl true
  def render(assigns) do
    ~H"""
    <div class="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white"><%= @page_title %></h1>
        <p class="mt-2 text-gray-400">Step-by-step production pipeline for born-digital children's books.</p>
      </div>

      <div class="bg-[#161b22] rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
        <div class="p-6">
          <%= if @step == :details do %>
            <.story_details_form form={@form} />
          <% end %>

          <%= if @step == :generating_story do %>
            <div class="flex flex-col items-center justify-center py-12">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
              <h3 class="text-xl font-medium text-white">Claude is writing your story...</h3>
              <p class="text-gray-400 mt-2">This usually takes 30-60 seconds.</p>
            </div>
          <% end %>

          <%= if @step == :review_story do %>
            <.story_review book={@book} />
          <% end %>

          <%= if @step == :illustrations do %>
            <.illustrations_generation book={@book} />
          <% end %>

          <%= if @step == :illustrations_complete do %>
            <.illustrations_review book={@book} />
          <% end %>

          <%= if @step == :narration do %>
            <.narration_generation book={@book} />
          <% end %>

          <%= if @step == :narration_complete do %>
            <.narration_review book={@book} />
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  def story_details_form(assigns) do
    ~H"""
    <form phx-submit="generate_story" class="space-y-6">
      <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        <div class="sm:col-span-4">
          <label class="block text-sm font-medium text-gray-300">Story Title</label>
          <input type="text" name="title" value={@form[:title].value || ""} required class="mt-1 block w-full bg-[#0d1117] border-gray-700 rounded-md shadow-sm text-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>

        <div class="sm:col-span-2">
          <label class="block text-sm font-medium text-gray-300">Target Age</label>
          <select name="target_age" class="mt-1 block w-full bg-[#0d1117] border-gray-700 rounded-md shadow-sm text-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option value="3-5" selected={@form[:target_age].value == "3-5"}>3-5 years</option>
            <option value="6-8" selected={@form[:target_age].value == "6-8"}>6-8 years</option>
            <option value="9-12" selected={@form[:target_age].value == "9-12"}>9-12 years</option>
          </select>
        </div>

        <div class="sm:col-span-6">
          <label class="block text-sm font-medium text-gray-300">Theme / Genre</label>
          <input type="text" name="theme" value={@form[:theme].value || ""} class="mt-1 block w-full bg-[#0d1117] border-gray-700 rounded-md shadow-sm text-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g. Space Adventure, Kindness, Magic Animals" />
        </div>

        <div class="sm:col-span-6">
          <label class="block text-sm font-medium text-gray-300">Plot Summary (The "Spark")</label>
          <textarea name="summary" rows="4" required class="mt-1 block w-full bg-[#0d1117] border-gray-700 rounded-md shadow-sm text-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Tell us what the story is about..."><%= @form[:summary].value || "" %></textarea>
        </div>
      </div>

      <div class="flex justify-end pt-4">
        <button type="submit" class="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          Generate Story with Sonnet
        </button>
      </div>
    </form>
    """
  end

  def story_review(assigns) do
    ~H"""
    <div class="space-y-8">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-semibold text-white">Review Story Beats</h2>
        <div class="flex space-x-3">
          <button class="px-4 py-2 border border-gray-700 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-800">
            Regenerate
          </button>
          <button phx-click="generate_illustrations" class="px-4 py-2 bg-indigo-600 text-sm font-medium rounded-md text-white hover:bg-indigo-700">
            Next: Generate Illustrations
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <%= for page <- Enum.sort_by(@book.pages, & &1.page_number) do %>
          <div class="p-4 bg-[#0d1117] rounded-lg border border-gray-800 group relative">
            <div class="flex items-start space-x-4">
              <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-900/50 text-indigo-400 font-bold border border-indigo-500/30">
                <%= page.page_number %>
              </div>
              <div class="flex-grow">
                <p class="text-lg text-white leading-relaxed"><%= page.text_content %></p>
                <div class="mt-3 p-3 bg-gray-900/50 rounded border border-dashed border-gray-700">
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Illustration Prompt</span>
                  <p class="text-sm text-gray-400 mt-1 italic"><%= page.illustration_prompt %></p>
                </div>
              </div>
            </div>
          </div>
        <% end %>
      </div>
    </div>
    """
  end

  def illustrations_generation(assigns) do
    ~H"""
    <div class="flex flex-col items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
      <h3 class="text-xl font-medium text-white">Generating illustrations...</h3>
      <p class="text-gray-400 mt-2">
        <%= Enum.count(@book.pages, & &1.image_url != nil) %> / <%= length(@book.pages) %> images ready.
      </p>
      <div class="w-64 bg-gray-800 rounded-full h-2.5 mt-4">
        <div class="bg-indigo-600 h-2.5 rounded-full" style={"width: #{Enum.count(@book.pages, & &1.image_url != nil) / length(@book.pages) * 100}%"}></div>
      </div>
    </div>
    """
  end

  def illustrations_review(assigns) do
    ~H"""
    <div class="space-y-8">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-semibold text-white">Review Illustrations</h2>
        <div class="flex space-x-3">
          <button class="px-4 py-2 border border-gray-700 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-800">
            Regenerate All
          </button>
          <button phx-click="generate_narration" class="px-4 py-2 bg-indigo-600 text-sm font-medium rounded-md text-white hover:bg-indigo-700">
            Next: Generate Narration
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <%= for page <- Enum.sort_by(@book.pages, & &1.page_number) do %>
          <div class="bg-[#0d1117] rounded-xl border border-gray-800 overflow-hidden shadow-lg group">
            <div class="aspect-square bg-gray-900 relative">
              <img src={page.image_url} class="w-full h-full object-cover" />
              <div class="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white font-bold backdrop-blur-sm">
                <%= page.page_number %>
              </div>
            </div>
            <div class="p-4">
              <p class="text-sm text-gray-300 line-clamp-3"><%= page.text_content %></p>
            </div>
          </div>
        <% end %>
      </div>
    </div>
    """
  end

  def narration_generation(assigns) do
    ~H"""
    <div class="flex flex-col items-center justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
      <h3 class="text-xl font-medium text-white">Generating narration with ElevenLabs...</h3>
      <p class="text-gray-400 mt-2">
        <%= Enum.count(@book.pages, & &1.narration_url != nil) %> / <%= length(@book.pages) %> pages narrated.
      </p>
      <div class="w-64 bg-gray-800 rounded-full h-2.5 mt-4">
        <div class="bg-indigo-600 h-2.5 rounded-full" style={"width: #{Enum.count(@book.pages, & &1.narration_url != nil) / length(@book.pages) * 100}%"}></div>
      </div>
    </div>
    """
  end

  def narration_review(assigns) do
    ~H"""
    <div class="space-y-8">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-semibold text-white">Review Narration</h2>
        <div class="flex space-x-3">
          <button class="px-4 py-2 border border-gray-700 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-800">
            Regenerate All
          </button>
          <button class="px-4 py-2 bg-indigo-600 text-sm font-medium rounded-md text-white hover:bg-indigo-700">
            Next: Map Soundscapes
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <%= for page <- Enum.sort_by(@book.pages, & &1.page_number) do %>
          <div class="p-4 bg-[#0d1117] rounded-lg border border-gray-800">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-900/50 text-indigo-400 font-bold border border-indigo-500/30">
                  <%= page.page_number %>
                </div>
                <h3 class="text-white font-medium">Page <%= page.page_number %></h3>
              </div>
              <audio controls src={page.narration_url} class="h-8"></audio>
            </div>
            <p class="text-gray-300 text-sm leading-relaxed"><%= page.text_content %></p>
            <%= if page.narration_timestamps do %>
              <div class="mt-2 flex flex-wrap gap-1">
                <span class="text-[10px] text-gray-500 uppercase font-bold w-full mb-1">Timestamps detected: <%= length(Map.get(page.narration_timestamps, "characters", [])) %> characters</span>
              </div>
            <% end %>
          </div>
        <% end %>
      </div>
    </div>
    """
  end
end
