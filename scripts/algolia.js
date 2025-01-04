import fs from 'fs';
import path from 'path';
import indexing from 'algolia-indexing';

try {
  // Read the index file
  // (Assumes the Eleventy site has been built, and thus the index file exists)
  const indexFilePath = path.resolve(import.meta.dirname, '../_site/algolia.json');
  const fileContents = fs.readFileSync(indexFilePath, 'utf-8');
  const records = JSON.parse(fileContents);
  console.log('Algolia index file loaded successfully:', records.length);

  // Send to Algolia
  // https://github.com/pixelastic/algolia-indexing
  const credentials = {
    appId: process.env.ALGOLIA_APP_ID,
    apiKey: process.env.ALGOLIA_ADMIN_KEY,
    indexName: process.env.ALGOLIA_INDEX_NAME
  };
  const settings = { searchableAttributes: ['title', 'summary'] };
  indexing.verbose();
  await indexing.fullAtomic(credentials, records, settings);
  console.log('Algolia index updated successfully');
} catch (error) {
  console.error('Failed to update Algolia index:', error);
}
