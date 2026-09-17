import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/util/password.util.ts';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  await prisma.$connect();

  const email = process.env.ADMIN_EMAIL ?? 'admin@kwq.local';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account already exists: ${email}`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD ?? randomUUID();
  await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      role: 'ADMIN',
      webhookToken: randomUUID(),
    },
  });

  if (process.env.ADMIN_PASSWORD) {
    console.log(`Admin account created: ${email}`);
  } else {
    console.log(`Admin account created: ${email} / ${password}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
