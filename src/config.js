// config.js - Configuration for API endpoints

// Detect if we're running in production (on Fly.io) or development (locally)
const isProduction = import.meta.env.PROD || window.location.hostname !== 'localhost';

// API base URLs
const API_BASE_URL = isProduction 
  ? 'https://caro-backend-2025.fly.dev' 
  : 'http://localhost:8000';

const WS_BASE_URL = isProduction 
  ? 'wss://caro-backend-2025.fly.dev' 
  : 'ws://localhost:8000';

export { API_BASE_URL, WS_BASE_URL };
