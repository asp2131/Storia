import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create sample books
  const books = await Promise.all([
    prisma.books.create({
      data: {
        title: "The Little Prince",
        author: "Antoine de Saint-Exupéry",
        description: "A classic tale about a young prince who travels from planet to planet, learning about life and love.",
        cover_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
        is_published: true,
        total_pages: 3,
        source_type: "public_domain",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
    prisma.books.create({
      data: {
        title: "Alice's Adventures in Wonderland",
        author: "Lewis Carroll",
        description: "Alice falls through a rabbit hole into a fantasy world of curious creatures.",
        cover_url: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400",
        is_published: true,
        total_pages: 2,
        source_type: "public_domain",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
    prisma.books.create({
      data: {
        title: "The Tale of Peter Rabbit",
        author: "Beatrix Potter",
        description: "The story of a mischievous young rabbit who disobeys his mother.",
        cover_url: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400",
        is_published: false,
        total_pages: 2,
        source_type: "public_domain",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
  ]);

  console.log(`✅ Created ${books.length} books`);

  // Create pages for The Little Prince
  const littlePrincePages = await Promise.all([
    prisma.pages.create({
      data: {
        book_id: books[0].id,
        page_number: 1,
        text_content: "Once when I was six years old I saw a magnificent picture in a book, called True Stories from Nature, about the primeval forest. It was a picture of a boa constrictor in the act of swallowing an animal.",
        image_url: "https://images.unsplash.com/photo-1511497584788-876760111969?w=800",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
    prisma.pages.create({
      data: {
        book_id: books[0].id,
        page_number: 2,
        text_content: "The grown-ups' response, this time, was to advise me to lay aside my drawings of boa constrictors, whether from the inside or the outside, and devote myself instead to geography, history, arithmetic and grammar.",
        image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
    prisma.pages.create({
      data: {
        book_id: books[0].id,
        page_number: 3,
        text_content: "So I lived my life alone, without anyone that I could really talk to, until I had an accident with my plane in the Desert of Sahara, six years ago.",
        image_url: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
  ]);

  // Create pages for Alice
  const alicePages = await Promise.all([
    prisma.pages.create({
      data: {
        book_id: books[1].id,
        page_number: 1,
        text_content: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it.",
        image_url: "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?w=800",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
    prisma.pages.create({
      data: {
        book_id: books[1].id,
        page_number: 2,
        text_content: "So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.",
        image_url: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
  ]);

  // Create pages for Peter Rabbit
  await Promise.all([
    prisma.pages.create({
      data: {
        book_id: books[2].id,
        page_number: 1,
        text_content: "Once upon a time there were four little Rabbits, and their names were—Flopsy, Mopsy, Cotton-tail, and Peter.",
        image_url: "https://images.unsplash.com/photo-1585110396063-7a1a0427a1bb?w=800",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
    prisma.pages.create({
      data: {
        book_id: books[2].id,
        page_number: 2,
        text_content: "They lived with their Mother in a sand-bank, underneath the root of a very big fir-tree.",
        image_url: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800",
        inserted_at: new Date(),
        updated_at: new Date(),
      },
    }),
  ]);

  console.log(`✅ Created ${littlePrincePages.length + alicePages.length + 2} pages`);

  // Create an admin user (for Better Auth)
  await prisma.user.create({
    data: {
      id: "admin_user_001",
      name: "Admin User",
      email: "admin@storia.app",
      role: "admin",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log("✅ Created admin user: admin@storia.app");

  console.log("\n🎉 Seeding complete!");
  console.log("\nSample data:");
  console.log(`- ${books.length} books`);
  console.log(`- ${littlePrincePages.length + alicePages.length + 2} pages`);
  console.log(`- 1 admin user (admin@storia.app)`);

  // ============================================================
  // PROOF-TEST SEED DATA: child profiles, progress, sessions,
  // questions, and question attempts
  // ============================================================

  const existingChildProfiles = await prisma.child_profile.count();
  if (existingChildProfiles > 0) {
    console.log(
      "\n⏭️  Skipping proof-test seed data (child_profile records already exist)"
    );
  } else {
    console.log("\n🧪 Seeding proof-test data...");

    // 1. Find or create a test user
    let testUser = await prisma.user.findFirst();
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          name: "Test User",
          email: "test@storia.app",
          emailVerified: true,
        },
      });
      console.log("✅ Created test user: test@storia.app");
    }

    // 2. Create 2 child profiles
    const ava = await prisma.child_profile.create({
      data: {
        userId: testUser.id,
        displayName: "Ava",
        ageBand: "7-9",
        isDefault: true,
      },
    });

    const leo = await prisma.child_profile.create({
      data: {
        userId: testUser.id,
        displayName: "Leo",
        ageBand: "5-7",
        isDefault: false,
      },
    });

    console.log("✅ Created 2 child profiles: Ava, Leo");

    // 3. Get 2 published books for progress/session data
    const publishedBooks = await prisma.books.findMany({
      where: { is_published: true },
      take: 2,
      orderBy: { id: "asc" },
    });

    if (publishedBooks.length < 2) {
      console.log(
        "⚠️  Not enough published books for proof-test progress data"
      );
    } else {
      const book1 = publishedBooks[0];
      const book2 = publishedBooks[1];

      // 4. Create child_book_progress entries
      await prisma.child_book_progress.create({
        data: {
          childProfileId: ava.id,
          bookId: book1.id,
          currentPage: 7,
          totalPages: 24,
          lastReadAt: new Date(),
        },
      });

      await prisma.child_book_progress.create({
        data: {
          childProfileId: ava.id,
          bookId: book2.id,
          currentPage: 24,
          totalPages: 24,
          lastReadAt: new Date(),
          completedAt: new Date(),
          completionCount: 1,
        },
      });

      console.log("✅ Created 2 child_book_progress entries for Ava");

      // 5. Create 3 reading sessions
      const now = new Date();
      const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      await prisma.reading_session.createMany({
        data: [
          {
            sessionId: "rs_seed_001",
            userId: testUser.id,
            childProfileId: ava.id,
            bookId: book1.id,
            startedAt: thirtyMinAgo,
            endedAt: fifteenMinAgo,
            durationSeconds: 15 * 60,
            startPage: 1,
            endPage: 7,
            entryIntent: "standard",
          },
          {
            sessionId: "rs_seed_002",
            userId: testUser.id,
            childProfileId: ava.id,
            bookId: book2.id,
            startedAt: oneHourAgo,
            endedAt: new Date(oneHourAgo.getTime() + 20 * 60 * 1000),
            durationSeconds: 20 * 60,
            startPage: 1,
            endPage: 24,
            entryIntent: "autoplay_narration",
            usedNarration: true,
            completedBook: true,
          },
          {
            sessionId: "rs_seed_003",
            userId: testUser.id,
            childProfileId: leo.id,
            bookId: book1.id,
            startedAt: fifteenMinAgo,
            endedAt: new Date(fifteenMinAgo.getTime() + 10 * 60 * 1000),
            durationSeconds: 10 * 60,
            startPage: 1,
            endPage: 3,
            entryIntent: "standard",
          },
        ],
      });

      console.log("✅ Created 3 reading sessions");

      // 6. Create 3 book questions with options for book1
      const q1 = await prisma.book_question.create({
        data: {
          bookId: book1.id,
          questionText: "Where did the narrator have an accident?",
          sortOrder: 1,
          correctAnswer: "A",
          options: {
            create: [
              { optionKey: "A", optionText: "The Desert of Sahara", sortOrder: 0 },
              { optionKey: "B", optionText: "A tropical rainforest", sortOrder: 1 },
              { optionKey: "C", optionText: "The Arctic tundra", sortOrder: 2 },
            ],
          },
        },
      });

      const q2 = await prisma.book_question.create({
        data: {
          bookId: book1.id,
          questionText: "What did the grown-ups advise the narrator to study?",
          sortOrder: 2,
          correctAnswer: "B",
          options: {
            create: [
              { optionKey: "A", optionText: "Drawing and painting", sortOrder: 0 },
              {
                optionKey: "B",
                optionText: "Geography, history, arithmetic and grammar",
                sortOrder: 1,
              },
              { optionKey: "C", optionText: "Music and literature", sortOrder: 2 },
            ],
          },
        },
      });

      const q3 = await prisma.book_question.create({
        data: {
          bookId: book1.id,
          questionText: "What animal was in the picture the narrator saw at age six?",
          sortOrder: 3,
          correctAnswer: "C",
          options: {
            create: [
              { optionKey: "A", optionText: "A lion", sortOrder: 0 },
              { optionKey: "B", optionText: "An elephant", sortOrder: 1 },
              { optionKey: "C", optionText: "A boa constrictor", sortOrder: 2 },
            ],
          },
        },
      });

      console.log("✅ Created 3 book questions with options");

      // 7. Create 2 question attempts for Ava (1 correct, 1 incorrect)
      await prisma.question_attempt.createMany({
        data: [
          {
            userId: testUser.id,
            childProfileId: ava.id,
            bookId: book1.id,
            questionId: q1.id,
            readingSessionId: "rs_seed_001",
            selectedAnswer: "A",
            isCorrect: true,
          },
          {
            userId: testUser.id,
            childProfileId: ava.id,
            bookId: book1.id,
            questionId: q2.id,
            readingSessionId: "rs_seed_001",
            selectedAnswer: "A",
            isCorrect: false,
          },
        ],
      });

      console.log("✅ Created 2 question attempts for Ava (1 correct, 1 incorrect)");
    }

    console.log("\n🧪 Proof-test seed data complete!");
  }
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
