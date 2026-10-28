# StarKeepsake

StarKeepsake is a platform for creating and taking personalized keepsake designs from concept to manufacturing.

## Project foundation

- `apps/web`: React + TypeScript frontend built with Vite.
- `apps/api`: ASP.NET Core .NET 10 Web API for application services.
- `services/design-engine`: Minimal Python FastAPI service reserved for design workflows.
- `contracts/design-spec`: Shared design specification contracts.

The planned architecture uses Vercel for the frontend, Azure for backend and service hosting, and PostgreSQL for persistent application data. Those integrations are intentionally deferred until later milestones.

## Current status

Milestone 1 — project foundation. The frontend and service health endpoints are in place; product features, authentication, databases, image processing, and cloud integrations are not yet included.

## Local development

Frontend:

```powershell
cd apps/web
npm install
npm run dev
```

API and design-engine commands are documented in their respective directories and in the project handoff notes.
