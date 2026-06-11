import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { normalizeConfig } from '../constants.js';
import { groupByRequestType } from '../compute.js';

const resolver = new Resolver();

// Site-specific config comes from Forge environment variables (set via
// scripts/forge-env.sh from your local .env), so nothing is hardcoded.
const REQUEST_TYPE_FIELD = process.env.REQUEST_TYPE_FIELD || 'customfield_10010';
const ENV_FILTER_ID = process.env.SOURCE_FILTER_ID || '';
const FALLBACK_JQL = process.env.SOURCE_FALLBACK_JQL || '';

// Only the request-type field is needed for grouping — keeps the response small.
const FIELDS = [REQUEST_TYPE_FIELD];

/**
 * Resolve the source JQL from the configured filter id. Reading the filter by
 * id keeps the gadget pointed at whatever the team curates in the filter; we
 * only fall back to SOURCE_FALLBACK_JQL (if set) when the read fails.
 */
async function resolveJql(filterId) {
  if (filterId) {
    try {
      const res = await api
        .asUser()
        .requestJira(route`/rest/api/3/filter/${filterId}`, {
          headers: { Accept: 'application/json' },
        });
      if (res.ok) {
        const data = await res.json();
        if (data && data.jql) return data.jql;
      }
    } catch (e) {
      // fall through to the fallback JQL
    }
  }
  return FALLBACK_JQL;
}

/**
 * Page through POST /rest/api/3/search/jql with nextPageToken until exhausted.
 */
async function fetchAllIssues(jql) {
  const issues = [];
  let nextPageToken;
  let pages = 0;
  const MAX_PAGES = 50; // safety cap against an unbounded loop

  do {
    const body = { jql, maxResults: 100, fields: FIELDS };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const res = await api
      .asUser()
      .requestJira(route`/rest/api/3/search/jql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`search/jql returned ${res.status}: ${text}`);
    }

    const data = await res.json();
    (data.issues || []).forEach((i) => issues.push(i));
    nextPageToken = data.isLast === true ? undefined : data.nextPageToken;
    pages += 1;
  } while (nextPageToken && pages < MAX_PAGES);

  return issues;
}

/**
 * Main entry point invoked by the view. Receives the saved gadget configuration
 * in the payload, normalizes it, reads the source filter, and returns the issue
 * count grouped dynamically by request type.
 */
resolver.define('getBreakdown', async (req) => {
  const cfg = normalizeConfig((req.payload && req.payload.config) || {});
  // Per-gadget config wins; otherwise the SOURCE_FILTER_ID env var.
  const filterId = cfg.filterId || ENV_FILTER_ID;
  try {
    const jql = await resolveJql(filterId);
    if (!jql) {
      return {
        ok: false,
        error:
          'No source filter configured. Set a filter id in the gadget config, ' +
          'or a SOURCE_FILTER_ID / SOURCE_FALLBACK_JQL Forge variable.',
      };
    }
    const issues = await fetchAllIssues(jql);
    const result = groupByRequestType(issues, cfg, REQUEST_TYPE_FIELD);
    return { ok: true, ...result };
  } catch (err) {
    console.error('getBreakdown failed', err);
    return { ok: false, error: String(err.message || err) };
  }
});

export const handler = resolver.getDefinitions();
