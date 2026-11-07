const isDev = process.env.ELEVENTY_RUN_MODE === 'serve';

const baseUrl = isDev ? `http://localhost:8080` : `https://www.samoyedhealthfoundation.org`;

const site = {
  baseUrl,
}

module.exports = site;
