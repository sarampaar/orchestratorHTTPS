import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Fetching posts from PostgreSQL...");
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${posts.length} posts. Generating HTML...`);

  const postsHtml = posts.map(post => `
    <div class="card">
      <h2>${post.title}</h2>
      <p class="date">${post.createdAt.toLocaleString()}</p>
      <p>${post.content}</p>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PostgreSQL SSG - ssg.theengineer.co.in</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { margin: 0; font-family: 'Roboto Mono', monospace; background: #022c22; color: #ecfdf5; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .header h1 { color: #34d399; margin-bottom: 0.5rem; }
        .badge { display: inline-block; background: #065f46; padding: 0.4rem 1rem; border-radius: 4px; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 1rem; }
        .container { max-width: 800px; margin: 0 auto; }
        .card { background: rgba(2, 44, 34, 0.7); backdrop-filter: blur(8px); padding: 2rem; border-radius: 12px; border: 1px solid #10b981; margin-bottom: 2rem; }
        .date { font-size: 0.85rem; color: #6ee7b7; margin-top: 0; }
        h2 { margin-top: 0; color: #a7f3d0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="badge">SSG Generation Complete</div>
            <h1>Database-Driven Static Site</h1>
            <p>Generated dynamically via Node.js & Prisma on deployment.</p>
        </div>
        ${postsHtml}
    </div>
</body>
</html>`;

  // Output path in the mapped volume
  const outputPath = path.join(__dirname, '../www/ssg.theengineer.co.in/index.html');
  fs.writeFileSync(outputPath, html);
  console.log("Successfully wrote index.html to", outputPath);
}

main()
  .catch(e => {
    console.error("Failed to generate site:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
