const isDev = process.env.NODE_ENV === 'development';

const baseUrl = isDev ? `http://localhost:8080` : `https://www.samoyedhealthfoundation.org`;

const site = {
  baseUrl,
}

module.exports = site;
