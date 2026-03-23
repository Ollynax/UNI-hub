# UNI Hub

Campus event and club management website built with Node.js, vanilla HTML, CSS, and JavaScript.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file from `.env.example` and set:

```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=uni_hub
```

3. Start the app:

```bash
npm start
```

The app runs on `http://localhost:3000` by default.

## Deploy on Render

This repo includes `render.yaml`, so Render can auto-detect the service settings.

Render settings:

- Service type: `Web Service`
- Runtime: `Node`
- Build command: `npm install`
- Start command: `npm start`

Set these environment variables in Render:

- `MONGODB_URI`
- `MONGODB_DB=uni_hub`

The app already reads `PORT` from Render automatically.
