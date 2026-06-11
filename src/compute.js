/**
 * Pure request-type breakdown — no Forge/network dependencies, so it can be unit
 * tested against live data offline. Given the raw issues from search/jql and a
 * normalized config, it groups by the JSM request-type field value and returns
 * one row per request type with its count and share (%).
 *
 * Grouping is dynamic: see extractRequestType in constants.js. No request-type
 * catalog is hardcoded here.
 */
import { extractRequestType } from './constants.js';

const round1 = (n) => Math.round(n * 10) / 10;

export function groupByRequestType(issues, cfg, requestTypeFieldId = 'customfield_10010') {
  const byType = new Map();

  for (const issue of issues) {
    const f = issue.fields || {};
    const { key, name } = extractRequestType(f[requestTypeFieldId]);

    const row = byType.get(key) || { key, requestType: name, count: 0 };
    row.count += 1;
    byType.set(key, row);
  }

  const total = issues.length;

  let rows = Array.from(byType.values()).map((r) => ({
    ...r,
    share: total ? round1((r.count / total) * 100) : 0,
  }));

  if (cfg.sort === 'name') {
    rows.sort((a, b) => a.requestType.localeCompare(b.requestType));
  } else {
    // count desc, with name as a stable tiebreaker
    rows.sort((a, b) => b.count - a.count || a.requestType.localeCompare(b.requestType));
  }

  return {
    rows,
    totals: {
      ticketCount: total,
      typeCount: rows.length,
    },
  };
}
