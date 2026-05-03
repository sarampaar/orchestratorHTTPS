import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  
  // Check if posts exist
  const count = await prisma.post.count();
  if (count === 0) {
    await prisma.post.create({
      data: {
        title: 'Welcome to the SSG Architecture',
        content: 'This post was successfully fetched from the PostgreSQL database during the GitHub Action workflow and generated as a static HTML file!',
      },
    });
    console.log("Seed data created.");
  } else {
    console.log("Database already seeded.");
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
