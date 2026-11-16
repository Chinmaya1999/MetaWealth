# MetaWealth Capital

```
metawealth-capital/
├── backend/    Express + TypeScript + MongoDB API, calculation engine, own .env
│   └── packages/financial-formulas   deterministic Decimal.js formulas + golden tests
├── frontend/   Vite + React + TypeScript + Tailwind (client / advisor / admin portals)
└── docs/
```

```
npm install                 # once, from the repo root
cp backend/.env.example backend/.env   # then fill in (already present locally)
npm run seed                # dev-only demo users
npm run dev:backend         # http://localhost:4000/api/v1/health
npm run dev:frontend        # http://localhost:5173 (proxies /api to the backend)
npm test
```
Demo logins: `admin@`, `reviewer@`, `advisor1@`, `advisor2@`, `client1@`, `client2@` + `demo.metawealth.test`, password = `SEED_DEMO_PASSWORD` in `backend/.env`.
