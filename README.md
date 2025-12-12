# Doctor Search App

AI assistant that turns natural-language care requests into structured physician searches over CMS provider data (specialty, location, procedures) and returns relevant matches.

## Problem
- Patients need a simple way to translate what they need (“cardiologist near Chicago who does ultrasounds”) into an actionable provider search without knowing medical codes or SQL.

## Tech Stack
- Next.js 14 (App Router) + React Server Components
- TypeScript with strict typing; shadcn/ui + Tailwind CSS for UI
- Vercel AI SDK (tool calls, structured output) with Gemini backends
- MySQL (Drizzle ORM, migrations) for CMS provider dataset
- Auth.js for authentication
- Playwright + Jest-like tests for e2e and integration