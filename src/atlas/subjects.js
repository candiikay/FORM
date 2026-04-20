/**
 * Atlas Subjects.
 *
 * A Subject is a question the studio knows how to ask of the data layer.
 * Each Subject reports which Shapes it can be paired with and exposes
 * `build(opts)` that returns a dataset shaped for those renderers.
 *
 * The studio flow is: Subject → compatible Shapes → Style → renderPlate.
 */

import {
  getEvents,
  getEventsByPillar,
  getEventsForEntity,
  getEntities,
} from '../data/index.js';

function domainFromEvents(events, fallback = ['1972-01-01', '2025-12-31']) {
  if (!events.length) return fallback;
  const sorted = [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return [sorted[0].date, sorted[sorted.length - 1].date];
}

function eventForRender(e) {
  return { date: e.date, title: e.title };
}

const MOVEMENTS = {
  id: 'movements',
  title: 'Movements',
  kicker: 'Movements',
  description:
    'Title IX, league founding, activism, media deals — the politics under the points.',
  pillar: 'movements',
  compatibleShapes: ['timeline'],
  defaultShape: 'timeline',
  defaultStyle: {
    title: 'Movements',
    subtitle: 'The politics under the points',
    citation: 'Source: WNBA, NCAA, U.S. Dept. of Education · FORM Atlas',
    palette: 'duo',
  },
  async build() {
    const ev = await getEventsByPillar('movements');
    return {
      events: ev.map(eventForRender),
      domain: domainFromEvents(ev),
    };
  },
};

const PERFORMANCE = {
  id: 'performance',
  title: 'Performance',
  kicker: 'Performance',
  description:
    'Championships, scoring records, dynasties, the moments the room remembers.',
  pillar: 'performance',
  compatibleShapes: ['timeline'],
  defaultShape: 'timeline',
  defaultStyle: {
    title: 'Performance',
    subtitle: 'The moments the room remembers',
    citation: 'Source: WNBA, NCAA · FORM Atlas',
    palette: 'ink',
  },
  async build() {
    const ev = await getEventsByPillar('performance');
    return {
      events: ev.map(eventForRender),
      domain: domainFromEvents(ev),
    };
  },
};

const TEAM_ARC = {
  id: 'team',
  title: 'A team',
  kicker: 'Team arc',
  description: 'Every recorded moment for one franchise, on a single line.',
  needs: { entityType: 'team' },
  compatibleShapes: ['timeline'],
  defaultShape: 'timeline',
  defaultStyle: {
    citation: 'Source: WNBA, NCAA · FORM Atlas',
    palette: 'teal',
  },
  async listOptions() {
    const ents = await getEntities();
    return (ents.teams || []).map((t) => ({ id: t.id, label: t.name }));
  },
  async build({ entityId }) {
    if (!entityId) return { events: [] };
    const [ents, ev] = await Promise.all([getEntities(), getEventsForEntity(entityId)]);
    const team = (ents.teams || []).find((t) => t.id === entityId);
    return {
      events: ev.map(eventForRender),
      domain: domainFromEvents(ev),
      _label: team?.name || entityId,
    };
  },
};

const PERSON_ARC = {
  id: 'person',
  title: 'A person',
  kicker: 'Career arc',
  description: 'A player or coach across the years they touched the game.',
  needs: { entityType: 'person' },
  compatibleShapes: ['timeline', 'quote-card'],
  defaultShape: 'timeline',
  defaultStyle: {
    citation: 'Source: WNBA, NCAA · FORM Atlas',
    palette: 'clay',
  },
  async listOptions() {
    const ents = await getEntities();
    return (ents.people || []).map((p) => ({ id: p.id, label: p.name }));
  },
  async build({ entityId }) {
    if (!entityId) return { events: [] };
    const [ents, ev] = await Promise.all([getEntities(), getEventsForEntity(entityId)]);
    const person = (ents.people || []).find((p) => p.id === entityId);
    const quotes = ev
      .filter((e) => e.type === 'quote' && e.quote)
      .map((e) => ({
        quote: e.quote,
        speaker: e.speaker || person?.name || '',
        context: e.context || e.title || '',
        date: e.date,
        source: e.source || '',
      }));
    return {
      events: ev.map(eventForRender),
      quotes,
      domain: domainFromEvents(ev),
      _label: person?.name || entityId,
    };
  },
};

const ERAS_STACK = {
  id: 'eras',
  title: 'Eras since Title IX',
  kicker: 'Eras',
  description: 'Five decades of women\u2019s basketball as a stack of color.',
  compatibleShapes: ['palette-stack'],
  defaultShape: 'palette-stack',
  defaultStyle: {
    title: 'Eras since Title IX',
    subtitle: 'Five decades, as pigment',
    citation: 'Source: composite · FORM Atlas',
  },
  async build() {
    return {
      bands: [
        {
          label: 'The AIAW years',
          sublabel: '1972 \u2013 1981',
          color: '#5a4a36',
          magnitude: 9,
          note: 'Title IX rewrites the rule. The AIAW runs the championship.',
        },
        {
          label: 'NCAA takes over',
          sublabel: '1982 \u2013 1996',
          color: '#7a3e2a',
          magnitude: 14,
          note: 'Pat Summitt era. The pyramid of college power forms.',
        },
        {
          label: 'Birth of the WNBA',
          sublabel: '1997 \u2013 2007',
          color: '#487670',
          magnitude: 10,
          note: 'Houston four-peats. The pro league learns its language.',
        },
        {
          label: 'The pro game grows',
          sublabel: '2008 \u2013 2019',
          color: '#bf7f3c',
          magnitude: 11,
          note: 'Lynx and Storm dynasties. Players take the floor as activists.',
        },
        {
          label: 'Era of the supernova',
          sublabel: '2020 \u2013 present',
          color: '#bf3a2c',
          magnitude: 6,
          note: 'New CBAs. New money. Caitlin, Angel, A\u2019ja, Stewie.',
        },
      ],
    };
  },
};

const MONEY = {
  id: 'money',
  title: 'Money',
  kicker: 'Money',
  description:
    'Salaries, deals, expansion fees \u2014 the financial scaffolding of the league.',
  pillar: 'money',
  compatibleShapes: ['timeline', 'event-ribbon'],
  defaultShape: 'timeline',
  defaultStyle: {
    title: 'Money',
    subtitle: 'The financial scaffolding of the game',
    citation: 'Source: WNBA, WNBPA, Sportico, Wall Street Journal \u00b7 FORM Atlas',
    palette: 'sand',
  },
  async build() {
    const ev = await getEventsByPillar('money');
    const events = ev.map((e) => ({
      date: e.date,
      title: e.title,
      kicker: e.type ? String(e.type) : '',
      value: e.amountUsd ? formatUsd(e.amountUsd) : '',
    }));
    return {
      events,
      domain: domainFromEvents(ev),
    };
  },
};

function formatUsd(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

const FRANCHISE_TITLES = {
  id: 'franchise-titles',
  title: 'WNBA titles by franchise',
  kicker: 'Hardware',
  description: 'A swatch per franchise, sized by championship count.',
  compatibleShapes: ['palette-stack'],
  defaultShape: 'palette-stack',
  defaultStyle: {
    title: 'WNBA titles by franchise',
    subtitle: 'A swatch per banner raised',
    citation: 'Source: WNBA archives \u00b7 FORM Atlas',
  },
  async build() {
    const [ev, ents] = await Promise.all([getEvents(), getEntities()]);
    const teamById = Object.fromEntries((ents.teams || []).map((t) => [t.id, t]));
    const counts = {};
    ev.forEach((e) => {
      const isChamp = /win[s]? .*championship|win[s]? .*WNBA championship|wins (back-to-back|first|third|fourth|inaugural) (WNBA )?(championship|title)/i.test(
        e.title,
      );
      if (!isChamp) return;
      (e.relatedEntities || []).forEach((id) => {
        const t = teamById[id];
        if (!t || t.meta?.league !== 'wnba') return;
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    const bands = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([id, n]) => {
        const t = teamById[id];
        const color = t.meta?.palette?.[0] || '#1a1714';
        return {
          label: t.name,
          sublabel: `${n} title${n === 1 ? '' : 's'}`,
          color,
          magnitude: n,
        };
      });
    return { bands };
  },
};

const VOICES = {
  id: 'voices',
  title: 'Voices',
  kicker: 'People',
  description:
    'A line at a time. The People pillar held one quote at a time, like a museum wall card.',
  pillar: 'people',
  compatibleShapes: ['quote-card', 'timeline'],
  defaultShape: 'quote-card',
  defaultStyle: {
    title: 'Voices',
    subtitle: 'On the work, the wins, the women who built the room',
    citation: 'Source: archival press \u00b7 FORM Atlas',
    palette: 'ink',
  },
  async build() {
    const ev = await getEventsByPillar('people');
    const quotes = ev
      .filter((e) => e.type === 'quote' && e.quote)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((e) => ({
        quote: e.quote,
        speaker: e.speaker || '',
        context: e.context || e.title || '',
        date: e.date,
        source: e.source || '',
      }));
    return {
      quotes,
      events: ev.map(eventForRender),
      domain: domainFromEvents(ev),
    };
  },
};

const MONEY_TIERS = {
  id: 'money-tiers',
  title: 'Money tiers',
  kicker: 'Money',
  description:
    'The salary tiers and headline deals of the modern WNBA, sized to the dollar.',
  pillar: 'money',
  compatibleShapes: ['treemap'],
  defaultShape: 'treemap',
  defaultStyle: {
    title: 'Money tiers',
    subtitle: 'Where the dollars sit',
    citation: 'Source: WNBPA filings, Sportico \u00b7 FORM Atlas',
  },
  async build() {
    const ev = await getEventsByPillar('money');
    const points = ev
      .filter((e) => Number(e.amountUsd) > 0)
      .sort((a, b) => (Number(b.amountUsd) || 0) - (Number(a.amountUsd) || 0))
      .slice(0, 18)
      .map((e) => ({
        id: e.id,
        label: e.title,
        kicker: e.type || '',
        value: Number(e.amountUsd),
        valueLabel: formatUsd(Number(e.amountUsd)),
        color: tierColorForType(e.type),
        alpha: 0.18,
      }));
    return { points };
  },
};

function tierColorForType(type) {
  switch (String(type)) {
    case 'salary':      return '#487670';
    case 'endorsement': return '#bf3a2c';
    case 'deal':        return '#1a1714';
    case 'milestone':   return '#bf7f3c';
    default:            return '#6b6560';
  }
}

const TITLES_TREEMAP = {
  id: 'titles-treemap',
  title: 'Titles by franchise',
  kicker: 'Hardware',
  description:
    'WNBA championships sized as a treemap \u2014 every banner is a rectangle.',
  pillar: 'performance',
  compatibleShapes: ['treemap', 'palette-stack'],
  defaultShape: 'treemap',
  defaultStyle: {
    title: 'WNBA titles by franchise',
    subtitle: 'A rectangle per banner raised',
    citation: 'Source: WNBA archives \u00b7 FORM Atlas',
  },
  async build() {
    const [ev, ents] = await Promise.all([getEvents(), getEntities()]);
    const teamById = Object.fromEntries((ents.teams || []).map((t) => [t.id, t]));
    const counts = {};
    ev.forEach((e) => {
      const isChamp = /win[s]? .*championship|win[s]? .*WNBA championship|wins (back-to-back|first|third|fourth|inaugural) (WNBA )?(championship|title)/i.test(
        e.title,
      );
      if (!isChamp) return;
      (e.relatedEntities || []).forEach((id) => {
        const t = teamById[id];
        if (!t || t.meta?.league !== 'wnba') return;
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    const points = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([id, n]) => {
        const t = teamById[id];
        return {
          id,
          label: t.name,
          kicker: `${n} title${n === 1 ? '' : 's'}`,
          value: n,
          valueLabel: String(n),
          color: t.meta?.palette?.[0] || '#1a1714',
          alpha: 0.22,
          showValue: false,
        };
      });
    return { points };
  },
};

export const SUBJECTS = [
  MOVEMENTS,
  PERFORMANCE,
  MONEY,
  VOICES,
  TEAM_ARC,
  PERSON_ARC,
  ERAS_STACK,
  FRANCHISE_TITLES,
  TITLES_TREEMAP,
  MONEY_TIERS,
];

export function getSubject(id) {
  return SUBJECTS.find((s) => s.id === id) || null;
}

export function listSubjects() {
  return SUBJECTS.map((s) => ({
    id: s.id,
    title: s.title,
    kicker: s.kicker,
    description: s.description,
    needs: s.needs || null,
    compatibleShapes: s.compatibleShapes,
  }));
}
