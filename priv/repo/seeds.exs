# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     Storia.Repo.insert!(%Storia.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

alias Storia.Repo
alias Storia.Accounts
alias Storia.Accounts.User

IO.puts("\n🌱 Seeding Storia database...\n")

# ============================================
# TASK 14.2: Create demo admin and user accounts
# ============================================

IO.puts("📝 Creating demo accounts...")

# Helper function to create or update user
defmodule SeedHelper do
  def create_or_update_user(email, password, role, tier) do
    case Storia.Repo.get_by(Storia.Accounts.User, email: email) do
      nil ->
        # User doesn't exist, create new
        case Storia.Accounts.register_user(%{email: email, password: password}) do
          {:ok, user} ->
            # Update role and tier
            user
            |> Ecto.Changeset.change(role: role, subscription_tier: tier)
            |> Storia.Repo.update!()
            IO.puts("  ✅ Created #{role} account: #{email} (tier: #{tier})")
            user

          {:error, changeset} ->
            IO.puts("  ❌ Failed to create #{email}: #{inspect(changeset.errors)}")
            nil
        end

      user ->
        # User exists, update role and tier
        user
        |> Ecto.Changeset.change(role: role, subscription_tier: tier)
        |> Storia.Repo.update!()
        IO.puts("  ♻️  Updated existing account: #{email} (tier: #{tier})")
        user
    end
  end
end

# Create admin account
SeedHelper.create_or_update_user(
  "admin@storia.app",
  "Admin123!",
  :admin,
  :bibliophile
)

# Create test user accounts for each tier
SeedHelper.create_or_update_user(
  "free@storia.app",
  "FreeUser123!",
  :user,
  :free
)

SeedHelper.create_or_update_user(
  "reader@storia.app",
  "Reader123!",
  :user,
  :reader
)

SeedHelper.create_or_update_user(
  "bibliophile@storia.app",
  "Bibliophile123!",
  :user,
  :bibliophile
)

IO.puts("\n✅ Demo accounts created successfully!\n")

# ============================================
# Account Credentials Summary
# ============================================

IO.puts("""
📋 DEMO ACCOUNT CREDENTIALS
═══════════════════════════════════════════════════════════

ADMIN ACCOUNT (Content Management):
  Email:    admin@storia.app
  Password: Admin123!
  Access:   /admin/books, /admin/library
  Tier:     Bibliophile (unlimited books)

USER ACCOUNTS (Testing Subscription Tiers):

  FREE TIER (3 books max):
    Email:    free@storia.app
    Password: FreeUser123!
    Access:   /library, /read/:id
    Limit:    3 books total

  READER TIER (20 books/month):
    Email:    reader@storia.app
    Password: Reader123!
    Access:   /library, /read/:id
    Limit:    20 books per month

  BIBLIOPHILE TIER (unlimited):
    Email:    bibliophile@storia.app
    Password: Bibliophile123!
    Access:   /library, /read/:id
    Limit:    Unlimited books

═══════════════════════════════════════════════════════════
""")

# ============================================
# TASK 14.1: Public Domain Book Sources
# ============================================

IO.puts("""
📚 NEXT STEP: Upload Public Domain Books
═══════════════════════════════════════════════════════════

To seed the content library, follow these steps:

1. DOWNLOAD PUBLIC DOMAIN BOOKS
   Source: Project Gutenberg (https://www.gutenberg.org)

   Recommended classics (15-20 books):

   NOVELS:
   • Pride and Prejudice - Jane Austen
   • Alice's Adventures in Wonderland - Lewis Carroll
   • The Great Gatsby - F. Scott Fitzgerald
   • Frankenstein - Mary Shelley
   • Dracula - Bram Stoker
   • The Adventures of Sherlock Holmes - Arthur Conan Doyle
   • Jane Eyre - Charlotte Brontë
   • Moby Dick - Herman Melville
   • The Picture of Dorian Gray - Oscar Wilde
   • A Tale of Two Cities - Charles Dickens

   SHORT STORY COLLECTIONS:
   • The Complete Works of Edgar Allan Poe
   • Grimm's Fairy Tales
   • The Yellow Wallpaper - Charlotte Perkins Gilman

   SCIENCE FICTION:
   • The Time Machine - H.G. Wells
   • Twenty Thousand Leagues Under the Sea - Jules Verne

   Download format: Plain Text UTF-8 or PDF
   TIP: Search for "epub to pdf" converters if needed

2. START THE SERVER
   $ mix phx.server

3. LOG IN AS ADMIN
   Navigate to: http://localhost:4000/users/log_in
   Email: admin@storia.app
   Password: Admin123!

4. UPLOAD BOOKS
   Navigate to: http://localhost:4000/admin/books

   For each book:
   a. Click "Upload New Book"
   b. Fill in metadata:
      - Title (e.g., "Pride and Prejudice")
      - Author (e.g., "Jane Austen")
      - Genre (e.g., "Romance", "Classic", "Fiction")
      - Description (short synopsis)
   c. Upload PDF file
   d. Wait for processing pipeline:
      • PDF Processing (text extraction)
      • Scene Analysis (AI classification)
      • Soundscape Generation (AI audio)

   Processing time: ~5-10 minutes per book
   Note: Watch the processing status update in real-time

5. REVIEW SOUNDSCAPES
   Navigate to: http://localhost:4000/admin/books/:id/review

   For each scene:
   a. Listen to generated soundscape
   b. Verify it matches the scene mood
   c. Override with library soundscape if needed
   d. Move to next scene

6. PUBLISH BOOKS
   In Scene Review page:
   a. Click "Publish Book" button
   b. Book becomes visible in user library
   c. Users can now read with soundscapes

7. TEST USER EXPERIENCE
   Log out and log in as a test user:
   a. Visit http://localhost:4000/library
   b. Browse published books
   c. Click a book to start reading
   d. Test audio crossfades between scenes
   e. Verify progress tracking works

═══════════════════════════════════════════════════════════

⚠️  IMPORTANT NOTES:

• API Costs: Each book costs ~$0.50-$2.00 to process
  (Scene classification + soundscape generation)

• Processing Queue: Oban processes 2 PDFs concurrently
  Upload in batches to avoid overwhelming the system

• R2 Storage: Ensure Cloudflare R2 is configured
  Books and audio files are stored in R2 bucket

• Error Handling: Check /admin/books for failed jobs
  Retry failed processing from admin interface

═══════════════════════════════════════════════════════════

🚀 Quick Start Commands:

# Run seeds
mix run priv/repo/seeds.exs

# Start server
mix phx.server

# Open admin interface
open http://localhost:4000/users/log_in

# Check Oban jobs
iex -S mix
Storia.Repo.all(Oban.Job)

# Make any user an admin (if needed)
user = Storia.Repo.get_by!(Storia.Accounts.User, email: "your@email.com")
user |> Ecto.Changeset.change(role: :admin) |> Storia.Repo.update!()

═══════════════════════════════════════════════════════════

Happy seeding! 🌱
""")

IO.puts("\n✅ Seed script completed!\n")
