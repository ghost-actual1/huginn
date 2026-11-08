/**
 * Cluster engine evaluation harness.
 * =====================================================================
 * Runs the real clustering engine (and the legacy 2-shared-keywords rule) over
 * a fixture of live headlines, so threshold changes are measured instead of
 * guessed.
 *
 *   node --experimental-default-type=module scripts/cluster-eval.mjs [fixture.json]
 *
 * The fixture is a JSON array of { sourceId, title, description }. Generate one
 * with scripts/fetch-fixture.py, or point it at any dump of real headlines.
 */

import { readFileSync } from 'node:fs';
import { clusterArticles, tokenize, stem, cleanTitle } from '../src/cluster.js';
import { getSource } from '../src/sources.js';

const fixturePath = process.argv[2] || 'fixtures/headlines.json';
const raw = JSON.parse(readFileSync(fixturePath, 'utf8'));

const now = Date.now();
const articles = raw.map((item, i) => ({
  id: `${item.sourceId}-${i}`,
  sourceId: item.sourceId,
  title: item.title,
  description: item.description || '',
  // spread publication times over 12h so the time window is exercised
  pubDate: new Date(now - (i % 40) * 18 * 60 * 1000),
}));

// ---------------------------------------------------------------------------
// Legacy algorithm (verbatim from App.js v2.2), for comparison
// ---------------------------------------------------------------------------
const LEGACY_STOP = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'that', 'this', 'these', 'those', 'it', 'its', 'he', 'she', 'they', 'we', 'you', 'his', 'her', 'their', 'our', 'my', 'your', 'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'also', 'very', 'just', 'over', 'after', 'before', 'between', 'under', 'again', 'further', 'about', 'up', 'out', 'off', 'down', 'with', 'from', 'by', 'as', 'into', 'through', 'during', 'here', 'there', 'new', 'says', 'said', 'news', 'report', 'reports', 'according', 'amid', 'us', 'uk', 'can', 'get', 'set', 'make', 'like', 'still', 'back', 'even', 'well', 'way', 'many']);

function legacyKeywords(title) {
  return title.toLowerCase()
    .replace(/['"\-:;,.()[\]{}!?/\\|@#$%^&*+=<>~`]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !LEGACY_STOP.has(w));
}

function legacyCluster(articles) {
  const data = articles.map(a => ({ article: a, keywords: new Set(legacyKeywords(a.title)), source: getSource(a.sourceId) }));
  const clustered = new Set();
  const clusters = [];
  for (let i = 0; i < data.length; i++) {
    if (clustered.has(i) || data[i].keywords.size < 2) continue;
    const cluster = [data[i]]; clustered.add(i);
    for (let j = i + 1; j < data.length; j++) {
      if (clustered.has(j)) continue;
      if (Math.abs(data[i].article.pubDate - data[j].article.pubDate) > 48 * 3600 * 1000) continue;
      if (data[i].article.sourceId === data[j].article.sourceId) continue;
      let shared = 0;
      for (const kw of data[j].keywords) if (data[i].keywords.has(kw)) shared++;
      if (shared >= 2) { cluster.push(data[j]); clustered.add(j); }
    }
    if (cluster.length >= 2) {
      const keywordCounts = {};
      cluster.forEach(c => c.keywords.forEach(kw => { keywordCounts[kw] = (keywordCounts[kw] || 0) + 1; }));
      const top = Object.entries(keywordCounts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([kw]) => kw);
      clusters.push({
        label: top.join(' · ') || 'Related Stories',
        articles: cluster.map(c => c.article),
        sourceCount: new Set(cluster.map(c => c.article.sourceId)).size,
      });
    }
  }
  return clusters;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const pad = (v, n) => String(v).padEnd(n);

console.log(`fixture: ${fixturePath}  (${articles.length} articles, ${new Set(articles.map(a => a.sourceId)).size} sources)\n`);

const legacy = legacyCluster(articles);
const legacyCovered = legacy.reduce((s, c) => s + c.articles.length, 0);
console.log('LEGACY (2 shared raw keywords, seed-anchored)');
console.log(`  clusters ${legacy.length} | articles in clusters ${legacyCovered}/${articles.length}`
  + ` | mean sources ${legacy.length ? (legacyCovered / legacy.length).toFixed(2) : 0}`);
for (const c of legacy.slice(0, 12)) console.log(`   [${c.sourceCount}src] ${c.label}`);
if (legacy.length > 12) console.log(`   ... ${legacy.length - 12} more`);

console.log('\nNEW ENGINE');

const thresholds = process.argv.slice(3).map(Number).filter(Boolean);
const grid = thresholds.length ? thresholds : [0.22, 0.26, 0.30, 0.34, 0.38];

for (const threshold of grid) {
  const { clusters, unclustered, stats } = clusterArticles(articles, getSource, { threshold });
  const covered = clusters.reduce((s, c) => s + c.articleCount, 0);
  console.log(`  T=${threshold.toFixed(2)} clusters ${pad(stats.clusterCount, 4)}`
    + ` covered ${pad(covered, 4)}/${articles.length}`
    + ` multi-perspective ${clusters.filter(c => c.perspectives >= 2).length}`
    + ` mean src ${stats.meanSources}`
    + ` pairs ${stats.pairs} links ${stats.links}`);
}

// Detail dump at the calibrated threshold
const chosen = Number(process.env.HUGINN_T || 0.28);
const { clusters, unclustered } = clusterArticles(articles, getSource, { threshold: chosen });
console.log(`\nCLUSTERS @ T=${chosen}  (${clusters.length} clusters, ${unclustered} unclustered)`);
for (const c of clusters) {
  console.log(`\n  ${c.label}   [${c.articleCount} art / ${c.sourceCount} src / conf ${c.confidence}]`);
  for (const a of c.articles) console.log(`     - ${getSource(a.sourceId)?.name || a.sourceId}: ${a.title.slice(0, 96)}`);
}

// Unit-ish assertions on the tokenizer
const checks = [
  [tokenize('Iran kills two in strikes on Israel').join(' '), 'iran kill strike israel'],
  [cleanTitle('Something big happened - The Hindu', 'The Hindu'), 'Something big happened'],
];
for (const [got, want] of checks) {
  if (got !== want) console.log(`\nWARN tokenizer: got "${got}" want "${want}"`);
}
console.log(`\nstem check: ${['kills', 'killed', 'killing', 'polls', 'police'].map(w => `${w}->${stem(w)}`).join(' ')}`);
