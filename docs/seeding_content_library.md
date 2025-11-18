# Seeding the Storia Content Library

## Task 14.1: Process Public Domain Classics

This guide will help you seed the Storia content library with 15-20 public domain books from Project Gutenberg.

---

## Prerequisites

- [ ] Database migrated (`mix ecto.migrate`)
- [ ] Seed script run (`mix run priv/repo/seeds.exs`)
- [ ] Server running (`mix phx.server`)
- [ ] Admin account created (see credentials below)
- [ ] Cloudflare R2 configured with credentials
- [ ] Replicate API token configured

---

## Demo Account Credentials

After running the seed script, you'll have these accounts available:

### Admin Account
- **Email**: `admin@storia.app`
- **Password**: `Admin123!`
- **Access**: All admin routes (`/admin/*`)

### Test User Accounts
- **Free Tier**: `free@storia.app` / `FreeUser123!` (3 books max)
- **Reader Tier**: `reader@storia.app` / `Reader123!` (20 books/month)
- **Bibliophile Tier**: `bibliophile@storia.app` / `Bibliophile123!` (unlimited)

---

## Recommended Book Selection (15-20 Books)

### Classic Novels (10 books)

1. **Pride and Prejudice** by Jane Austen
   - Genre: Romance, Classic
   - Gutenberg ID: 1342
   - Download: https://www.gutenberg.org/ebooks/1342

2. **Alice's Adventures in Wonderland** by Lewis Carroll
   - Genre: Fantasy, Children's Literature
   - Gutenberg ID: 11
   - Download: https://www.gutenberg.org/ebooks/11

3. **The Great Gatsby** by F. Scott Fitzgerald
   - Genre: Classic, Fiction
   - Gutenberg ID: 64317
   - Download: https://www.gutenberg.org/ebooks/64317

4. **Frankenstein** by Mary Shelley
   - Genre: Gothic, Science Fiction
   - Gutenberg ID: 84
   - Download: https://www.gutenberg.org/ebooks/84

5. **Dracula** by Bram Stoker
   - Genre: Gothic, Horror
   - Gutenberg ID: 345
   - Download: https://www.gutenberg.org/ebooks/345

6. **The Adventures of Sherlock Holmes** by Arthur Conan Doyle
   - Genre: Mystery, Detective Fiction
   - Gutenberg ID: 1661
   - Download: https://www.gutenberg.org/ebooks/1661

7. **Jane Eyre** by Charlotte Brontë
   - Genre: Romance, Gothic
   - Gutenberg ID: 1260
   - Download: https://www.gutenberg.org/ebooks/1260

8. **Moby Dick** by Herman Melville
   - Genre: Adventure, Classic
   - Gutenberg ID: 2701
   - Download: https://www.gutenberg.org/ebooks/2701

9. **The Picture of Dorian Gray** by Oscar Wilde
   - Genre: Gothic, Philosophical Fiction
   - Gutenberg ID: 174
   - Download: https://www.gutenberg.org/ebooks/174

10. **A Tale of Two Cities** by Charles Dickens
    - Genre: Historical Fiction, Classic
    - Gutenberg ID: 98
    - Download: https://www.gutenberg.org/ebooks/98

### Short Story Collections (3 books)

11. **The Complete Tales and Poems of Edgar Allan Poe**
    - Genre: Horror, Mystery
    - Gutenberg ID: 2147
    - Download: https://www.gutenberg.org/ebooks/2147

12. **Grimm's Fairy Tales**
    - Genre: Fairy Tales, Children's Literature
    - Gutenberg ID: 2591
    - Download: https://www.gutenberg.org/ebooks/2591

13. **The Yellow Wallpaper** by Charlotte Perkins Gilman
    - Genre: Gothic, Feminist Fiction
    - Gutenberg ID: 1952
    - Download: https://www.gutenberg.org/ebooks/1952

### Science Fiction (2 books)

14. **The Time Machine** by H.G. Wells
    - Genre: Science Fiction
    - Gutenberg ID: 35
    - Download: https://www.gutenberg.org/ebooks/35

15. **Twenty Thousand Leagues Under the Sea** by Jules Verne
    - Genre: Science Fiction, Adventure
    - Gutenberg ID: 164
    - Download: https://www.gutenberg.org/ebooks/164

### Additional Options (5 more)

16. **The Adventures of Tom Sawyer** by Mark Twain
    - Gutenberg ID: 74

17. **Wuthering Heights** by Emily Brontë
    - Gutenberg ID: 768

18. **The Invisible Man** by H.G. Wells
    - Gutenberg ID: 5230

19. **Little Women** by Louisa May Alcott
    - Gutenberg ID: 514

20. **The Strange Case of Dr. Jekyll and Mr. Hyde** by Robert Louis Stevenson
    - Gutenberg ID: 43

---

## Step-by-Step Upload Process

### Step 1: Download Books from Project Gutenberg

For each book:

1. Visit the Gutenberg book page (use links above)
2. Click "Plain Text UTF-8" format
3. Save the `.txt` file to your computer

**Converting to PDF** (if needed):
- Use online converters: https://www.online-convert.com/
- Or use `pandoc`: `pandoc book.txt -o book.pdf`
- Or use LibreOffice: Open `.txt` → Export as PDF

### Step 2: Log in as Admin

1. Start the server: `mix phx.server`
2. Navigate to: http://localhost:4000/users/log_in
3. Log in with admin credentials:
   - Email: `admin@storia.app`
   - Password: `Admin123!`

### Step 3: Upload Books via Admin Interface

1. Navigate to: http://localhost:4000/admin/books
2. Click "Upload New Book" button
3. Fill in the form:
   - **Title**: e.g., "Pride and Prejudice"
   - **Author**: e.g., "Jane Austen"
   - **Genre**: e.g., "Romance, Classic"
   - **Description**: Write a 1-2 sentence synopsis
   - **Cover Image** (optional): Upload or leave blank
   - **PDF File**: Select the downloaded PDF
4. Click "Upload Book"
5. Monitor the processing status in real-time

**Processing Pipeline**:
- ⏳ **Uploading** → PDF uploaded to R2 storage
- 🔄 **Processing** → PDF text extraction (1-2 min)
- 🤖 **Analyzing** → AI scene classification (2-3 min)
- 🎵 **Generating** → AI soundscape generation (3-5 min)
- ✅ **Ready for Review** → Complete!

**Estimated time per book**: 5-10 minutes

### Step 4: Review Soundscape Mappings

1. Once a book shows "Ready for Review", click "Review"
2. Navigate to: http://localhost:4000/admin/books/:id/review
3. For each scene:
   - Read the scene text
   - View scene descriptors (setting, mood, time, weather, etc.)
   - Listen to the generated soundscape
   - Verify the audio matches the scene mood
   - **Optional**: Override with library soundscape if needed
4. Navigate through all scenes

### Step 5: Publish Books

1. After reviewing all scenes, click "Publish Book"
2. Confirm the action
3. Book status changes to "Published"
4. Book is now visible in the user library at `/library`

### Step 6: Test the User Experience

1. Log out from admin account
2. Log in as a test user (e.g., `free@storia.app` / `FreeUser123!`)
3. Navigate to: http://localhost:4000/library
4. Browse the published books
5. Click a book to start reading
6. Test features:
   - ✅ Page navigation (next/previous)
   - ✅ Audio crossfading between scenes
   - ✅ Volume control
   - ✅ Mute/unmute toggle
   - ✅ Progress tracking (close and reopen)
   - ✅ Subscription tier limits

---

## Batch Processing Tips

### Upload Strategy

**Small batches** (recommended):
- Upload 3-5 books at a time
- Wait for all to complete processing
- Review and publish before uploading more

**Why?**
- Oban processes 2 PDFs concurrently
- Prevents overwhelming the processing queue
- Easier to monitor and debug issues

### Cost Estimation

**Per book processing cost**:
- Scene classification: ~$0.20-$0.50
- Soundscape generation: ~$0.30-$1.50
- **Total per book**: $0.50-$2.00

**For 20 books**: ~$10-$40 total

### Monitoring Processing

**Check Oban jobs in IEx**:
```elixir
iex -S mix

# View all jobs
Storia.Repo.all(Oban.Job) |> length()

# View failed jobs
import Ecto.Query
Storia.Repo.all(from j in Oban.Job, where: j.state == "discarded")

# View processing jobs
Storia.Repo.all(from j in Oban.Job, where: j.state == "executing")
```

**Check processing status**:
```elixir
# View books by status
import Ecto.Query
Storia.Repo.all(from b in Storia.Content.Book, select: {b.title, b.processing_status})
```

---

## Troubleshooting

### PDF Processing Fails

**Symptoms**: Book stuck in "processing" status

**Solutions**:
1. Check Node.js is installed: `node --version`
2. Check PDF extraction script: `assets/js/extract_pdf.js`
3. View Oban job errors in admin interface
4. Retry processing from admin interface

### Scene Classification Fails

**Symptoms**: Book stuck in "analyzing" status

**Solutions**:
1. Check Replicate API token is configured
2. View Oban job errors
3. Check API rate limits
4. Retry from admin interface

### Soundscape Generation Fails

**Symptoms**: Scenes have no soundscapes

**Solutions**:
1. Check Replicate API token
2. Check R2 storage credentials
3. View Oban job errors
4. Manually generate soundscapes from scene review page

### R2 Upload Fails

**Symptoms**: "Failed to upload file" error

**Solutions**:
1. Verify R2 credentials in `.env`
2. Check R2 bucket exists
3. Verify bucket permissions
4. Check network connectivity

---

## Quality Assurance Checklist

After uploading all books, verify:

- [ ] All books show "Published" status
- [ ] All books visible in `/library` for test users
- [ ] Free tier users can access only 3 books
- [ ] Reader tier users can access 20 books
- [ ] Bibliophile users can access all books
- [ ] Audio crossfades smoothly between scenes
- [ ] Reading progress saves correctly
- [ ] Progress persists across sessions
- [ ] Audio controls (volume, mute) work
- [ ] Genre and author filters work in library
- [ ] "Currently Reading" badges appear correctly

---

## Success Criteria

Task 14 is complete when:

- ✅ 15-20 public domain books uploaded
- ✅ All books processed successfully
- ✅ All soundscape mappings reviewed
- ✅ All books published to library
- ✅ Admin and test user accounts created
- ✅ Complete user journey tested
- ✅ All subscription tier restrictions verified

---

## Next Steps

After seeding the content library:

1. **Deploy to Production** (Task 13)
   - Configure production environment
   - Deploy to Fly.io or Gigalixir
   - Upload books in production

2. **Integrate Stripe** (Task 10)
   - Set up Stripe account
   - Configure subscription tiers
   - Test payment flows

3. **Final Testing** (Task 15)
   - Comprehensive test suite
   - Manual QA on all browsers
   - Performance testing
   - Launch preparation

---

## Resources

- **Project Gutenberg**: https://www.gutenberg.org
- **Text to PDF Converter**: https://www.online-convert.com/
- **Pandoc Documentation**: https://pandoc.org/
- **Cloudflare R2 Docs**: https://developers.cloudflare.com/r2/
- **Replicate API Docs**: https://replicate.com/docs

---

**Created**: 2025-11-17  
**Task**: 14.1 & 14.2 - Seed Initial Content Library  
**Status**: Ready for execution
