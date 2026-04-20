/**
 * Hand-curated Featured Plates.
 *
 * Each plate is fully self-describing: subject + shape + style + dataset + citation.
 * These are the maker's own picks — not derived from compose.js — so they can use
 * exact wording, palette, ordering, and data overrides without touching the compose
 * flow.
 *
 * Phase 1 ships 6 plates spanning Performance + Movements + Eras.
 */

const TITLE_IX = {
  id: 'title-ix-50',
  title: 'Title IX',
  subtitle: 'Fifty years of women in sport',
  kicker: 'Movements',
  pillar: 'movements',
  shape: 'timeline',
  citation: 'Source: U.S. Dept. of Education, NCAA, WNBA \u00b7 FORM Atlas',
  domain: ['1972-01-01', '2025-12-31'],
  events: [
    { date: '1972-06-23', title: 'Title IX signed into law', palette: ['#1a1714'] },
    { date: '1976-07-25', title: 'Women\u2019s basketball debuts at the Montr\u00e9al Olympics' },
    { date: '1981-06-30', title: 'AIAW dissolves; NCAA takes over women\u2019s championships' },
    { date: '1996-08-04', title: 'USA women win Olympic gold in Atlanta' },
    { date: '1997-06-21', title: 'WNBA inaugural game \u00b7 Liberty at Sparks' },
    { date: '2002-07-30', title: 'Lisa Leslie throws the first WNBA dunk' },
    { date: '2014-04-08', title: 'UConn finishes 40\u20130 \u2014 back-to-back national titles' },
    { date: '2021-03-18', title: 'Sedona Prince exposes NCAA tournament weight-room gap' },
    { date: '2022-06-23', title: 'Title IX turns 50' },
    { date: '2023-04-02', title: 'Iowa vs LSU final draws record 9.9M viewers' },
    { date: '2024-04-07', title: 'Iowa vs South Carolina final tops the men\u2019s for the first time' },
    { date: '2024-07-25', title: 'WNBA signs $2.2B media-rights deal' },
    { date: '2025-01-17', title: 'Unrivaled launches its inaugural season' },
  ],
};

const HOUSTON_DYNASTY = {
  id: 'houston-comets-four',
  title: 'Houston Comets',
  subtitle: 'The first dynasty of the WNBA, 1997 \u2013 2008',
  kicker: 'Performance',
  pillar: 'performance',
  shape: 'timeline',
  citation: 'Source: WNBA archives \u00b7 FORM Atlas',
  domain: ['1996-04-01', '2009-01-01'],
  events: [
    { date: '1996-04-24', title: 'WNBA officially announced' },
    { date: '1997-06-21', title: 'WNBA inaugural game \u00b7 Liberty at Sparks' },
    { date: '1997-08-30', title: 'Comets win the inaugural WNBA championship' },
    { date: '1997-09-04', title: 'Cynthia Cooper named first WNBA MVP' },
    { date: '1998-09-01', title: 'Comets repeat \u2014 second straight title' },
    { date: '1999-09-05', title: 'Three-peat \u2014 third straight title' },
    { date: '2000-08-26', title: 'Four-peat sealed \u2014 fourth straight title' },
    { date: '2008-12-01', title: 'Comets fold \u2014 end of the first dynasty' },
  ],
};

const SUPERNOVA = {
  id: 'supernova-2024',
  title: 'The supernova season',
  subtitle: 'Caitlin, Angel, A\u2019ja, and a league suddenly seen',
  kicker: 'Performance',
  pillar: 'performance',
  shape: 'timeline',
  citation: 'Source: NCAA, WNBA, ESPN \u00b7 FORM Atlas',
  domain: ['2024-02-01', '2024-12-31'],
  dateMode: 'long',
  events: [
    { date: '2024-02-15', title: 'Caitlin Clark passes Lynette Woodard for NCAA scoring record' },
    { date: '2024-03-03', title: 'Clark passes Pete Maravich for D-I scoring record' },
    { date: '2024-04-07', title: 'South Carolina caps 38\u20130 \u00b7 final draws 18.7M viewers' },
    { date: '2024-04-15', title: 'Clark #1, Reese #7 in the WNBA draft' },
    { date: '2024-05-14', title: 'Clark\u2019s WNBA debut at Connecticut' },
    { date: '2024-07-06', title: 'First rookie triple-double in league history' },
    { date: '2024-07-25', title: 'WNBA signs $2.2B media-rights deal' },
    { date: '2024-09-22', title: 'A\u2019ja Wilson MVP \u2014 third in four years' },
    { date: '2024-09-25', title: 'Clark sets single-season 3PM record' },
    { date: '2024-10-20', title: 'Liberty win first championship' },
  ],
};

const CHAMPIONS_BY_FRANCHISE = {
  id: 'champs-by-franchise',
  title: 'WNBA titles by franchise',
  subtitle: 'A swatch per banner raised',
  kicker: 'Hardware',
  pillar: 'performance',
  shape: 'palette-stack',
  citation: 'Source: WNBA archives \u00b7 FORM Atlas',
  bands: [
    { label: 'Houston Comets', sublabel: '1997 \u2013 2000', color: '#bf3a2c', magnitude: 4, note: 'The four-peat that taught the league how to win.' },
    { label: 'Minnesota Lynx', sublabel: '2011 \u2013 2017', color: '#0e2240', magnitude: 4, note: 'Maya, Seimone, Lindsay, Sylvia, Rebekkah.' },
    { label: 'Seattle Storm', sublabel: '2004 \u2013 2020', color: '#2c5234', magnitude: 4, note: 'Sue Bird era through Stewie\u2019s second ring.' },
    { label: 'Las Vegas Aces', sublabel: '2022 \u2013 2023', color: '#000000', magnitude: 2, note: 'Back-to-back \u00b7 A\u2019ja Wilson at the center.' },
    { label: 'Phoenix Mercury', sublabel: '2007 \u2013 2014', color: '#bf7f3c', magnitude: 3, note: 'Diana Taurasi\u2019s house.' },
    { label: 'Detroit Shock', sublabel: '2003 \u2013 2008', color: '#143a73', magnitude: 3, note: 'Bill Laimbeer\u2019s grit dynasty.' },
    { label: 'New York Liberty', sublabel: '2024', color: '#487670', magnitude: 1, note: 'A long-awaited first.' },
  ],
};

const ERAS_OF_THE_GAME = {
  id: 'eras-of-the-game',
  title: 'Eras since Title IX',
  subtitle: 'Five decades of women\u2019s basketball, as pigment',
  kicker: 'Eras',
  pillar: 'movements',
  shape: 'palette-stack',
  citation: 'Source: composite \u00b7 FORM Atlas',
  bands: [
    { label: 'The AIAW years', sublabel: '1972 \u2013 1981', color: '#5a4a36', magnitude: 9, note: 'Title IX rewrites the rule. The AIAW runs the championship.' },
    { label: 'NCAA takes over', sublabel: '1982 \u2013 1996', color: '#7a3e2a', magnitude: 14, note: 'Pat Summitt era. The pyramid of college power forms.' },
    { label: 'Birth of the WNBA', sublabel: '1997 \u2013 2007', color: '#487670', magnitude: 10, note: 'Houston four-peats. The pro league learns its language.' },
    { label: 'The pro game grows', sublabel: '2008 \u2013 2019', color: '#bf7f3c', magnitude: 11, note: 'Lynx and Storm dynasties. Players take the floor as activists.' },
    { label: 'Era of the supernova', sublabel: '2020 \u2013 present', color: '#bf3a2c', magnitude: 6, note: 'New CBAs. New money. Caitlin, Angel, A\u2019ja, Stewie.' },
  ],
};

const PAT_SUMMITT_LIFE = {
  id: 'pat-summitt-life',
  title: 'Pat Summitt',
  subtitle: 'A life on the bench at Tennessee',
  kicker: 'Career arc',
  pillar: 'performance',
  shape: 'timeline',
  citation: 'Source: Tennessee Athletics, NCAA \u00b7 FORM Atlas',
  domain: ['1974-01-01', '2017-01-01'],
  events: [
    { date: '1974-04-01', title: 'Hired as Tennessee head coach at age 22' },
    { date: '1976-07-25', title: 'Plays in U.S. silver medal Olympic team' },
    { date: '1984-08-07', title: 'Coaches U.S. women to Olympic gold in Los Angeles' },
    { date: '1987-03-29', title: 'First national championship' },
    { date: '1996-03-22', title: '600 career wins' },
    { date: '1998-03-29', title: 'Sixth national championship \u00b7 39\u20130 season' },
    { date: '2005-03-22', title: '880 wins, NCAA all-time record' },
    { date: '2008-04-08', title: 'Eighth and final national championship' },
    { date: '2009-02-05', title: 'First NCAA D-I coach with 1,000 wins' },
    { date: '2011-08-23', title: 'Diagnosed with early-onset Alzheimer\u2019s' },
    { date: '2012-04-18', title: 'Steps down after 38 seasons' },
    { date: '2016-06-28', title: 'Pat Summitt dies at 64' },
  ],
};

const MOVEMENTS_OF_THE_GAME = {
  id: 'movements-of-the-game',
  title: 'Movements',
  subtitle: 'The politics under the points',
  kicker: 'Movements',
  pillar: 'movements',
  shape: 'timeline',
  citation: 'Source: WNBA, NCAA, U.S. Dept. of Education \u00b7 FORM Atlas',
  domain: ['1972-01-01', '2025-12-31'],
  events: [
    { date: '1972-06-23', title: 'Title IX signed into law' },
    { date: '1981-06-30', title: 'NCAA absorbs women\u2019s championships' },
    { date: '1996-04-24', title: 'WNBA officially announced' },
    { date: '2016-07-09', title: 'Lynx players wear Black Lives Matter shirts in warmups' },
    { date: '2020-01-14', title: 'WNBA + WNBPA sign landmark CBA \u00b7 max salary +53%' },
    { date: '2020-09-08', title: 'Season dedicated to Say Her Name campaign' },
    { date: '2021-03-18', title: 'Sedona Prince exposes NCAA weight-room gap' },
    { date: '2021-07-01', title: 'NCAA NIL era begins' },
    { date: '2022-06-23', title: 'Title IX turns 50' },
    { date: '2024-07-25', title: 'WNBA signs $2.2B media-rights deal' },
    { date: '2025-01-17', title: 'Unrivaled launches inaugural season' },
    { date: '2025-10-31', title: 'WNBA + WNBPA open negotiations on next CBA' },
  ],
};

const MEDIA_RIGHTS_FLOW = {
  id: 'media-rights-flow',
  title: 'The $2.2B media deal',
  subtitle: 'Where eleven years of WNBA broadcast money flows',
  kicker: 'Money',
  pillar: 'money',
  shape: 'sankey',
  citation: 'Source: WNBA league announcements, Sportico \u00b7 FORM Atlas',
  sources: [
    { id: 'espn',   label: 'Disney / ESPN', magnitude: 1.1, color: '#cf2228' },
    { id: 'nbc',    label: 'NBC Universal', magnitude: 0.6, color: '#0089d0' },
    { id: 'amazon', label: 'Amazon Prime',  magnitude: 0.5, color: '#00a8e1' },
  ],
  targets: [
    { id: 'players', label: 'Players (CBA share)', magnitude: 1.0, color: '#487670' },
    { id: 'league',  label: 'League ops',          magnitude: 0.6, color: '#1a1714' },
    { id: 'teams',   label: 'Team owners',         magnitude: 0.4, color: '#bf7f3c' },
    { id: 'growth',  label: 'Growth / expansion',  magnitude: 0.2, color: '#7a3e2a' },
  ],
  flows: [
    { from: 'espn',   to: 'players', magnitude: 0.55, color: '#cf2228' },
    { from: 'espn',   to: 'league',  magnitude: 0.30, color: '#cf2228' },
    { from: 'espn',   to: 'teams',   magnitude: 0.20, color: '#cf2228' },
    { from: 'espn',   to: 'growth',  magnitude: 0.05, color: '#cf2228' },
    { from: 'nbc',    to: 'players', magnitude: 0.30, color: '#0089d0' },
    { from: 'nbc',    to: 'league',  magnitude: 0.18, color: '#0089d0' },
    { from: 'nbc',    to: 'teams',   magnitude: 0.10, color: '#0089d0' },
    { from: 'nbc',    to: 'growth',  magnitude: 0.05, color: '#0089d0' },
    { from: 'amazon', to: 'players', magnitude: 0.20, color: '#00a8e1' },
    { from: 'amazon', to: 'league',  magnitude: 0.16, color: '#00a8e1' },
    { from: 'amazon', to: 'teams',   magnitude: 0.10, color: '#00a8e1' },
    { from: 'amazon', to: 'growth',  magnitude: 0.06, color: '#00a8e1' },
  ],
};

const SIGNINGS_RIBBON = {
  id: 'signings-ribbon-2024',
  title: 'Endorsement season',
  subtitle: 'The deals that rewrote what a women\u2019s basketball career is worth',
  kicker: 'Money',
  pillar: 'money',
  shape: 'event-ribbon',
  citation: 'Source: WSJ, Sportico, brand press releases \u00b7 FORM Atlas',
  events: [
    { date: '2021-11-09', kicker: 'NIL',         title: 'Paige Bueckers signs first NIL deal \u00b7 Crocs + Nike', color: '#000000' },
    { date: '2024-04-09', kicker: 'Endorsement', title: 'Angel Reese signs landmark Reebok deal',                color: '#cf102d' },
    { date: '2024-04-12', kicker: 'Endorsement', title: 'Caitlin Clark signs 8-year Nike deal',  value: '$28M',  color: '#fa5400' },
    { date: '2024-04-15', kicker: 'Salary',      title: 'Clark rookie scale contract \u00b7 4 years', value: '$338K', color: '#487670' },
    { date: '2024-07-25', kicker: 'Media',       title: 'WNBA media-rights deal',                value: '$2.2B', color: '#bf3a2c' },
    { date: '2024-09-18', kicker: 'Salary',      title: 'Unrivaled offers founding 30: base + equity', value: '$100K+', color: '#7a3e2a' },
    { date: '2024-10-25', kicker: 'Valuation',   title: 'Liberty cross $400M valuation',         value: '$400M', color: '#487670' },
  ],
};

const SUMMITT_VOICE = {
  id: 'summitt-voice',
  title: 'Pat Summitt',
  subtitle: 'On her 1,000th win',
  kicker: 'Voices',
  pillar: 'people',
  shape: 'quote-card',
  citation: 'Source: ESPN feature, 2009 \u00b7 FORM Atlas',
  quotes: [
    {
      quote: "Left foot, right foot, breathe. That's how you finish a season.",
      speaker: 'Pat Summitt',
      context: '1,000th career win, Tennessee',
      date: '2009-02-05',
      source: 'ESPN feature, 2009',
    },
  ],
};

const STAFF_VOICE = {
  id: 'staley-voice',
  title: 'Dawn Staley',
  subtitle: 'On 38\u20130 \u2014 the second perfect season',
  kicker: 'Voices',
  pillar: 'people',
  shape: 'quote-card',
  citation: 'Source: NCAA championship podium, 2024 \u00b7 FORM Atlas',
  quotes: [
    {
      quote: 'We hire who we want. We coach who we want. We win how we want. Period.',
      speaker: 'Dawn Staley',
      context: 'After Gamecocks complete 38\u20130 season',
      date: '2024-04-07',
      source: 'NCAA championship podium',
    },
  ],
};

const TITLES_TREEMAP_PLATE = {
  id: 'titles-by-banner',
  title: 'WNBA titles, by franchise',
  subtitle: 'A rectangle per banner raised',
  kicker: 'Hardware',
  pillar: 'performance',
  shape: 'treemap',
  citation: 'Source: WNBA archives \u00b7 FORM Atlas',
  points: [
    { id: 'comets',  label: 'Houston Comets',     kicker: '1997\u20132000', value: 4, color: '#CE1141', alpha: 0.22, valueLabel: '4' },
    { id: 'lynx',    label: 'Minnesota Lynx',     kicker: '2011\u20132017', value: 4, color: '#236192', alpha: 0.22, valueLabel: '4' },
    { id: 'storm',   label: 'Seattle Storm',      kicker: '2004\u20132020', value: 4, color: '#2C5234', alpha: 0.22, valueLabel: '4' },
    { id: 'aces',    label: 'Las Vegas Aces',     kicker: '2022\u20132023', value: 2, color: '#000000', alpha: 0.22, valueLabel: '2' },
    { id: 'mercury', label: 'Phoenix Mercury',    kicker: '2007\u20132014', value: 3, color: '#201747', alpha: 0.22, valueLabel: '3' },
    { id: 'sparks',  label: 'Los Angeles Sparks', kicker: '2001\u20132016', value: 3, color: '#552583', alpha: 0.22, valueLabel: '3' },
    { id: 'liberty', label: 'New York Liberty',   kicker: '2024',           value: 1, color: '#86CEBC', alpha: 0.22, valueLabel: '1' },
    { id: 'sky',     label: 'Chicago Sky',        kicker: '2021',           value: 1, color: '#418FDE', alpha: 0.22, valueLabel: '1' },
    { id: 'dream',   label: 'Detroit Shock',      kicker: '2003\u20132008', value: 3, color: '#1a1714', alpha: 0.18, valueLabel: '3' },
    { id: 'mystics', label: 'Washington Mystics', kicker: '2019',           value: 1, color: '#002B5C', alpha: 0.22, valueLabel: '1' },
  ],
};

const MONEY_TIERS_PLATE = {
  id: 'money-tiers-2024',
  title: 'What a women\u2019s basketball career is worth',
  subtitle: 'A rectangle per dollar',
  kicker: 'Money',
  pillar: 'money',
  shape: 'treemap',
  citation: 'Source: WNBPA filings, Sportico, WSJ \u00b7 FORM Atlas',
  points: [
    { id: 'media',     label: 'Media-rights deal',          kicker: 'Deal',        value: 2200, valueLabel: '$2.2B', color: '#bf3a2c', alpha: 0.20 },
    { id: 'expansion', label: 'New franchise expansion fee',kicker: 'Deal',        value: 250,  valueLabel: '$250M', color: '#1a1714', alpha: 0.18 },
    { id: 'revenue',   label: 'League revenue (proj. 2024)',kicker: 'Milestone',   value: 200,  valueLabel: '$200M', color: '#bf7f3c', alpha: 0.18 },
    { id: 'liberty',   label: 'Liberty franchise valuation',kicker: 'Milestone',   value: 400,  valueLabel: '$400M', color: '#487670', alpha: 0.18 },
    { id: 'aces',      label: 'Aces franchise valuation',   kicker: 'Milestone',   value: 200,  valueLabel: '$200M', color: '#7a3e2a', alpha: 0.18 },
    { id: 'clark',     label: 'Caitlin Clark Nike deal',    kicker: 'Endorsement', value: 28,   valueLabel: '$28M',  color: '#fa5400', alpha: 0.22 },
    { id: 'rookie',    label: 'WNBA rookie scale',          kicker: 'Salary',      value: 0.34, valueLabel: '$338K', color: '#487670', alpha: 0.22 },
    { id: 'super',     label: 'WNBA supermax salary',       kicker: 'Salary',      value: 0.245,valueLabel: '$245K', color: '#487670', alpha: 0.22 },
    { id: 'unrivaled', label: 'Unrivaled founding 30',      kicker: 'Salary',      value: 0.10, valueLabel: '$100K+',color: '#88a8a3', alpha: 0.22 },
  ],
};

export const FEATURED_PLATES = [
  TITLE_IX,
  SUMMITT_VOICE,
  SUPERNOVA,
  MEDIA_RIGHTS_FLOW,
  TITLES_TREEMAP_PLATE,
  STAFF_VOICE,
  CHAMPIONS_BY_FRANCHISE,
  SIGNINGS_RIBBON,
  MONEY_TIERS_PLATE,
  HOUSTON_DYNASTY,
  ERAS_OF_THE_GAME,
  PAT_SUMMITT_LIFE,
  MOVEMENTS_OF_THE_GAME,
];

export function getFeaturedPlate(id) {
  return FEATURED_PLATES.find((p) => p.id === id) || null;
}
