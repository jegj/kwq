import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/util/password.util.ts';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const defaultCategories = [
  { name: 'Comida', icon: '🍔', color: '#f97316' },
  { name: 'Servicios Basicos', icon: '💡', color: '#eab308' },
  { name: 'Medicina', icon: '💊', color: '#ef4444' },
  { name: 'Otras Compras', icon: '🛍️', color: '#a855f7' },
  { name: 'Carro', icon: '🚗', color: '#3b82f6' },
];

async function seedDefaultCategories() {
  for (const category of defaultCategories) {
    const existing = await prisma.category.findFirst({
      where: { userId: null, name: category.name },
    });
    if (existing) continue;

    await prisma.category.create({ data: { userId: null, ...category } });
  }
}

async function main() {
  await prisma.$connect();
  await seedDefaultCategories();

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
    },
  });

  if (process.env.ADMIN_PASSWORD) {
    console.log(`Admin account created: ${email}`);
  } else {
    console.log(`Admin account created: ${email} / ${password}`);
  }
  console.log('Generate a webhook token from Settings after logging in.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
