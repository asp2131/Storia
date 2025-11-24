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
  existing_book
else
  IO.puts("📖 Creating new book...")
  {:ok, book} = Content.create_book(%{
    title: "Alice's Adventures in Wonderland",
    author: "Lewis Carroll",
    pdf_url: "/Users/akinpound/Documents/experiments/storia/Alice_in_Wonderland.pdf",
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
    start_page: 1,
    end_page: 1,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "wonder, mystery, silence",
      "mood" => "curious",
      "scene_type" => "description",
      "setting" => "library",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 2,
    start_page: 2,
    end_page: 2,
    descriptors: %{
      "activity_level" => "calm",
      "atmosphere" => "whimsical",
      "dominant_elements" => "water, voices, wonder",
      "mood" => "playful",
      "scene_type" => "journey",
      "setting" => "riverside",
      "time_of_day" => "afternoon",
      "weather" => "sunny"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 3,
    start_page: 3,
    end_page: 3,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "magical",
      "dominant_elements" => "voices, wonder, silence",
      "mood" => "playful",
      "scene_type" => "description",
      "setting" => "dreamscape",
      "time_of_day" => "dusk",
      "weather" => "unknown"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.63}
  },
  %{
    scene_number: 4,
    start_page: 4,
    end_page: 4,
    descriptors: %{
      "activity_level" => "intense",
      "atmosphere" => "whimsical",
      "dominant_elements" => "wind, mystery, echoes",
      "mood" => "curious",
      "scene_type" => "journey",
      "setting" => "underground",
      "time_of_day" => "midday",
      "weather" => "clear"
    },
    soundscape: %{file: "Footsteps_in_Snow.mp3", category: "movement", confidence: 0.28}
  },
  %{
    scene_number: 5,
    start_page: 5,
    end_page: 8,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "echoes, rustling, wonder",
      "mood" => "whimsical",
      "scene_type" => "introspection",
      "setting" => "underground",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Awe_&_Wonder.mp3", category: "sentiment", confidence: 0.4}
  },
  %{
    scene_number: 6,
    start_page: 9,
    end_page: 9,
    descriptors: %{
      "activity_level" => "moderate",
      "atmosphere" => "whimsical",
      "dominant_elements" => "wonder, mystery, magic",
      "mood" => "curious",
      "scene_type" => "discovery",
      "setting" => "hall",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.4}
  },
  %{
    scene_number: 7,
    start_page: 10,
    end_page: 10,
    descriptors: %{
      "activity_level" => "still",
      "atmosphere" => "whimsical",
      "dominant_elements" => "wonder, magic, isolation",
      "mood" => "curious",
      "scene_type" => "transformation",
      "setting" => "chamber",
      "time_of_day" => "unknown",
      "weather" => "unknown"
    },
    soundscape: %{file: "Dark_Magic_Rumble.mp3", category: "magic", confidence: 0.4}
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
pdf_path = Path.join(File.cwd!(), "Alice_in_Wonderland.pdf")

unless File.exists?(pdf_path) do
  IO.puts("❌ ERROR: Alice_in_Wonderland.pdf not found in project root!")
  IO.puts("   Please download it from: https://www.gutenberg.org/ebooks/11")
  System.halt(1)
end

script_path = Path.join([File.cwd!(), "scripts", "pdf_processor", "extract.js"])

case System.cmd("node", [script_path, pdf_path, "10"], stderr_to_stdout: true) do
  {output, 0} ->
    case Jason.decode(output) do
      {:ok, %{"success" => true, "pages" => pages_data}} ->
        IO.puts("  ✓ Extracted #{length(pages_data)} pages")

        # Create pages in database
        pages_to_insert = Enum.map(pages_data, fn page ->
          %{
            book_id: book.id,
            page_number: page["page_number"],
            text_content: page["text_content"] || "",
            inserted_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second),
            updated_at: NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
          }
        end)

        {count, _} = Repo.insert_all(Content.Page, pages_to_insert)
        IO.puts("  ✓ Created #{count} page records")

      {:ok, result} ->
        IO.puts("❌ PDF extraction failed: #{inspect(result)}")
        System.halt(1)

      {:error, reason} ->
        IO.puts("❌ Failed to parse JSON: #{inspect(reason)}")
        System.halt(1)
    end

  {output, exit_code} ->
    IO.puts("❌ PDF extraction failed with exit code #{exit_code}")
    IO.puts(output)
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
  • Scene 1: Awe & Wonder (sentiment) - Library setting
  • Scene 2: Awe & Wonder (sentiment) - Riverside journey
  • Scene 3: Dark Magic Rumble (magic) - Dreamscape
  • Scene 4: Footsteps in Snow (movement) - Underground journey
  • Scene 5: Awe & Wonder (sentiment) - Underground introspection
  • Scene 6: Dark Magic Rumble (magic) - Hall discovery
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
underground sequence (Scene 5, pages 5-8) while still capturing
distinct moments like the dreamscape and hall discovery.

""")

IO.puts("✅ Seed completed!\n")
