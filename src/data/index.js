/** Static data loader with in-memory cache.
 *
 * In dev we ship JSON; this loader fetches and memoises so callers can
 * `await getEvents()` without worrying about the network.
 */

let eventsPromise = null;
let entitiesPromise = null;

function fetchJson(url) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Failed to load ${url}`);
    return r.json();
  });
}

export function getEvents() {
  if (!eventsPromise) {
    eventsPromise = fetchJson(new URL('./events.json', import.meta.url).href)
      .then((data) => data.events || [])
      .catch((err) => {
        console.warn('[data] events failed', err);
        return [];
      });
  }
  return eventsPromise;
}

export function getEntities() {
  if (!entitiesPromise) {
    entitiesPromise = fetchJson(new URL('./entities.json', import.meta.url).href)
      .catch((err) => {
        console.warn('[data] entities failed', err);
        return { people: [], teams: [], leagues: [], orgs: [] };
      });
  }
  return entitiesPromise;
}

/** Convenience: events filtered by pillar(s). */
export async function getEventsByPillar(pillar) {
  const events = await getEvents();
  if (!pillar) return events;
  const set = new Set(Array.isArray(pillar) ? pillar : [pillar]);
  return events.filter((e) => set.has(e.pillar));
}

/** Convenience: events for a specific entity id. */
export async function getEventsForEntity(entityId) {
  const events = await getEvents();
  return events.filter(
    (e) => Array.isArray(e.relatedEntities) && e.relatedEntities.includes(entityId),
  );
}

/** Convenience: events between two ISO dates inclusive. */
export async function getEventsInRange(startIso, endIso) {
  const events = await getEvents();
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return events.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= a && t <= b;
  });
}

/** Find an entity by id across people / teams / leagues / orgs. */
export async function getEntity(id) {
  const ents = await getEntities();
  return (
    ents.people?.find((p) => p.id === id) ||
    ents.teams?.find((t) => t.id === id) ||
    ents.leagues?.find((l) => l.id === id) ||
    ents.orgs?.find((o) => o.id === id) ||
    null
  );
}
