# CleanMap 🌿

CleanMap is a community-driven platform built to tackle waste reporting and tracking in real-time. We wanted to build something that isn't just a static map, but an active tool for community "Eco-Warriors" to claim spots, clean them up, and climb a leaderboard.

The project was built using a serverless stack to make it fast, scalable, and easy to deploy.

## Core Features

- **Live Reporting**: Drop a pin anywhere on the map to flag a waste hotspot. You can add a title, description, and "Before" evidence photo.
- **Real-Time Map & Sync**: No need to refresh. If someone else reports a spot or cleans one up, it pops up on your map instantly using Supabase Realtime.
- **Cleanup Workflow**: Volunteers can browse high-priority reports, claim them for cleanup, and then "Prove" the work is done by uploading an "After" photo.
- **Gamified Leaderboard**: Every cleanup earns points based on severity (High: 50, Medium: 25, Low: 10). Compete with the local community to top the charts.
- **Bilingual Interface**: Full support for both English and Hindi. The entire UI—from legends to activity logs—switches dynamically.
- **Dashboard Analytics**: Get a bird's-eye view of community activity, severity breakdowns, and a live log of recent actions.

## Tech Stack

- **Frontend**: Vanilla HTML/JS/CSS (kept it lean for performance).
- **Maps**: MapLibre GL JS + Leaflet (using OpenFreeMap tiles).
- **Backend / Database**: Node.js (Express) served as Vercel Serverless Functions.
- **Cloud Infrastructure**: **Supabase** handles our PostgreSQL database, Realtime subscriptions, and Image Storage for "Before/After" photos.

## Local Development

If you'd like to run this locally:

1.  **Clone it**: `git clone <repo-url>`
2.  **Install**: `npm install`
3.  **Env Setup**: Create a `.env` file with your `SUPABASE_URL` and `SUPABASE_KEY`.
4.  **Database**: Run the SQL in `schema.sql` inside your Supabase SQL Editor to set up the tables and storage buckets.
5.  **Run**: `npm run dev`

## Deployment

This app is designed to run on **Vercel**. When deploying:
- Set `SUPABASE_URL` and `SUPABASE_KEY` as environment variables in the Vercel dashboard.
- The backend logic is located in `/api` to work seamlessly with Vercel's Serverless environment.

Live Demo: [clean-map-rho.vercel.app](http://clean-map-rho.vercel.app)

---
*Built with ❤️ for a cleaner community.*
