import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Arguments
const length = parseInt(process.argv[2], 10);

if (!length || isNaN(length) || length < 1 || length > 6) {
  console.error("Usage: node generate.js <length>");
  console.error("Example: node generate.js 3");
  process.exit(1);
}

const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

// Generator function to yield combinations one by one to avoid OOM
function* generateCombinations(len) {
  function* helper(currentStr) {
    if (currentStr.length === len) {
      yield currentStr;
      return;
    }
    for (let i = 0; i < alphabet.length; i++) {
      yield* helper(currentStr + alphabet[i]);
    }
  }
  yield* helper('');
}

async function start() {
  console.log(`Starting generation for words of length ${length}...`);
  
  const batchSize = 10000;
  let batch = [];
  let totalInserted = 0;

  for (const combo of generateCombinations(length)) {
    batch.push({
      word: combo
      // status columns will default to 'pending' as defined in schema
    });

    if (batch.length >= batchSize) {
      await insertBatch(batch);
      totalInserted += batch.length;
      console.log(`Queued ${totalInserted} words so far...`);
      batch = [];
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    await insertBatch(batch);
    totalInserted += batch.length;
  }

  console.log(`\n✅ Done! Successfully processed ${totalInserted} words (duplicates skipped).`);
  process.exit(0);
}

async function insertBatch(records) {
  try {
    await prisma.domainWord.createMany({
      data: records,
      skipDuplicates: true
    });
  } catch (err) {
    console.error("Error inserting batch:", err.message);
  }
}

start();
