import fs from 'fs';
import path from 'path';
import { algoliasearch } from 'algoliasearch';

const isDryRun = process.argv.includes('--dry-run');

const INDEX_FILE_PATH = path.resolve(import.meta.dirname, '../_site/algolia.json');
const MIN_RECORDS = 100;
const REQUIRED_FIELDS = ['url', 'title', 'section', 'summary'];
const INDEX_SETTINGS = {
  searchableAttributes: ['title', 'summary'],
  attributesForFaceting: ['section'],
};

function validateRecords(records) {
  if (!Array.isArray(records)) {
    throw new Error(`Algolia index file is not an array: ${INDEX_FILE_PATH}`);
  }

  if (records.length < MIN_RECORDS) {
    throw new Error(
      `Unusually low number of records found in the Algolia index file: ${records.length} (expected at least ${MIN_RECORDS})`
    );
  }

  records.forEach((record, index) => {
    const missing = REQUIRED_FIELDS.filter(
      (field) => typeof record[field] !== 'string' || record[field].trim() === ''
    );
    if (missing.length > 0) {
      throw new Error(`Record ${index} is missing non-empty ${missing.join(', ')}`);
    }
  });
}

// Read the index file produced by src/algolia.liquid.
// (Assumes the Eleventy site has been built, and thus the index file exists)
function loadRecords() {
  const records = JSON.parse(fs.readFileSync(INDEX_FILE_PATH, 'utf-8'));
  validateRecords(records);

  // Use the page URL as a stable objectID. A full replacement makes IDs
  // transient, but stable IDs keep Algolia analytics and debugging readable.
  return records.map((record) => ({ ...record, objectID: record.url }));
}

function getCredentials() {
  const credentials = {
    appId: process.env.ALGOLIA_APP_ID,
    apiKey: process.env.ALGOLIA_ADMIN_KEY,
    indexName: process.env.ALGOLIA_INDEX_NAME,
  };

  const missing = Object.entries(credentials)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing Algolia credentials: ${missing.join(', ')}`);
  }

  return credentials;
}

try {
  const records = loadRecords();
  console.log('Algolia index file loaded successfully:', records.length);

  if (isDryRun) {
    console.log('Index file is valid; skipping network calls in dry-run mode');
    process.exit(0);
  }

  const { appId, apiKey, indexName } = getCredentials();
  const client = algoliasearch(appId, apiKey);

  // Update settings on the live index first, and wait for the task to finish.
  // `replaceAllObjects` copies the settings to its temporary index at the
  // start, so it must not race the settings update.
  const { taskID } = await client.setSettings({
    indexName,
    indexSettings: INDEX_SETTINGS,
  });
  await client.waitForTask({ indexName, taskID });
  console.log('Algolia index settings updated');

  // Atomically replace every record: copy to a temporary index, upload,
  // then move the temporary index into place.
  // https://www.algolia.com/doc/libraries/javascript/v5/methods/search/replace-all-objects/
  await client.replaceAllObjects({ indexName, objects: records });
  console.log(`Algolia index updated successfully (${records.length} records)`);
} catch (error) {
  console.error('Failed to update Algolia index:', error);
  process.exit(1);
}
