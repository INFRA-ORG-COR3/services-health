# Services Health

An English-language COR3 service-health dashboard for monitoring the public
availability of Microsoft 365, Adobe, 3CX, Cloudflare, DRS, and RECOVERY.PR.
It provides a manual refresh control, status descriptions, source links, and
clear operational, degraded, outage, and checking states.

## Status states

- Green: operational
- Yellow, pulsing: degraded performance or a vendor advisory
- Red: outage or confirmed unavailability
- Gray: the status check is still running

The dashboard uses official vendor status feeds where they are available.
DRS and RECOVERY.PR are checked through their public Puerto Rico landing pages.
An unsuccessful probe can indicate a provider restriction or network issue and
does not replace the vendor's own incident communication.

## Run locally

### Requirements

- Node.js 22.13 or later
- Outbound HTTPS access to the monitored public services
- pnpm 11 or npm

### pnpm

```bash
git clone https://github.com/INFRA-ORG-COR3/services-health.git
cd services-health
corepack enable
pnpm install
pnpm dev
```

### npm

```bash
git clone https://github.com/INFRA-ORG-COR3/services-health.git
cd services-health
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser. The
application does not require API keys or a database for its standard checks.

## Production-style local run

```bash
pnpm install
pnpm build
pnpm start
```

Use `npm run build` and `npm start` instead when using npm.

## Verification

```bash
pnpm test
pnpm lint
```

The test command creates a production build and validates the rendered
dashboard shell. The lint command checks the TypeScript and React source.

## Customize monitored services

Service definitions and server-side probes are maintained in
`app/api/status/route.ts`. The dashboard presentation and service descriptions
are in `app/status-dashboard.tsx`.

When adding a service:

1. Prefer an official machine-readable status feed.
2. Use a stable public landing page only when no official feed is available.
3. Keep the source label and direct source URL visible to users.
4. Set explicit timeouts so one provider cannot delay the full dashboard.

## Project structure

- `app/`: dashboard, styles, metadata, and status API
- `public/`: official COR3 vector/raster brand assets and local fonts
- `tests/`: rendered-output verification
- `.openai/hosting.json`: optional metadata for the hosted Sites deployment

The `.openai/hosting.json` file is not required to run the application on a
local computer.
