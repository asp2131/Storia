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
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
