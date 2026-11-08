/**
 * HUGINN story clustering.
 * =====================================================================
 * Pure JS, no React Native imports -- runs in Node for tests/benchmarks.
 *
 * The job: take a pile of headlines from ~60 outlets and recover "stories" --
 * one event, many tellings. What matters for HUGINN is not just grouping, but
 * grouping ACROSS perspectives: a story that only one outlet covered is not
 * interesting, a story covered by a state wire and an exiled opposition paper
 * side by side is the whole point.
 *
 * Pipeline
 *   1. clean     strip source suffixes, entities, boilerplate
 *   2. tokenize  diacritic folding, light stemming, stopwords
 *   3. weight    TF-IDF over the current batch, proper nouns boosted
 *   4. link      cosine similarity above an adaptive threshold, union-find
 *   5. shape     source-diversity floors, size/time caps, ranking, labelling
 *
 * Why not the old 2-shared-keywords rule: it compared raw title words with no
 * IDF, so "trump" or "israel" linked unrelated stories, while "kills" vs
 * "killed" failed to link the same story. Every threshold below was calibrated
 * against a real fixture of ~200 live headlines (scripts/cluster-eval.mjs).
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  // articles, preps, pronouns, auxiliaries
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'that', 'this', 'these',
  'those', 'it', 'its', 'he', 'she', 'they', 'we', 'you', 'his', 'her',
  'their', 'our', 'my', 'your', 'what', 'which', 'who', 'whom', 'how',
  'when', 'where', 'why', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'only', 'own', 'same', 'also', 'very',
  'just', 'over', 'after', 'before', 'between', 'under', 'again', 'further',
  'about', 'up', 'out', 'off', 'down', 'with', 'from', 'by', 'as', 'into',
  'through', 'during', 'here', 'there',
  // news boilerplate: high frequency, zero discriminative value
  'new', 'says', 'said', 'say', 'news', 'report', 'reports', 'reported',
  'according', 'amid', 'update', 'updates', 'live', 'breaking', 'latest',
  'video', 'photos', 'watch', 'exclusive', 'analysis', 'opinion', 'editorial',
  'today', 'yesterday', 'week', 'month', 'year', 'day', 'time', 'first',
  'last', 'next', 'one', 'two', 'three', 'four', 'five', 'several', 'many',
  'much', 'like', 'still', 'back', 'even', 'well', 'way', 'make', 'makes',
  'made', 'gets', 'get', 'got', 'set', 'take', 'takes', 'took', 'give',
  'gives', 'gave', 'goes', 'went', 'come', 'comes', 'came', 'put', 'puts',
  'use', 'uses', 'used', 'using', 'help', 'helps', 'helped', 'need', 'needs',
  'want', 'wants', 'wanted', 'know', 'knows', 'think', 'thinks', 'see',
  'sees', 'seen', 'look', 'looks', 'find', 'finds', 'found', 'call', 'calls',
  'called', 'show', 'shows', 'shown', 'turn', 'turns', 'keep', 'keeps',
  'begins', 'began', 'start', 'starts', 'started', 'end', 'ends', 'ended',
  'could', 'cannot', 'can', 'wont', 'dont', 'doesnt', 'isnt', 'didnt',
  'heres', 'whats', 'thats', 'theyre', 'were',
  // time-of-day / calendar (they name the publish time, not the story)
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  'am', 'pm', 'gmt', 'utc', 'est', 'pst', 'bst',
  // non-English function words that leak from multi-lingual feeds
  'via', 'de', 'la', 'el', 'en', 'los', 'las', 'un', 'una', 'del', 'al',
  'por', 'con', 'para', 'se', 'su', 'es', 'que', 'em', 'da', 'do', 'das',
  'dos', 'na', 'nas', 'com', 'uma', 'um', 'ao', 'aos', 'ou', 'mas', 'mais',
  'der', 'die', 'das', 'und', 'mit', 'von', 'den', 'des', 'ist', 'ein',
  'une', 'des', 'du', 'le', 'les', 'et', 'aux', 'sur', 'dans',
]);

// Words that are capitalized in headlines but are not story entities.
const NOT_ENTITIES = new Set([
  ...STOP_WORDS,
  'why', 'how', 'what', 'who', 'when', 'where', 'here', 'there',
  'exclusive', 'breaking', 'opinion', 'analysis', 'editorial', 'review',
  'photos', 'video', 'podcast', 'listen', 'newsletter', 'explainer',
  'president', 'minister', 'prime', 'foreign', 'government', 'official',
  'officials', 'police', 'court', 'report', 'special', 'world', 'global',
  'europe', 'asia', 'africa', 'america', 'international', 'national',
  'city', 'county', 'state', 'south', 'north', 'east', 'west',
  'the', 'a', 'an', 'it', 'he', 'she', 'they', 'we', 'you', 'i',
]);

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

const fold = (text) => text
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')      // strip accents
  .replace(/[\u2018\u2019\u02bc]/g, "'")
  .toLowerCase();

/**
 * Conservative stemmer. Not Porter -- headlines don't need it, and aggressive
 * stemming collides distinct entities ("Hamas"/"Hamass" no, but "polls"/"police"
 * style noise yes). Handles the morphology that actually breaks matching:
 * plurals, -ing, -ed, and -ied.
 */
export function stem(word) {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('ves')) return w.slice(0, -3) + 'f';
  // Doubled l/s/f/z is part of the stem ("killed" -> "kill", not "kil").
  const undouble = (x) => (x.length > 2 && x[x.length - 1] === x[x.length - 2]
    && !'lsfz'.includes(x[x.length - 1]) ? x.slice(0, -1) : x);
  if (w.length > 5 && w.endsWith('ing')) return undouble(w.slice(0, -3));
  if (w.length > 4 && w.endsWith('ed')) return undouble(w.slice(0, -2));
  if (w.length > 5 && w.endsWith('ally')) return w.slice(0, -4);
  if (w.length > 4 && w.endsWith('ly')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('es') && /(ch|sh|x|z|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
  return w;
}

/**
 * Google News and several CMSes append " - Outlet Name" or " | Section" to
 * every title. Left in, that suffix becomes the highest-IDF term in the batch
 * and swamps the real story words.
 */
export function cleanTitle(title, sourceName = '') {
  let t = String(title || '').trim();
  const parts = t.split(/\s+[-\u2013\u2014|]\s+/);
  if (parts.length > 1) {
    const tail = parts[parts.length - 1].toLowerCase();
    const name = String(sourceName || '').toLowerCase();
    const nameTokens = name.split(/\s+/).filter(Boolean);
    const tailTokens = tail.split(/\s+/).filter(Boolean);
    const overlaps = tailTokens.some(tok => tok.length > 2 && nameTokens.includes(tok));
    if (overlaps || tailTokens.length <= 2) t = parts.slice(0, -1).join(' - ');
  }
  return t;
}

/** Proper-noun-ish tokens, with their original surface form for labels. */
function extractEntities(rawTitle) {
  const entities = new Map(); // normalized -> surface
  const title = String(rawTitle || '');
  const words = title.match(/[A-Z][A-Za-z'\u2019-]{1,}|[A-Z]{2,}/g) || [];
  // A capitalized first word is usually just sentence case ("Train collision
  // in Egypt"), so it counts as a hint for matching but not as a label.
  const firstWord = (title.match(/^[A-Z][A-Za-z'\u2019-]+/) || [''])[0];
  for (const word of words) {
    const bare = word.replace(/['\u2019]s$/, '');
    const key = bare.toLowerCase();
    if (key.length < 2 || NOT_ENTITIES.has(key)) continue;
    const strong = !(bare === firstWord && bare.length > 3 && !/^[A-Z]{2,}$/.test(bare));
    const prev = entities.get(key);
    if (!prev || (!prev.strong && strong)) entities.set(key, { surface: bare, strong });
  }
  return entities;
}

export function tokenize(text) {
  const tokens = [];
  for (const raw of fold(String(text || '')).split(/[^a-z0-9']+/)) {
    const t = raw.replace(/^'+|'+$/g, '').replace(/'s$/, '');
    if (t.length < 3) continue;
    if (/^\d+$/.test(t)) continue;
    if (STOP_WORDS.has(t)) continue;
    tokens.push(stem(t));
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Document index (TF-IDF over the batch)
// ---------------------------------------------------------------------------

const DESC_WEIGHT = 0.34;   // description terms: real recall, thin precision
const ENTITY_BOOST = 1.7;   // proper nouns are the story, not the frame

function buildDoc(article, source) {
  const sourceName = source ? source.name : '';
  const title = cleanTitle(article.title, sourceName);
  const entities = extractEntities(title);

  const weights = new Map(); // term -> weight (pre-IDF)
  const add = (term, w) => weights.set(term, (weights.get(term) || 0) + w);
  const isEntity = (term) => entities.has(term) || entities.has(term.replace(/s$/, ''));

  for (const term of tokenize(title)) {
    let w = 1;
    const ent = entities.get(term);
    if (ent) w = ent.strong ? ENTITY_BOOST : 1.25;
    add(term, w);
  }
  for (const term of tokenize(String(article.description || '').slice(0, 240))) {
    if (!weights.has(term)) add(term, DESC_WEIGHT);
  }

  const surfaces = new Map();   // stemmed term -> display form
  const strongTerms = new Set(); // stems that came from a proper noun
  for (const [key, ent] of entities) {
    const st = stem(key);
    if (!surfaces.has(st)) surfaces.set(st, ent.surface);
    if (ent.strong) strongTerms.add(st);
  }

  // "Abu Dhabi", "South Africa", "Saudi Arabia": adjacent capitalised words are
  // one name, not two. Keyed by the stem pair so the labeller can re-join them.
  // Capitalised but structural words are excluded so "Paulo Grand Prix" doesn't
  // become a place name.
  const PHRASE_BLOCK = new Set(['grand', 'prix', 'city', 'county', 'court', 'police', 'minister',
    'president', 'party', 'government', 'state', 'street', 'station', 'university', 'bank',
    'tower', 'cup', 'open', 'series', 'group', 'company', 'corp', 'inc', 'ltd', 'dept',
    'department', 'agency', 'fund', 'board', 'committee', 'council', 'office']);
  const phrases = new Map();
  const rawWords = title.split(/\s+/);
  for (let i = 0; i < rawWords.length - 1; i++) {
    // Test the ORIGINAL tokens, punctuation included: "Musk, Miller" is two
    // people, "Musk Miller" would only be one if the comma weren't there.
    const a = rawWords[i].replace(/^[("'\u201c\u2018]+|[)"'\u201d\u2019,!?.:;]+$/g, '');
    const b = rawWords[i + 1].replace(/^[("'\u201c\u2018]+|[)"'\u201d\u2019,!?.:;]+$/g, '');
    // Latin-1 letters too: "Sao Paulo" arrives as "São Paulo".
    if (!/^[A-Z][a-zA-Z\u00C0-\u024F'\u2019-]+$/.test(a) || !/^[A-Z][a-zA-Z\u00C0-\u024F'\u2019-]+$/.test(b)) continue;
    if (rawWords[i] !== a || rawWords[i + 1] !== b) continue;
    if (NOT_ENTITIES.has(a.toLowerCase()) || NOT_ENTITIES.has(b.toLowerCase())) continue;
    if (PHRASE_BLOCK.has(a.toLowerCase()) || PHRASE_BLOCK.has(b.toLowerCase())) continue;
    const key = `${stem(a.toLowerCase())}|${stem(b.toLowerCase())}`;
    if (!phrases.has(key)) phrases.set(key, `${a} ${b}`);
  }

  return {
    article,
    source,
    entities,
    weights,
    surfaces,
    strongTerms,
    phrases,
    isEntity,
    // kept for labelling: term -> surface form as it appeared
    time: article.pubDate instanceof Date ? article.pubDate.getTime() : Number(article.pubDate) || 0,
  };
}

/**
 * Weight docs with IDF, cosine-normalise, and expose a term -> docs index so
 * candidate pairs come from shared rare terms instead of an O(n^2) sweep.
 */
function buildIndex(docs) {
  const df = new Map();
  for (const doc of docs) {
    for (const term of doc.weights.keys()) df.set(term, (df.get(term) || 0) + 1);
  }
  const N = Math.max(docs.length, 1);
  const idf = new Map();
  for (const [term, count] of df) idf.set(term, Math.log((N + 1) / (count + 0.5)));

  for (const doc of docs) {
    let sumSq = 0;
    const vec = new Map();
    for (const [term, raw] of doc.weights) {
      const w = (1 + Math.log2(1 + raw)) * (idf.get(term) || 0);
      if (w <= 0) continue;
      vec.set(term, w);
      sumSq += w * w;
    }
    doc.vec = vec;
    doc.norm = Math.sqrt(sumSq) || 1;
  }

  const postings = new Map(); // term -> doc indices
  docs.forEach((doc, i) => {
    for (const term of doc.vec.keys()) {
      if (!postings.has(term)) postings.set(term, []);
      postings.get(term).push(i);
    }
  });

  return { idf, postings };
}

function cosine(a, b) {
  let dot = 0;
  const [small, big] = a.vec.size <= b.vec.size ? [a, b] : [b, a];
  for (const [term, w] of small.vec) {
    const other = big.vec.get(term);
    if (other) dot += w * other;
  }
  return dot / (a.norm * b.norm);
}

// ---------------------------------------------------------------------------
// Union-find
// ---------------------------------------------------------------------------

function makeDSU(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) { const next = parent[x]; parent[x] = r; x = next; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a); const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  return { find, union };
}

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

const DEFAULTS = {
  threshold: 0.28,        // cosine similarity required to link two articles
  singleAnchorSim: 0.42,  // ...when the pair shares only one distinctive term
  minSharing: 1,          // at least this many non-boilerplate shared terms
  maxPairs: 120000,       // safety valve for pathological batches
  timeWindowMs: 48 * 3600 * 1000,
  maxClusterSize: 12,
  maxPerSource: 2,
  minSources: 2,
  anchorIdf: 0.55,        // a "strong" term is seen in < ~40% of the batch
};

/**
 * Group articles into stories.
 *
 * @param {Array}  articles    - [{ id, sourceId, title, description, pubDate }]
 * @param {Function} getSource - id -> source record ({ leanType, name })
 * @param {Object} options     - overrides for DEFAULTS
 * @returns {{clusters: Array, unclustered: number, stats: Object}}
 */
export function clusterArticles(articles, getSource = () => null, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const docs = (articles || [])
    .filter(a => a && a.title)
    .map(a => buildDoc(a, getSource(a.sourceId)));

  if (docs.length < 2) return { clusters: [], unclustered: docs.length, stats: { docs: docs.length, pairs: 0 } };

  const { idf, postings } = buildIndex(docs);

  // Candidate pairs: two articles can only be the same story if they share a
  // term that is specific enough to mean something.
  const seen = new Set();
  const pairs = [];
  for (const [term, ids] of postings) {
    if (ids.length < 2 || ids.length > 60) continue;           // ubiquitous terms are noise
    if ((idf.get(term) || 0) < opts.anchorIdf) continue;
    for (let x = 0; x < ids.length; x++) {
      for (let y = x + 1; y < ids.length; y++) {
        const a = ids[x]; const b = ids[y];
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([Math.min(a, b), Math.max(a, b)]);
        if (pairs.length > opts.maxPairs) break;
      }
    }
  }

  const dsu = makeDSU(docs.length);
  const links = new Map(); // docIndex -> best link score
  let accepted = 0;

  for (const [i, j] of pairs) {
    const A = docs[i]; const B = docs[j];
    if (Math.abs(A.time - B.time) > opts.timeWindowMs) continue;

    let shared = 0;
    let strong = 0;
    for (const term of A.vec.keys()) {
      if (!B.vec.has(term)) continue;
      shared++;
      if ((idf.get(term) || 0) >= opts.anchorIdf) strong++;
    }
    if (shared < opts.minSharing) continue;

    const sim = cosine(A, B);
    if (sim < opts.threshold) continue;
    // One shared word is only enough when it is a named entity and the rest of
    // the headline lines up. Otherwise short headlines merge on "Iran" alone.
    if (strong < 2 && !(strong >= 1 && sim >= opts.singleAnchorSim)) continue;

    dsu.union(i, j);
    accepted++;
    links.set(i, Math.max(links.get(i) || 0, sim));
    links.set(j, Math.max(links.get(j) || 0, sim));
  }

  // Collect components
  const groups = new Map();
  docs.forEach((doc, i) => {
    const root = dsu.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  });

  const clusters = [];
  let unclustered = 0;

  for (const members of groups.values()) {
    if (members.length < 2) { unclustered++; continue; }

    // Rank members: best link first, then newest. Enforce per-source cap so a
    // single wire don't fill a cluster with twelve rewrites of one story.
    const perSource = new Map();
    const kept = [];
    const ranked = members
      .slice()
      .sort((a, b) => (links.get(b) || 0) - (links.get(a) || 0) || docs[b].time - docs[a].time);

    for (const idx of ranked) {
      const sid = docs[idx].article.sourceId || 'unknown';
      const count = perSource.get(sid) || 0;
      if (count >= opts.maxPerSource) continue;
      perSource.set(sid, count + 1);
      kept.push(idx);
      if (kept.length >= opts.maxClusterSize) break;
    }

    const distinctSources = new Set(kept.map(idx => docs[idx].article.sourceId));
    if (distinctSources.size < opts.minSources) { unclustered += kept.length; continue; }

    const clusterDocs = kept.map(idx => docs[idx]);
    const scores = kept.map(idx => links.get(idx) || 0);

    clusters.push(makeCluster(clusterDocs, scores, idf));
  }

  clusters.sort((a, b) => b.newestDate - a.newestDate || b.articleCount - a.articleCount);
  return {
    clusters,
    unclustered,
    stats: {
      docs: docs.length,
      pairs: pairs.length,
      links: accepted,
      clusterCount: clusters.length,
      meanSources: clusters.length
        ? +(clusters.reduce((sum, c) => sum + c.articleCount, 0) / clusters.length).toFixed(2)
        : 0,
    },
  };
}

/**
 * Label a cluster from the terms its members actually share, preferring proper
 * nouns ("Strait · Hormuz") over generic descriptors.
 */
function makeCluster(docs, scores, idf) {
  const termDocs = new Map(); // term -> { count, idfMass }
  for (const doc of docs) {
    for (const term of doc.vec.keys()) {
      const entry = termDocs.get(term) || { count: 0, idfMass: 0 };
      entry.count += 1;
      entry.idfMass += idf.get(term) || 0;
      termDocs.set(term, entry);
    }
  }

  const surfaces = new Map();
  const strongStems = new Set();
  for (const doc of docs) {
    for (const [term, surface] of doc.surfaces) if (!surfaces.has(term)) surfaces.set(term, surface);
    for (const term of doc.strongTerms) strongStems.add(term);
  }

  const scoreOf = (term, entry) => entry.idfMass
    * (1 + 0.5 * (entry.count - 1))
    * (strongStems.has(term) ? 2.2 : surfaces.has(term) ? 1.4 : 1);

  const shared = [...termDocs.entries()]
    .filter(([, e]) => e.count >= Math.min(2, docs.length))
    .sort((a, b) => scoreOf(b[0], b[1]) - scoreOf(a[0], a[1]));

  // Who/what the story is about beats what the story says about it: label with
  // proper nouns when the cluster agrees on any ("Eisenkot", "Netanyahu"). A
  // lone entity is a better label than "ANC · Worst", so no adjective fill-in
  // until there are at least two names.
  let labelTerms = shared.filter(([term]) => strongStems.has(term)).slice(0, 2);
  if (labelTerms.length === 0) {
    labelTerms = shared
      .filter(([term, entry]) => entry.count >= Math.max(2, Math.ceil(docs.length * 0.5)) || docs.length === 2)
      .slice(0, 2);
  }

  // Re-join multi-word names, and order the label the way the headline does
  // ("Abu Dhabi", not "Dhabi · Abu").
  const phraseCounts = new Map();
  for (const doc of docs) for (const [key, text] of doc.phrases) {
    phraseCounts.set(key, (phraseCounts.get(key) || 0) + 1);
  }
  // Expand a lone half of a known name: "Paulo" -> "São Paulo" when the other
  // half is itself a shared term of this cluster.
  const minSupport = Math.min(2, docs.length);
  const expand = (term) => {
    // "paulo" can sit in "Sao Paulo" and in "Paulo Grand": take the partner
    // that the cluster mentions most, preferring the one that puts this term
    // second (the tail of a name is the safer anchor).
    let best = null;
    for (const [key, count] of phraseCounts) {
      if (count < minSupport) continue;
      const [left, right] = key.split('|');
      const isTail = right === term;
      const other = isTail ? left : left === term ? right : null;
      if (!other) continue;
      const otherEntry = termDocs.get(other);
      if (!otherEntry || otherEntry.count < minSupport) continue;
      const surface = docs.map(d => d.phrases.get(key)).find(Boolean);
      if (!surface) continue;
      const score = otherEntry.count * 2 + (isTail ? 1 : 0);
      if (!best || score > best.score) best = { term, surface, consumed: other, score };
    }
    return best || { term, surface: surfaces.get(term) || term, consumed: null };
  };

  const used = new Set();
  const expanded = [];
  for (const [term] of labelTerms) {
    if (used.has(term)) continue;
    const result = expand(term);
    if (result.consumed) used.add(result.consumed);
    expanded.push(result.surface);
  }
  const labelParts = expanded;

  const label = labelParts.length
    ? labelParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' \u00b7 ')
    : cleanTitle(docs[0].article.title, docs[0].source?.name).slice(0, 60) || 'Related stories';

  const leanTypes = [...new Set(docs.map(d => d.source?.leanType).filter(Boolean))];
  const keywordCounts = {};
  for (const [term, entry] of shared.slice(0, 40)) keywordCounts[term] = entry.count;

  const newest = Math.max(...docs.map(d => d.time));
  const oldest = Math.min(...docs.map(d => d.time));
  const sources = docs.map(d => d.source).filter(Boolean);
  const meanScore = scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1);

  const id = `c${hash(docs.map(d => d.article.id).sort().join('|'))}`;

  // Majority desk, for UI filtering and for giving the analyser context.
  const topicTally = {};
  for (const doc of docs) {
    const topic = doc.article.topic || 'world';
    topicTally[topic] = (topicTally[topic] || 0) + 1;
  }
  const topic = Object.entries(topicTally).sort((a, b) => b[1] - a[1])[0][0];

  return {
    id,
    label,
    articles: docs.map(d => d.article),
    sources,
    leanTypes,
    keywordCounts,
    labelTerms: labelTerms.map(([term]) => term),
    articleCount: docs.length,
    topic,
    sourceCount: new Set(docs.map(d => d.article.sourceId)).size,
    newestDate: new Date(newest),
    oldestDate: new Date(oldest),
    // 0-1: how tightly the members actually match each other
    confidence: +Math.min(1, meanScore * 1.6).toFixed(2),
    perspectives: leanTypes.length,
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export const CLUSTER_DEFAULTS = DEFAULTS;
