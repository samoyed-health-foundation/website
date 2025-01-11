const fs = require('fs');

// Path to Lychee output file
const LYCHEE_OUTPUT = 'lychee-suggestions.txt';

// Read the Lychee output file
fs.readFile(LYCHEE_OUTPUT, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading file: ${err.message}`);
    return;
  }

  // Split the output into lines
  const lines = data.split('\n');
  let currentFile = '';

  lines.forEach(line => {
    // Match file paths and map to markdown source files
    const fileMatch = line.match(/Suggestions in _site\/(.*?)\/index.html/);
    if (fileMatch) {
      currentFile = `src/${fileMatch[1]}.md`;
    }

    // Match and replace URLs
    const urlMatch = line.match(/\* (http.*) --> (http.*)/);
    if (urlMatch && currentFile) {
      const oldUrl = urlMatch[1];
      const newUrl = urlMatch[2];

      // Check if the file exists
      if (fs.existsSync(currentFile)) {
        // Read the source file
        let content = fs.readFileSync(currentFile, 'utf8');

        // Replace all occurrences of the old URL with the new URL
        const updatedContent = content.replaceAll(oldUrl, newUrl);

        // Write the updated content back to the file
        fs.writeFileSync(currentFile, updatedContent, 'utf8');
        console.log(`Updated ${currentFile}: ${oldUrl} -> ${newUrl}`);
      } else {
        console.warn(`File not found: ${currentFile}`);
      }
    }
  });

  console.log('URL replacement completed.');
});
