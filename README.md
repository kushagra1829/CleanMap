# WasteWatch 🌿

WasteWatch is a community-driven waste reporting and cleanup tracking application. It allows citizens to flag waste hot-spots via an interactive map, lets volunteers claim the reports, and tracks progress via a central dashboard.

## Features

- **Interactive Maps**: Uses OpenFreeMap and MapLibre GL JS context.
- **Reporting System**: Allows users to drop a pin on a map or use Geolocation tracking to submit waste spots with descriptions and severity metrics.
- **Gamified Cleanup**: Volunteers can browse high-priority reports, claim spots for clean-up, and declare them as resolved.
- **Real-Time Dashboard**: Monitor cleanup status, activity feeds, and statistics across local reports dynamically.
- **Beautiful UI**: Modern glassmorphism design with a fully functional Dark/Light mode toggle.

## Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript, Vanilla CSS, MapLibre GL (via Leaflet bridge).
- **Backend / Database**: Express (Node.js) runtime + better-sqlite3 for high-performance localized storage.

## How to Run Locally

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Steps

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
3. Open the app in your browser at [http://localhost:3000](http://localhost:3000)

## License
MIT
