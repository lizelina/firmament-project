// This file contains API keys for external services
// In a production environment, these are loaded from environment variables
// for better security

// Google Gemini API Key
// For more information, see: https://ai.google.dev/tutorials/javascript_quickstart
export const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || '';

// Available models:
// - gemini-2.0-flash: Latest flash model, fast with improved capabilities (recommended)
// - gemini-1.5-flash: Fast, efficient model for general tasks
// - gemini-1.5-pro: Full-featured model for more complex understanding
// - gemini-1.0-pro: Legacy model (not recommended for new development)

// Add future API keys here to keep them organized 