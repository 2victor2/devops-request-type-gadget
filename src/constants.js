/**
 * Single source of truth for the gadget's config shape and the pure helper that
 * reads a JSM request-type field value (customfield_10010) into a stable group
 * key + display name.
 *
 * Grouping is DYNAMIC (README §2 / CLAUDE.md invariant): the request-type name
 * is embedded in the field value, so there is intentionally NO hardcoded catalog
 * of request types here. The gadget adapts to whatever JSM project it reads.
 */

// Bucket label for issues that carry no JSM request type (e.g. non-portal
// issues or sub-tasks). Kept as a named constant so the view and compute agree.
export const NO_REQUEST_TYPE = 'No request type';

// Sort modes offered in the config form.
export const SORT_OPTIONS = [
  { value: 'count', label: 'Count (descending)' },
  { value: 'name', label: 'Request type name (A–Z)' },
];

/**
 * Default gadget configuration. Shipped so the gadget produces correct output
 * before anyone opens the config form.
 *  - filterId: blank → resolver falls back to the SOURCE_FILTER_ID Forge var.
 *  - sort:     'count' (desc) or 'name' (A–Z).
 *  - showShare: render the share (%) column/label.
 */
export const DEFAULT_CONFIG = {
  filterId: '',
  sort: 'count',
  showShare: true,
};

// --- coercion helpers ------------------------------------------------------
// Gadget configuration is persisted as strings (form fields), so every read
// must coerce and fall back to the default when blank/invalid.

const str = (v, fallback) => {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s === '' ? fallback : s;
};

const bool = (v, fallback) => {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
};

const oneOf = (v, allowed, fallback) => {
  const s = str(v, fallback);
  return allowed.includes(s) ? s : fallback;
};

/**
 * Turn a raw saved configuration (flat string keys, possibly partial/empty)
 * into a fully-populated, type-coerced config. Unknown/blank fields fall back to
 * DEFAULT_CONFIG, so the result is always complete.
 */
export function normalizeConfig(raw = {}) {
  const d = DEFAULT_CONFIG;
  const r = raw || {};
  return {
    filterId: str(r.filterId, d.filterId),
    sort: oneOf(r.sort, ['count', 'name'], d.sort),
    showShare: bool(r.showShare, d.showShare),
  };
}

/**
 * Flat string/boolean defaults keyed exactly as the config form fields (and as
 * the saved gadget configuration). Used to pre-fill the edit form; the saved
 * config is spread on top so existing values win.
 */
export function defaultFlatConfig() {
  const d = DEFAULT_CONFIG;
  return {
    filterId: String(d.filterId),
    sort: d.sort,
    showShare: d.showShare,
  };
}

/**
 * Read a JSM request-type field value (customfield_10010) into a stable group
 * key and a display name. Matches the shape returned by search/jql: the value
 * carries a nested `requestType` ({ id, name }); some shapes put name/value on
 * the value itself. Returns { key, name } — key prefers the request-type id
 * (stable across renames), falling back to the name.
 *
 * Missing/empty field → the NO_REQUEST_TYPE bucket. This is the only place that
 * knows the field shape, keeping the grouping dynamic (no hardcoded catalog).
 */
export function extractRequestType(fieldValue) {
  if (!fieldValue) return { key: NO_REQUEST_TYPE, name: NO_REQUEST_TYPE };

  const rt = fieldValue.requestType || fieldValue;
  const name = (rt && (rt.name || rt.value)) ? String(rt.name || rt.value) : null;
  const id = rt && rt.id != null ? String(rt.id) : null;

  if (!name && !id) return { key: NO_REQUEST_TYPE, name: NO_REQUEST_TYPE };

  return {
    key: id || name,
    name: name || `Request type ${id}`,
  };
}
