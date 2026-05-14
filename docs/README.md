# Intelligent Bistro

This repo is organized as a small two-app workspace:

- `apps/frontend` contains the Expo Router app, UI components, stores, hooks, and shared frontend utilities.
- `apps/backend` contains the Node.js TypeScript API server and its tests.
- `docs` contains the project documentation.
- `shared` is reserved for code shared between the frontend and backend.

## Get Started

1. Install dependencies.

   ```bash
   npm install
   ```

2. Start the frontend.

   ```bash
   npm start
   ```

3. Start the backend separately if you need the API.

   ```bash
   cd apps/backend
   npm run dev
   ```

The frontend app lives in `apps/frontend/app` and still uses Expo Router file-based routing.

## Learn More

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction)
- [Node.js documentation](https://nodejs.org/)
