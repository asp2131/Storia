import bcrypt from "bcryptjs";
import { db } from "./db";

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns true if password matches
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Get user by email
 * @param email - User email
 * @returns User or null
 */
export async function getUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email },
  });
}

/**
 * Get user by ID
 * @param id - User ID
 * @returns User or null
 */
export async function getUserById(id: string) {
  return db.user.findUnique({
    where: { id },
  });
}

/**
 * Create a new user
 * @param email - User email
 * @param password - Plain text password
 * @param name - User name (optional)
 * @returns Created user
 */
export async function createUser(
  email: string,
  password: string,
  name?: string
) {
  const passwordHash = await hashPassword(password);

  return db.user.create({
    data: {
      email,
      passwordHash,
      name,
      subscriptionTier: "free",
    },
  });
}

/**
 * Update user password
 * @param userId - User ID
 * @param newPassword - New plain text password
 */
export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);

  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

/**
 * Check if user can upload more books based on subscription tier
 * @param userId - User ID
 * @returns true if user can upload more books
 */
export async function canUserUploadBook(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      books: true,
    },
  });

  if (!user) return false;

  const bookCount = user.books.length;

  switch (user.subscriptionTier) {
    case "free":
      return bookCount < 3;
    case "reader":
      return bookCount < 20;
    case "bibliophile":
      return true; // unlimited
    default:
      return false;
  }
}

/**
 * Get the current authenticated user from session
 * @returns User or null
 */
export async function getCurrentUser() {
  const { auth } = await import("@/auth");
  
  const session = await auth();
  
  if (!session?.user?.id) {
    return null;
  }
  
  return getUserById(session.user.id);
}

/**
 * Require authentication - throws error if not authenticated
 * @returns User
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }
  
  return user;
}
