// Shared by playwright.config.js and the HTTP-only specs so the address of the
// local built-site server is defined in one place.
const SERVE_PORT = Number(process.env.SERVE_PORT) || 8081;
const SERVE_BASE_URL = `http://127.0.0.1:${SERVE_PORT}`;

module.exports = { SERVE_PORT, SERVE_BASE_URL };
