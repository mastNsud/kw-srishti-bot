# Build in Public: KW Srishti Bot & Mini App

Welcome to the development journey of the **KW Srishti Bot**, an AI-powered lead qualification agent and custom Telegram Mini App designed exclusively for real estate client KW Srishti. 

This document serves as a living record of our architecture, the challenges we faced, how we adapted our approach, and the systems we constructed to create a seamless experience for potential home buyers.

## 🌟 Project Overview

The objective was to create a 24/7 automated qualification funnel directly inside Telegram. It consists of two major components:
1. **AI Lead Qualification Bot:** Engages users in natural conversation to extract their real estate preferences (budget, apartment type, timeline, etc.).
2. **Telegram Mini App:** A rich, single-page web interface integrated directly inside Telegram to showcase property details, chapters, and provide a direct callback request CTA (Call-to-Action).

## 🏗️ Architecture & Tech Stack

- **Backend:** Node.js server handling both the Telegram Bot API and serving the Mini App.
- **Database:** SQLite (`better-sqlite3`) to store chat logs, user sessions, and qualified lead information.
- **Deployment:** [Railway](https://railway.app) for continuous deployment and hosting.
- **AI Integration:** LLMs to parse conversational data and score lead quality.

## 🚧 Challenges Faced & How We Overcame Them

Throughout development, we encountered several technical hurdles. True to the "build in public" ethos, here is how we tackled them:

### 1. The Telegram Deep-Linking Constraint (`tg:resolve`)
**The Problem:** We wanted a "Buy" or "Interested" button inside the Mini App to seamlessly transition users into a purchase flow or chat with an agent. External testing of the Mini App threw `tg:resolve` scheme errors because those links only work *inside* the Telegram client.
**The Solution:** We implemented environment detection. The app falls back gracefully depending on whether it's accessed via standard web browser or inside the Telegram wrapper, ensuring robust handling of purchase data transmission.

### 2. Large Data Sets & UI Clutter
**The Problem:** Presenting a large catalog of property chapters/floorplans in the bot chat became overwhelming.
**The Solution:** We developed an inline pagination system for the bot's user interface, splitting the chapter selection menu into easily navigable chunks, drastically improving UX.

### 3. Deployment Build Tooling (The Python/Native Module Saga)
**The Problem:** When moving from local development to Railway, our deployment failed. `better-sqlite3` relies on native C++ bindings which require Python and proper build tools to compile, missing in the default Node.js environment.
**The Solution:** We transitioned our build strategy. Instead of relying on the legacy `nixpacks` builder, we migrated to Railway's new **Railpack** standard via `railway.toml`. By explicitly injecting `python3`, `gcc`, and `gnumake` into the `nixpkgs` array, our native modules compiled beautifully.

### 4. Ephemeral File Systems in the Cloud
**The Problem:** After a successful build, the app crashed at runtime: `TypeError: Cannot open database because the directory does not exist`. Locally, the `data/` folder existed, but Git didn't track it (or it wasn't created in the container).
**The Solution:** We added startup checks in `db.js` using Node's `fs` module to dynamically inject/create the directory path `/app/data` right before booting SQLite, ensuring resilience regardless of where the app is cloned.

## 🚀 What's Next?
- Equipping sales representatives with a dashboard to view the `leads` table.
- Optimizing AI prompts based on recorded chat logs.
- Connecting the live Webhook for instant Telegram push updates.

---
*Document maintained by the development team. Updated as the project evolves.*
