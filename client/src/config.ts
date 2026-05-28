const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const config = {
  API_BASE_URL: process.env.REACT_APP_API_URL || (isLocalHost ? 'http://127.0.0.1:3001/api' : '/api'),
};