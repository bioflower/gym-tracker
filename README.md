# Gym Tracker

A single-page workout tracking app built with React + TypeScript + Vite. All data is persisted to your browser's localStorage — no backend, no accounts.

## Features

- **Today** — Start workouts, log sets (weight/reps, duration, distance), mark exercises complete
- **Plan** — Customize your workout rotation: add/rename/reorder days and exercises
- **Exercises** — Browse 35+ preset exercises by category, create custom exercises
- **History** — Review past completed and skipped workouts
- **Settings** — Reset all data

## Tech Stack

React 19, TypeScript 6, Vite 8, react-router-dom 7, Vitest + React Testing Library, regular CSS with custom properties.

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npx vitest run` | Run tests |
