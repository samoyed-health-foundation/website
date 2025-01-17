import fs from 'fs';
import path from 'path';
import indexing from 'algolia-indexing';

const isDryRun = process.argv.includes("--dry-run");

try {
  // Read the index file
  // (Assumes the Eleventy site has been built, and thus the index file exists)
  const indexFilePath = path.resolve(import.meta.dirname, '../_site/algolia.json');
  const fileContents = fs.readFileSync(indexFilePath, 'utf-8');
  const records = JSON.parse(fileContents);
  console.log('Algolia index file loaded successfully:', records.length);
  if (records.length < 100) {
    console.error('Unusually low number of records found in the Algolia index file');
    process.exit(1);
  }

  // Send to Algolia
  // https://github.com/pixelastic/algolia-indexing
  const credentials = {
    appId: process.env.ALGOLIA_APP_ID,
    apiKey: process.env.ALGOLIA_ADMIN_KEY,
    indexName: process.env.ALGOLIA_INDEX_NAME
  };
  const settings = { searchableAttributes: ['title', 'summary'] };
  indexing.verbose();

  if (isDryRun) {
    console.log("Indexing in dry-run mode...");
    if (typeof indexing.fullAtomic === "function" && indexing.fullAtomic.length === 3) {
      console.log("Check passed: `indexing.fullAtomic` is a function that takes 3 arguments");
      process.exit(0);
    } else {
      console.error("Check failed: `indexing.fullAtomic` is not a function that takes 3 arguments");
      process.exit(1);
    }
  } else {
    console.log("Running full indexing operation...");
    await indexing.fullAtomic(credentials, records, settings);
    console.log('Algolia index updated successfully');
  }
} catch (error) {
  console.error('Failed to update Algolia index:', error);
  process.exit(1);
}
