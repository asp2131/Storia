import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function setUserRole(email: string, role: string): Promise<void> {
  await prisma.user.update({
    where: { email },
    data: { role },
  });
}

export async function deleteUserByEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({
    where: { email },
  });
}
