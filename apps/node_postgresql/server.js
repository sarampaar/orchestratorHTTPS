const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', async (req, res) => {
  try {
    // Increment visitor stat
    const stat = await prisma.visitorStat.upsert({
      where: { id: 1 },
      update: { count: { increment: 1 } },
      create: { id: 1, count: 1 },
    });

    // Fetch total users
    const userCount = await prisma.user.count();

    res.json({
      status: "success",
      message: "Connected to PostgreSQL successfully via Prisma!",
      visitors: stat.count,
      totalUsers: userCount,
      database_url_used: process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@') // Mask password
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to connect to the database",
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
