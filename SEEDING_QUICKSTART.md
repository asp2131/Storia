# 🚀 Storia Content Seeding - Quick Start

## ✅ What's Ready

Task 14.2 is complete! You now have:

- ✅ **Admin account**: `admin@storia.app` / `Admin123!`
- ✅ **Free tier user**: `free@storia.app` / `FreeUser123!`
- ✅ **Reader tier user**: `reader@storia.app` / `Reader123!`
- ✅ **Bibliophile user**: `bibliophile@storia.app` / `Bibliophile123!`

## 📋 Next Steps for Task 14.1

### Option 1: Manual Upload (Recommended for Testing)

1. **Start the server**:
   ```bash
   mix phx.server
   ```

2. **Log in as admin**:
   - Go to: http://localhost:4000/users/log_in
   - Email: `admin@storia.app`
   - Password: `Admin123!`

3. **Upload a test book**:
   - Navigate to: http://localhost:4000/admin/books
   - Click "Upload New Book"
   - Download a short book from Project Gutenberg (start small!)
   - Fill in metadata and upload

4. **Monitor processing**:
   - Watch the status update in real-time
   - Processing takes ~5-10 minutes per book

5. **Review and publish**:
   - Click "Review" when ready
   - Listen to soundscapes
   - Click "Publish Book"

6. **Test as user**:
   - Log out
   - Log in as `free@storia.app` / `FreeUser123!`
   - Go to: http://localhost:4000/library
   - Read the book!

### Option 2: Batch Upload (For Full Library)

See the comprehensive guide: [`docs/seeding_content_library.md`](./docs/seeding_content_library.md)

This includes:
- 20 recommended public domain books with download links
- Batch processing strategies
- Cost estimates
- Troubleshooting guide

## 📚 Recommended First Books (Short & Easy)

Start with these to test the pipeline:

1. **The Yellow Wallpaper** by Charlotte Perkins Gilman
   - Very short (~6,000 words)
   - Perfect for testing
   - Download: https://www.gutenberg.org/ebooks/1952

2. **Alice's Adventures in Wonderland** by Lewis Carroll
   - Medium length
   - Great for scene detection (many scene changes)
   - Download: https://www.gutenberg.org/ebooks/11

3. **The Strange Case of Dr. Jekyll and Mr. Hyde** by Robert Louis Stevenson
   - Short novella
   - Excellent for soundscape variety
   - Download: https://www.gutenberg.org/ebooks/43

## 💰 Cost Estimates

- **Per book**: $0.50 - $2.00 (AI processing)
- **Test with 3 books**: ~$2-6
- **Full library (20 books)**: ~$10-40

## 🛠️ Useful Commands

```bash
# Re-run seeds (safe to run multiple times)
mix run priv/repo/seeds.exs

# Check Oban jobs in IEx
iex -S mix
Storia.Repo.all(Oban.Job) |> length()

# View book processing status
import Ecto.Query
Storia.Repo.all(from b in Storia.Content.Book, select: {b.title, b.processing_status})

# Make yourself an admin
user = Storia.Repo.get_by!(Storia.Accounts.User, email: "your@email.com")
user |> Ecto.Changeset.change(role: :admin) |> Storia.Repo.update!()
```

## ⚠️ Important Notes

- **Start Small**: Test with 1-2 books first
- **Watch Processing**: Monitor the admin interface for errors
- **Check R2**: Ensure Cloudflare R2 is configured
- **API Limits**: Replicate API may have rate limits
- **Concurrent Processing**: Oban processes 2 books at a time

## 📖 Documentation

- **Full Guide**: [`docs/seeding_content_library.md`](./docs/seeding_content_library.md)
- **Status Report**: [`docs/mvp_core_features_status.md`](./docs/mvp_core_features_status.md)
- **Tasks**: [`.kiro/specs/storia-mvp-core/tasks.md`](./.kiro/specs/storia-mvp-core/tasks.md)

## 🎯 Success Criteria

Task 14 will be complete when:

- [ ] 15-20 books uploaded
- [ ] All books processed successfully
- [ ] All soundscapes reviewed
- [ ] All books published
- [ ] Complete user journey tested (signup → browse → read)

## 🆘 Need Help?

**Processing stuck?**
- Check Oban jobs: `Storia.Repo.all(Oban.Job)`
- Check logs in terminal
- Retry from admin interface

**Upload fails?**
- Verify R2 credentials in `.env`
- Check bucket exists and has correct permissions

**AI generation fails?**
- Verify `REPLICATE_API_TOKEN` in `.env`
- Check API quota and rate limits

---

**Ready to start?** Run `mix phx.server` and head to http://localhost:4000! 🚀
