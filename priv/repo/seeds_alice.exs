# Seed script for Alice's Adventures in Wonderland (First Chapter)
# This creates a fully readable book with scenes and soundscapes
#
# Run with: mix run priv/repo/seeds_alice.exs

alias Storia.Repo
alias Storia.Content
alias Storia.Content.{Book, Scene}
alias Storia.Soundscapes

import Ecto.Query

IO.puts("\n🐰 Seeding Alice's Adventures in Wonderland...\n")

# Check if book already exists
existing_book = Repo.get_by(Book, title: "Alice's Adventures in Wonderland")

book = if existing_book do
  IO.puts("📖 Found existing book, updating...")
  {:ok, updated_book} = Content.update_book(existing_book, %{
    pdf_url: "/books/Alice_in_Wonderland.pdf",
    total_pages: 10,
    processing_status: "pending"
  })
  updated_book
else
  IO.puts("📖 Creating new book...")
  {:ok, book} = Content.create_book(%{
    title: "Alice's Adventures in Wonderland",
    author: "Lewis Carroll",
    pdf_url: "/books/Alice_in_Wonderland.pdf",
    processing_status: "pending",
    total_pages: 10,
    metadata: %{
      "genre" => "Fantasy, Children's Literature",
      "publication_year" => "1865",
      "description" => "Follow Alice down the rabbit hole into a fantastical world of wonder, whimsy, and curious adventures."
    }
  })
  book
end

# Scene data from the analysis with page text summaries
scenes_data = [
  %{
    scene_number: 1,
    start_page: 8,
    end_page: 8,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "peaceful",
      "dominant_elements" => "water, silence, voices",
      "mood" => "curious",
      "scene_type" => "rest",
      "setting" => "riverside",
      "time_of_day" => "afternoon",
      "weather" => "clear"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 2,
    start_page: 9,
    end_page: 9,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "wonder, mystery, clock",
      "mood" => "curious",
      "scene_type" => "journey",
      "setting" => "underground",
      "time_of_day" => "midday",
      "weather" => "sunny"
    },
    soundscape: %{file: "Echoing_Cave.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 3,
    start_page: 10,
    end_page: 10,
    descriptors: %{
      "activity_level" => "intense",
      "atmosphere" => "whimsical",
      "dominant_elements" => "echoes, wonder, isolation",
      "mood" => "whimsical",
      "scene_type" => "introspection",
      "setting" => "magical_realm",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.45}
  },
  %{
    scene_number: 4,
    start_page: 11,
    end_page: 11,
    descriptors: %{
      "activity_level" => "active",
      "atmosphere" => "magical",
      "dominant_elements" => "voices, footsteps, mystery",
      "mood" => "curious",
      "scene_type" => "journey",
      "setting" => "underground",
      "time_of_day" => "night",
      "weather" => "unknown"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 0.75}
  },
  %{
    scene_number: 5,
    start_page: 12,
    end_page: 12,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "wonder, mystery, isolation",
      "mood" => "curious",
      "scene_type" => "discovery",
      "setting" => "hall",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Cozy_Cabin_Interior.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 6,
    start_page: 13,
    end_page: 14,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "tension, wonder, isolation",
      "mood" => "uncertain",
      "scene_type" => "introspection",
      "setting" => "chamber",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Cozy_Cabin_Interior.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 7,
    start_page: 15,
    end_page: 15,
    descriptors: %{
      "activity_level" => "active",
      "atmosphere" => "whimsical",
      "dominant_elements" => "voices, wonder, magic",
      "mood" => "curious",
      "scene_type" => "transformation",
      "setting" => "magical_realm",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 1.0}
  }
]

# Delete existing scenes and pages for this book to avoid duplicates
IO.puts("🧹 Cleaning up existing scenes and pages...")
from(s in Scene, where: s.book_id == ^book.id)
|> Repo.delete_all()

from(p in Content.Page, where: p.book_id == ^book.id)
|> Repo.delete_all()

# Extract pages from PDF
IO.puts("📄 Extracting pages from PDF...")

root_pdf_path = Path.join(File.cwd!(), "Alice_in_Wonderland.pdf")
public_pdf_dir = Path.join([File.cwd!(), "priv", "static", "books"])
public_pdf_path = Path.join(public_pdf_dir, "Alice_in_Wonderland.pdf")

# Ensure public directory exists
File.mkdir_p!(public_pdf_dir)

# Determine which PDF to use
pdf_path = cond do
  File.exists?(root_pdf_path) ->
    # Copy to public if not already there
    unless File.exists?(public_pdf_path) do
      File.cp!(root_pdf_path, public_pdf_path)
      IO.puts("  ✓ Copied PDF to #{public_pdf_path}")
    end
    root_pdf_path

  File.exists?(public_pdf_path) ->
    IO.puts("  ✓ PDF already in public directory")
    public_pdf_path

  true ->
    IO.puts("❌ ERROR: Alice_in_Wonderland.pdf not found in project root or public directory!")
    IO.puts("   Please download it from: https://www.gutenberg.org/ebooks/11")
    System.halt(1)
end

# Extract text using Rust NIF
case RustReader.extract_pdf(pdf_path) do
  {full_text, _metadata} ->
    # Split text into pages (simple split by page breaks or chunks)
    # For now, we'll create a single page per chapter page (8-15)
    pages_text = String.split(full_text, ~r/\f|\n{3,}/, trim: true)

    # Filter to chapter 1 pages (8-15) - take first 8 meaningful chunks
    chapter_pages = Enum.take(pages_text, 8)

    pages_data = chapter_pages
    |> Enum.with_index(8)
    |> Enum.map(fn {text, page_num} ->
      %{"page_number" => page_num, "text" => String.trim(text)}
    end)

    IO.puts("  ✓ Extracted #{length(pages_data)} pages using Rust")

    # Create pages in database
    pages_to_insert = Enum.map(pages_data, fn page ->
      %{
        book_id: book.id,
        page_number: page["page_number"],
        text_content: page["text"] || "",
        inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
        updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
      }
    end)

    {count, _} = Repo.insert_all(Content.Page, pages_to_insert)
    IO.puts("  ✓ Created #{count} page records")

  {:error, reason} ->
    IO.puts("❌ PDF extraction failed: #{inspect(reason)}")
    System.halt(1)
end

# Load curated soundscapes from bucket
IO.puts("🎵 Loading curated soundscapes...")
{:ok, curated_soundscapes} = Soundscapes.list_curated_soundscapes_from_bucket()

IO.puts("📄 Creating #{length(scenes_data)} scenes with soundscapes...")

# Create scenes and assign soundscapes
created_scenes = Enum.map(scenes_data, fn scene_data ->
  # Create the scene
  {:ok, scene} = %Scene{}
  |> Scene.changeset(%{
    book_id: book.id,
    scene_number: scene_data.scene_number,
    start_page: scene_data.start_page,
    end_page: scene_data.end_page,
    descriptors: scene_data.descriptors
  })
  |> Repo.insert()

  IO.puts("  ✓ Scene #{scene_data.scene_number} (pages #{scene_data.start_page}-#{scene_data.end_page})")

  # Link pages to this scene
  from(p in Content.Page,
    where: p.book_id == ^book.id,
    where: p.page_number >= ^scene_data.start_page,
    where: p.page_number <= ^scene_data.end_page
  )
  |> Repo.update_all(set: [scene_id: scene.id])

  # Assign soundscape if available
  if scene_data.soundscape do
    soundscape_info = scene_data.soundscape
    category = soundscape_info.category

    # Find the file in curated soundscapes
    files = Map.get(curated_soundscapes, category, [])
    file_info = Enum.find(files, fn f -> f.name == soundscape_info.file end)

    if file_info do
      case Soundscapes.create_soundscape_from_bucket(scene.id, file_info, category) do
        {:ok, _soundscape} ->
          IO.puts("    🎵 Assigned: #{soundscape_info.file} (confidence: #{soundscape_info.confidence})")
        {:error, reason} ->
          IO.puts("    ⚠️  Failed to assign soundscape: #{inspect(reason)}")
      end
    else
      IO.puts("    ⚠️  Soundscape file not found: #{soundscape_info.file}")
    end
  else
    IO.puts("    ⚠️  No soundscape match")
  end

  scene
end)

# Update book status to published
IO.puts("\n📚 Publishing book...")
{:ok, _book} = Content.update_book(book, %{
  processing_status: "published",
  is_published: true
})

IO.puts("""

✅ Alice's Adventures in Wonderland is ready!

═══════════════════════════════════════════════════════════
BOOK DETAILS:
  Title:  #{book.title}
  Author: #{book.author}
  Pages:  #{book.total_pages} (first chapter)
  Scenes: #{length(created_scenes)}
  Status: Published ✓

SOUNDSCAPE MAPPING:
  • Scene 1: Rain-soaked Forest Silence (nature) - Riverside setting
  • Scene 2: Echoing Cave (nature) - Underground journey
  • Scene 3: Dark Magic Rumble (magic) - Magical Realm
  • Scene 4: Giant's Footsteps (magic) - Underground journey
  • Scene 5: Cozy Cabin Interior (nature) - Hall discovery
  • Scene 6: Cozy Cabin Interior (nature) - Chamber introspection
  • Scene 7: Dark Magic Rumble (magic) - Transformation scene

═══════════════════════════════════════════════════════════

🎉 READY TO READ!

Start the server and enjoy the full experience:

  1. Start server:
     $ mix phx.server

  2. Log in as any user:
     - free@storia.app / FreeUser123!
     - reader@storia.app / Reader123!
     - bibliophile@storia.app / Bibliophile123!

  3. Visit the library:
     http://localhost:4000/library

  4. Click on "Alice's Adventures in Wonderland"

  5. Experience the first chapter with immersive soundscapes!

═══════════════════════════════════════════════════════════

💡 TIP: The improved scene detection now better groups the long
underground sequence (Scene 5, pages 12-13) while still capturing
distinct moments like the dreamscape and hall discovery.

""")

IO.puts("✅ Seed completed!\n")
