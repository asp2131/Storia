# Quick script to publish Alice in Wonderland
# Run with: mix run priv/repo/publish_alice.exs

alias Storia.Repo
alias Storia.Content.Book

import Ecto.Query

IO.puts("\n📚 Publishing Alice in Wonderland...\n")

# Find the book
book = Repo.get_by(Book, title: "Alice's Adventures in Wonderland")

if book do
  # Update to published
  book
  |> Ecto.Changeset.change(%{
    is_published: true,
    processing_status: "published"
  })
  |> Repo.update!()

  IO.puts("✅ Alice's Adventures in Wonderland is now published!")
  IO.puts("\n🎉 Visit http://localhost:4000/library to read it!\n")
else
  IO.puts("❌ Book not found. Run: mix run priv/repo/seeds_alice.exs first\n")
end
