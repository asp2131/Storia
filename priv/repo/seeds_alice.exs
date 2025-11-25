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
    total_pages: 0, # Will be updated after extraction
    metadata: %{
      "genre" => "Fantasy, Children's Literature",
      "publication_year" => "1865",
      "description" => "Follow Alice down the rabbit hole into a fantastical world of wonder, whimsy, and curious adventures."
    }
  })
  book
end

# Scene data from the latest AI analysis (10 scenes, pages 8-21)
# Boundaries: [8, 9, 10, 11, 13, 15, 16, 18, 19, 20]
scenes_data = [
  %{
    scene_number: 1,
    start_page: 8,
    end_page: 8,
    descriptors: %{
      "setting" => "riverside",
      "mood" => "curious",
      "time_of_day" => "afternoon",
      "weather" => "sunny",
      "dominant_elements" => "birds, rustling, wonder",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "discovery"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.8}
  },
  %{
    scene_number: 2,
    start_page: 9,
    end_page: 9,
    descriptors: %{
      "setting" => "underground",
      "mood" => "curious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "wonder, echoes, isolation",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "discovery"
    },
    soundscape: %{file: "Echoing_Cave.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 3,
    start_page: 10,
    end_page: 10,
    descriptors: %{
      "setting" => "unknown",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "wind, wonder, isolation",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Howling_Wind.mp3", category: "nature", confidence: 1.0}
  },
  %{
    scene_number: 4,
    start_page: 11,
    end_page: 12,
    descriptors: %{
      "setting" => "hall",
      "mood" => "curious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "footsteps, echoes, wonder",
      "activity_level" => "active",
      "atmosphere" => "adventurous",
      "scene_type" => "discovery"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 5,
    start_page: 13,
    end_page: 14,
    descriptors: %{
      "setting" => "magical_realm",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "silence, footsteps, wonder",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 6,
    start_page: 15,
    end_page: 15,
    descriptors: %{
      "setting" => "underground",
      "mood" => "curious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "wonder, magic, mystery",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "transformation"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 7,
    start_page: 16,
    end_page: 17,
    descriptors: %{
      "setting" => "hall",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "footsteps, echoes, isolation",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Giant's_Footsteps.mp3", category: "magic", confidence: 1.0}
  },
  %{
    scene_number: 8,
    start_page: 18,
    end_page: 18,
    descriptors: %{
      "setting" => "unknown",
      "mood" => "anxious",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "silence, voices, isolation",
      "activity_level" => "calm",
      "atmosphere" => "contemplative",
      "scene_type" => "introspection"
    },
    soundscape: %{file: "Rain-soaked_Forest_Silence.mp3", category: "nature", confidence: 0.9}
  },
  %{
    scene_number: 9,
    start_page: 19,
    end_page: 19,
    descriptors: %{
      "setting" => "underground",
      "mood" => "desperate",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "isolation, tension, echoes",
      "activity_level" => "moderate",
      "atmosphere" => "dramatic",
      "scene_type" => "transformation"
    },
    soundscape: %{file: "Echoing_Cave.mp3", category: "nature", confidence: 0.4}
  },
  %{
    scene_number: 10,
    start_page: 20,
    end_page: 21,
    descriptors: %{
      "setting" => "dreamscape",
      "mood" => "whimsical",
      "time_of_day" => "unknown",
      "weather" => "unknown",
      "dominant_elements" => "water, voices, wonder",
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "scene_type" => "dialogue"
    },
    soundscape: %{file: "Light_Gentle_Rain.mp3", category: "nature", confidence: 0.4}
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

# Extract text using Rust NIF - Extract entire book with smart chunking
case RustReader.extract_pdf(pdf_path) do
  {pages_json, _metadata} ->
    # Parse JSON pages from Rust
    pages_data = Enum.map(pages_json, fn json_str ->
      Jason.decode!(json_str)
    end)

    IO.puts("  ✓ Extracted #{length(pages_data)} pages from entire book using Rust (Smart Chunking)")

    # Create pages in database
    pages_to_insert = Enum.map(pages_data, fn page ->
      %{
        book_id: book.id,
        page_number: page["page_number"],
        text_content: page["text_content"],
        inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
        updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
      }
    end)

    {count, _} = Repo.insert_all(Content.Page, pages_to_insert)
    IO.puts("  ✓ Created #{count} page records")

    # Update book with actual page count
    Content.update_book(book, %{total_pages: count})

  {:error, reason} ->
    IO.puts("❌ PDF extraction failed: #{inspect(reason)}")
    System.halt(1)
end

# Load curated soundscapes from bucket
IO.puts("🎵 Loading curated soundscapes...")
{:ok, curated_soundscapes} = Soundscapes.list_curated_soundscapes_from_bucket()

IO.puts("📄 Creating #{length(scenes_data)} scenes with soundscapes (Chapter 1 only)...")

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
  Pages:  #{Repo.reload(book).total_pages} (entire book extracted)
  Scenes: #{length(created_scenes)} (Chapter 1 with soundscapes)
  Status: Published ✓

SOUNDSCAPE MAPPING (Chapter 1 only - pages 8-21):
  • Scene 1:  Rain-soaked Forest Silence (nature) - Riverside
  • Scene 2:  Echoing Cave (nature) - Underground
  • Scene 3:  Howling Wind (nature) - Unknown (Introspection)
  • Scene 4:  Giant's Footsteps (magic) - Hall
  • Scene 5:  Giant's Footsteps (magic) - Magical Realm
  • Scene 6:  Dark Magic Rumble (magic) - Underground Transformation
  • Scene 7:  Giant's Footsteps (magic) - Hall
  • Scene 8:  Rain-soaked Forest Silence (nature) - Introspection
  • Scene 9:  Echoing Cave (nature) - Underground Transformation
  • Scene 10: Light Gentle Rain (nature) - Dreamscape Dialogue

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

  5. Read the entire book with Chapter 1 featuring immersive soundscapes!

═══════════════════════════════════════════════════════════

💡 STRATEGY: The entire book is extracted and stored in the database,
but only Chapter 1 (pages 8-21) has soundscape mappings. This provides
a complete reading experience while keeping API costs manageable.
Future chapters can be enhanced with soundscapes on-demand!

""")

IO.puts("✅ Seed completed!\n")
