import { db } from "../lib/db.js";

async function testConnection() {
  try {
    console.log("Testing database connection...");
    
    // Test connection by querying the database
    const result = await db.$queryRaw`SELECT current_database(), current_user, version()`;
    console.log("✅ Database connection successful!");
    console.log("Database info:", result);
    
    // Count tables
    const userCount = await db.user.count();
    const bookCount = await db.book.count();
    
    console.log(`\n📊 Current data:`);
    console.log(`- Users: ${userCount}`);
    console.log(`- Books: ${bookCount}`);
    
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

testConnection();
