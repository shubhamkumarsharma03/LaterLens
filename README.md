# LaterLens — AI-Powered Screenshot Assistant

An AI-powered mobile app built with **React Native + Expo** that helps you organise and resurface your screenshots intelligently using the Gemini API.

---

## Table of Contents

1. [Phase 1 – Environment Setup & Project Initialisation](#phase-1--environment-setup--project-initialisation)
   - [1. System Check](#1-system-check)
   - [2. Project Creation](#2-project-creation)
   - [3. Install Dependencies](#3-install-dependencies)
   - [4. Folder Structure](#4-folder-structure)
   - [5. Environment Variables](#5-environment-variables)
   - [6. Running the App](#6-running-the-app)
2. [Project Structure](#project-structure)
3. [Tech Stack](#tech-stack)

---

## Phase 1 – Environment Setup & Project Initialisation

### 1. System Check

Verify that **Node.js**, **npm**, and **Git** are installed on your system:

```bash
node --version   # Expected: v18.x or higher
npm --version    # Expected: 9.x or higher
git --version    # Expected: git version 2.x
```

> **Not installed?**
> - **Node.js & npm**: Download from <https://nodejs.org> (LTS version recommended).
> - **Git**: Download from <https://git-scm.com/downloads>.

---

### 2. Project Creation

Initialise a new Expo project using the **blank** managed-workflow template:

```bash
npx create-expo-app@latest screenshot-assistant --template blank
```

> This creates a new folder `screenshot-assistant/` with all Expo boilerplate already in place.

---

### 3. Install Dependencies

Navigate into the project directory, then install the packages required for `.env` support:

```bash
cd screenshot-assistant
npm install expo-constants dotenv
```

| Package | Purpose |
|---|---|
| `expo-constants` | Exposes Expo manifest values (including `EXPO_PUBLIC_*` env vars) at runtime. |
| `dotenv` | Loads `.env` files into `process.env` during local development. |

---

### 4. Folder Structure

Create a clean `src/` directory that separates concerns:

```bash
mkdir -p src/components src/services src/utils
```

Recommended layout:

```
screenshot-assistant/
├── App.js                  # Root application component
├── app.json                # Expo project configuration
├── .env                    # Secret env vars (NOT committed)
├── .env.example            # Safe template (committed)
├── package.json
└── src/
    ├── components/         # Reusable UI components
    ├── services/           # API calls (Gemini, etc.)
    └── utils/              # Helper functions
```

---

### 5. Environment Variables

**Create the `.env` file** at the project root:

```bash
touch .env
```

**Add your Gemini API key placeholder** inside `.env`:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

> The `EXPO_PUBLIC_` prefix makes the variable accessible in your React Native code via
> `process.env.EXPO_PUBLIC_GEMINI_API_KEY`.

**Protect your keys — add `.env` to `.gitignore`:**

Open `.gitignore` and ensure the following lines are present:

```
# local env files
.env
.env*.local
```

**Never commit your real API key.** Commit `.env.example` instead so teammates know which keys are needed.

---

### 6. Running the App

Start the Expo development server:

```bash
npx expo start
```

Then:

1. Install the **Expo Go** app on your iOS or Android device.
2. Scan the QR code shown in the terminal with:
   - **Android**: the Expo Go app's built-in QR scanner.
   - **iOS**: the default Camera app.

The blank app will load on your device instantly.

---

## Project Structure

```
LaterLens/
├── App.js                  # Root component
├── app.json                # Expo configuration
├── index.js                # Entry point (auto-generated)
├── .env                    # Local secrets (git-ignored)
├── .env.example            # Key template (committed)
├── .gitignore
├── package.json
├── package-lock.json
├── assets/                 # Images, icons, splash screen
└── src/
    ├── components/         # Shared UI components
    ├── services/           # External API integrations
    └── utils/              # Pure helper utilities
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo Managed Workflow) |
| Language | JavaScript (ES2022) |
| AI Backend | Google Gemini API |
| Env management | `dotenv` + `expo-constants` |
| Runtime | Node.js 18+ / Expo SDK 52+ |
