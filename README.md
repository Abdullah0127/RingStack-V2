# Ringstack

A responsive pay-per-call and lead generation website built with React, Vite, and React Router.

## Getting started

```sh
npm install
npm run dev
```

`npm run dev` starts the Vite website and the local authentication API. Copy `.env.example` to `.env` to override the local API/database settings. The local website is available at `http://localhost:5173`; the API listens on port `3001` by default.

## Pages

- `/` — Home
- `/industries` and `/industries/:slug` — Industry index and six sector pages
- `/technology`, `/advertisers`, `/publishers` — Campaign and partner information
- `/offers` and `/offers/:offerId` — Configured campaign inventory and offer details
- `/about` — Ringstack’s approach
- `/resources` and `/blog` — Resource listings
- `/contact` — Enquiry form
- `/privacy` and `/terms` — Website policy pages
- `/blog/:slug` — Individual articles
- `/advertiser/login` and `/publisher/login` — Separate partner sign-in
- `/advertiser-login` and `/publisher-login` — Alternate sign-in URLs
- `/advertiser/register` and `/publisher/register` — Account applications
- `/:role/forgot-password`, `/:role/reset-password`, and `/:role/dashboard` — Recovery and role-specific portals

Page components are lazy-loaded by route. Shared navigation and footer components live in `src/components/`; route components live in `src/pages/`. Account forms and role-specific portal pages live in `src/auth/`.

The site uses a light/dark theme, self-hosted Inter Variable, responsive layouts and the shared content source in `src/data/siteContent.js`. Contact email is `hello@ringstackltd.com`. The contact form validates required fields and opens the visitor’s email application with a prefilled message.

## Account authentication

Advertiser and publisher accounts are separate. New applications are stored with `pending` status and do not receive a login session until approved. The API stores scrypt password hashes, one-way-hashed session/reset tokens, and role-scoped account profiles in SQLite. The session endpoint returns `{ "user": null }` when signed out. Password reset email requires a configured SMTP transport; reset tokens expire after one hour. No password reset links are exposed in API responses.

The public reference exposes publisher email/password sign-in, a 30-day remember option, account creation, and password recovery; its FAQ describes human review and a publisher review period of 2–9 business days. The advertiser sign-in portal could not be verified publicly, so its hidden fields and workflow are not represented as reference facts. Current advertiser application fields follow Ringstack’s public campaign-intake content and should be confirmed before launch.

For local development, password reset remains unavailable until `SMTP_URL` and `SMTP_FROM` are configured. Production additionally requires an HTTPS `PUBLIC_ORIGIN`; set `AUTH_DB_PATH` to a persistent path outside `public/` and `dist/`. If `TRUST_PROXY=true`, use it only behind a trusted reverse proxy that replaces forwarded IP headers.

An operator approves or changes an application from the server environment:

```sh
npm run account:status -- advertiser person@example.com approved
npm run account:status -- publisher person@example.com suspended
```

Allowed status changes are `approved`, `rejected`, and `suspended`. Changing an account away from `approved` revokes its active sessions. Do not expose this command or the SQLite database to account holders. The current rate limiter is process-local; use shared storage before running multiple API instances.

Production deployment builds the frontend and serves it with the API:

```sh
npm run build
npm start
```

Set `NODE_ENV=production`, `PUBLIC_ORIGIN`, `SMTP_URL`, `SMTP_FROM`, and a persistent `AUTH_DB_PATH` in the deployment environment before starting the server.

## Offers marketplace

The marketplace reads only configured active offers from the SQLite `offers` table. Facets are shared between the API and UI; selected values within one facet are ORed, while different facets are combined with AND. Offer applications are restricted to authenticated, approved publishers and are created as `pending`. Duplicate applications are prevented. Publishers can see their application statuses in the publisher portal. Advertiser dashboards and campaign management are not implemented yet.

Development starts with explicitly marked demo-only offer records so the marketplace can be exercised locally. These records cannot receive applications and are always excluded from production list and detail responses. Production starts with no offers unless the operator imports real Ringstack inventory.

Import or update operator-configured offers from a JSON array (or an object with an `offers` array):

```sh
npm run offers:import -- ./offers.json
```

Each record uses `id`, `title`, `campaignType` (`CPA` or `CPL`), `industry`, `vertical`, and `productType` (`Inbound Call`, `Traffic`, `Live Transfer`, or `Form Fill`). Optional configured detail fields are `paymentTerms`, `payoutMethod`, `payoutAmount`, `payoutCurrency`, `states`, `schedule`, `percentage`, `bufferSeconds`, `availableFrom` (`YYYY-MM-DD`), `description`, `qualificationRequirements`, `trafficRequirements`, `restrictions`, and `status` (`active` or `paused`). Values for industry and vertical must match the marketplace facet options. Imports validate all records before writing, update by offer ID in one transaction, mark imported offers as non-demo, and record create/update and status changes in `offer_audit_log`. Configure `AUTH_DB_PATH` to target the intended database before importing; the command never generates offer inventory.

Phone, address, opening hours, statistics and social links are omitted until verified business details are provided. Review the Privacy and Terms copy against Ringstack’s actual processes and agreements before publication.

## Checks

```sh
npm run lint
npm run build
npm test
```
