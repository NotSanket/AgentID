# AgentID frontend

The Stage 4 frontend is a React, TypeScript, and Vite application that provides the premium visual foundation for the AgentID portal. It includes the public landing page, responsive console shell, route placeholders for future product modules, reusable identity and form components, command navigation, notifications, and a live backend-health indicator.

## Run locally

```powershell
cd "C:\BlockChain Project67\frontend"
npm install
npm run dev
```

Open the local URL printed by Vite. The default backend URL is `http://localhost:4000`; override it with `VITE_API_BASE_URL` in an untracked `.env` file when necessary.

The interface remains usable when the backend is not running and clearly reports `SYSTEM OFFLINE` instead of inventing data.

## Quality checks

```powershell
npm run typecheck
npm run test
npm run build
```

Stage 4 intentionally does not implement registration, registry data tables, verification forms, communication workflows, attack simulation, graph data, explorer data, or analytics charts. Those modules begin in Stage 5.
