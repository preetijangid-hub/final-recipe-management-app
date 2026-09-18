// Base URL of the Savoré backend.
// Leave empty while the API is served from the same origin as the frontend.
// For split deployments (static frontend + separate backend), set the full
// backend URL here before building, e.g. 'https://savore-api.onrender.com'.
export const environment = {
  production: true,
  apiBaseUrl: 'https://savore-lz8a.onrender.com/api',
  cloudinaryCloudName: 'd2c4wzep',
  cloudinaryUploadPreset: 'savore_recipes',
};