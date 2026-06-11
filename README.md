# Work by Request Type — Jira dashboard gadget

A custom [Atlassian Forge](https://developer.atlassian.com/platform/forge/) app
that adds a Jira Cloud **dashboard gadget** breaking down issue **count by JSM
request type**. The grouping is **fully dynamic** — request-type names are read
straight from the issues, so there is **no hardcoded catalog** and the gadget
adapts to whatever project it is installed in.

## Why this exists

Jira Service Management's *Request Type* field is a special field type
(`sd-customerrequesttype`) that **cannot be selected as a statistic axis** in the
stock Pie / Two-Dimensional Filter Statistics gadgets. So if you want to see how
work splits across request types on a dashboard, you need a custom gadget — this
one.

## How it works

```
┌────────────────┐   invoke('getBreakdown', {config})   ┌─────────────────────┐
│  Gadget view   │ ───────────────────────────────────▶ │  Resolver (backend) │
│  (UI Kit)      │ ◀─────────────────────────────────── │  asUser()           │
└────────────────┘        { rows, totals }               └─────────┬───────────┘
                                                                    │ read:jira-work
                                                          ┌─────────▼───────────┐
                                                          │  Jira Cloud REST    │
                                                          │  filter + search/jql│
                                                          └─────────────────────┘
```

1. **Source.** The gadget reads a Jira **filter id** (set per-gadget in the
   config, or a `SOURCE_FILTER_ID` app default). The resolver looks up the
   filter's JQL via `GET /rest/api/3/filter/{id}`.
2. **Fetch.** It pages through `POST /rest/api/3/search/jql` (using
   `nextPageToken`), requesting only the request-type field to keep responses
   small. All calls run as the **viewing user** (`asUser()`), so results respect
   that user's own permissions.
3. **Group.** [`src/compute.js`](src/compute.js) is a pure function that buckets
   issues by the request-type field value. The request-type **name is embedded in
   the field**, so grouping needs no external lookup and no hardcoded list. Issues
   with no request type fall into a *"No request type"* bucket.
4. **Display.** The view renders a summary (total issues across N request types)
   and a sortable table of *request type · count · share (%)*.

### Project layout

| Path | Responsibility |
|---|---|
| `manifest.yml` | One `jira:dashboardGadget` module (view + edit) and the resolver function. Scope: `read:jira-work` only. |
| `src/resolvers/index.js` | Reads the source filter, paginates `search/jql`, returns the grouped result. |
| `src/compute.js` | Pure, testable `groupByRequestType()` — no Forge/network deps. |
| `src/constants.js` | Config shape + `extractRequestType()` (the only code that knows the field shape). |
| `src/frontend/index.jsx` | UI Kit view (summary + table) and the edit/config form. |
| `scripts/forge-env.sh` | Bridges your local `.env` to Forge (exports `APP_ID`, pushes runtime variables). |

## Configuration

Per-gadget, in the dashboard's **Edit** panel:

| Setting | Meaning |
|---|---|
| **Source filter id** | The Jira filter the gadget counts over. Leave blank to use the app-level `SOURCE_FILTER_ID`. |
| **Sort by** | `Count (descending)` or `Request type name (A–Z)`. |
| **Show share (%)** | Toggle the share column. |

App-level defaults are Forge environment variables, set from a local `.env` (see
`.env.example`):

| Variable | Purpose |
|---|---|
| `APP_ID` | Your registered Forge app id; injected into `manifest.yml` as `${APP_ID}`. |
| `SOURCE_FILTER_ID` | Default source filter when a gadget instance hasn't set one. |
| `REQUEST_TYPE_FIELD` | The JSM Request Type custom field id (e.g. `customfield_10010`; varies per site). |
| `SOURCE_FALLBACK_JQL` | Optional JQL used only if the filter can't be read. |

## Prerequisites

- Node.js 22.x or 24.x and npm
- [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/): `npm i -g @forge/cli`
- A Forge/Atlassian account (`forge login`) and site-admin on the target site to install

## Getting started

```bash
npm install
cp .env.example .env          # then fill in the values

forge register                # creates a new app id → put it in .env as APP_ID

# Export APP_ID and push the runtime variables to Forge:
bash scripts/forge-env.sh --set-variables

forge deploy
forge install --site <your-site>.atlassian.net --product jira

# Then open a dashboard → "Add gadget" → "Work by Request Type".
```

For local iteration, run `forge tunnel` and edit under `src/`.

### Verifying

- `npm run lint` and `forge lint` should both be clean.
- Cross-check the gadget's numbers against a JQL count, e.g.
  `<your request-type field> = "<a request type>"` in the issue navigator.

## Design notes / invariants

- **Dynamic grouping** from the request-type field — never a hardcoded catalog.
- Backend reads **`asUser()`** with the **`read:jira-work`** scope only.
- **No external egress** — the app talks only to Jira's own REST API.
- `search/jql` is **paginated** via `nextPageToken`.
- The app id is kept out of the repo (`${APP_ID}` in the manifest, real value in
  the gitignored `.env`).

## License

[GNU General Public License v3.0 or later](LICENSE).
