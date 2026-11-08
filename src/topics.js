/**
 * Article topic detection.
 * =====================================================================
 * A source's `topic` is a prior, not a verdict: AP covers chip export bans,
 * Reuters covers a central-bank decision. Classify each article from its own
 * words so the desks stay honest when a general wire wanders into them.
 *
 * Score = 2 per title hit + 1 per description hit + 1.4 for the source's own
 * desk. Ties fall back to 'world'.
 */

import { TOPICS } from './sources.js';

const WORDS = {
  business: ['market', 'markets', 'stocks', 'stock', 'shares', 'earnings', 'revenue', 'profit', 'profits',
    'economy', 'economic', 'inflation', 'deflation', 'gdp', 'trade', 'tariff', 'tariffs', 'ipo',
    'merger', 'acquisition', 'bank', 'banks', 'banking', 'bond', 'bonds', 'yields', 'currency',
    'investor', 'investors', 'quarterly', 'ceo', 'layoffs', 'retail', 'sales', 'central bank',
    'fiscal', 'deficit', 'tax', 'taxes', 'taxation', 'commodity', 'commodities', 'exports', 'imports',
    'selloff', 'rally', 'valuation', 'funding', 'venture', 'dividend', 'credit rating', 'debt',
    'unemployment', 'jobs report', 'payrolls', 'subsidy', 'subsidies', 'antitrust', 'monopoly'],
  tech: ['ai', 'artificial intelligence', 'chatgpt', 'openai', 'anthropic', 'gemini', 'llm', 'model',
    'models', 'algorithm', 'algorithms', 'chip', 'chips', 'semiconductor', 'semiconductors', 'nvidia',
    'tsmc', 'google', 'apple', 'microsoft', 'meta', 'amazon', 'tesla', 'software', 'app', 'apps',
    'startup', 'startups', 'cybersecurity', 'cyber', 'hacker', 'hackers', 'hacked', 'breach',
    'privacy', 'robot', 'robots', 'robotics', 'smartphone', 'iphone', 'android', 'cloud',
    'crypto', 'bitcoin', 'ethereum', 'blockchain', 'social media', 'platform', 'streaming',
    'browser', 'linux', 'gpu', 'datacenter', 'data center', 'quantum computing', 'deepfake',
    'open source', 'encryption', 'surveillance', 'tiktok', 'youtube', 'x.com', 'database'],
  science: ['study', 'studies', 'researchers', 'research', 'scientists', 'scientist', 'discovery',
    'astronomers', 'astronomy', 'telescope', 'space', 'nasa', 'esa', 'spacecraft', 'rocket',
    'satellite', 'satellites', 'physics', 'particle', 'dna', 'gene', 'genes', 'genome', 'fossil',
    'dinosaur', 'laboratory', 'experiment', 'experiments', 'journal', 'neuroscience', 'brain',
    'mars', 'moon', 'asteroid', 'exoplanet', 'biology', 'chemistry', 'mathematics', 'cosmos',
    'galaxy', 'supernova', 'nobel', 'archaeology', 'archaeologists', 'fossils', 'microbe'],
  health: ['health', 'disease', 'diseases', 'virus', 'outbreak', 'infection', 'infections', 'vaccine',
    'vaccines', 'vaccination', 'hospital', 'hospitals', 'patients', 'patient', 'doctors', 'doctor',
    'medical', 'medicine', 'cancer', 'diabetes', 'obesity', 'mental health', 'drug', 'drugs',
    'fda', 'pandemic', 'epidemic', 'measles', 'influenza', 'flu', 'mortality', 'surgery', 'clinical',
    'clinical trial', 'clinical trials', 'birth rate', 'life expectancy', 'antibiotic',
    'antibiotics', 'nurse', 'hospitalised', 'hospitalized'],
  climate: ['climate', 'warming', 'emissions', 'carbon', 'co2', 'greenhouse', 'methane', 'drought',
    'flood', 'floods', 'flooding', 'wildfire', 'wildfires', 'heatwave', 'heat wave', 'hurricane',
    'typhoon', 'cyclone', 'glacier', 'glaciers', 'arctic', 'antarctic', 'biodiversity', 'extinction',
    'renewable', 'renewables', 'solar', 'wind farm', 'fossil fuel', 'fossil fuels', 'coal',
    'cop30', 'cop29', 'net zero', 'monsoon', 'sea level', 'deforestation', 'pollution', 'ecosystem'],
  sports: ['match', 'matches', 'coach', 'coaches', 'league', 'cup', 'tournament', 'championship',
    'goal', 'goals', 'defeat', 'beat', 'player', 'players', 'team', 'teams', 'stadium', 'olympics',
    'olympic', 'fifa', 'uefa', 'nba', 'nfl', 'cricket', 'tennis', 'football', 'soccer', 'basketball',
    'boxing', 'formula 1', 'medal', 'medals', 'transfer', 'playoffs', 'quarterfinal', 'semifinal',
    'world cup', 'athlete', 'athletes', 'innings', 'wicket', 'touchdown', 'referee', 'f1'],
  culture: ['film', 'films', 'movie', 'movies', 'album', 'music', 'singer', 'band', 'actor', 'actors',
    'actress', 'director', 'art', 'artist', 'artists', 'museum', 'gallery', 'book', 'books', 'novel',
    'author', 'theatre', 'theater', 'fashion', 'celebrity', 'oscar', 'oscars', 'grammy',
    'emmy', 'exhibition', 'sculpture', 'poetry', 'opera', 'premiere', 'box office', 'streaming series',
    'podcast', 'documentary', 'novelist', 'photography', 'film festival', 'music festival',
    'art exhibition', 'book prize', 'literary prize'],
  world: ['war', 'conflict', 'military', 'troops', 'army', 'strike', 'strikes', 'ceasefire', 'peace',
    'talks', 'summit', 'sanctions', 'election', 'elections', 'vote', 'parliament', 'president',
    'prime minister', 'minister', 'government', 'diplomat', 'diplomacy', 'border', 'refugees',
    'migrants', 'protest', 'protests', 'coup', 'terror', 'attack', 'bombing', 'missile', 'drone',
    'security', 'nato', 'united nations', 'treaty', 'embassy', 'foreign minister', 'insurgents'],
};

// Multi-word entries match on the joined phrase; single words on whole tokens.
const PHRASES = new Map();
const SINGLES = new Map();
for (const [topic, words] of Object.entries(WORDS)) {
  for (const word of words) {
    const target = word.includes(' ') ? PHRASES : SINGLES;
    if (!target.has(word)) target.set(word, topic);
  }
}

const SOURCE_PRIOR = 1.4;

function scoreText(text, weight, scores) {
  if (!text) return;
  const lower = ` ${String(text).toLowerCase().replace(/[^a-z0-9.\s]/g, ' ').replace(/\s+/g, ' ')} `;
  for (const [word, topic] of SINGLES) {
    if (lower.includes(` ${word} `)) scores[topic] += weight;
  }
  for (const [phrase, topic] of PHRASES) {
    if (lower.includes(` ${phrase} `)) scores[topic] += weight * 1.25;
  }
}

/**
 * @returns {{topic: string, scores: Object, confidence: number}}
 */
export function classifyTopic(article, source = null) {
  const scores = {};
  for (const t of TOPICS) scores[t.id] = 0;

  scoreText(article?.title, 2, scores);
  scoreText(String(article?.description || '').slice(0, 300), 1, scores);

  const priors = source?.topic ? [source.topic] : [];
  // A topical feed (Nature, ESPN) is nearly always right about itself; a
  // general wire is not, so only topical sources get a prior.
  if (source?.topic && source.topic !== 'world') {
    for (const t of priors) scores[t] += SOURCE_PRIOR;
  }

  let best = 'world';
  let bestScore = 0;
  let total = 0;
  for (const [topic, score] of Object.entries(scores)) {
    total += score;
    if (score > bestScore) { best = topic; bestScore = score; }
  }

  return {
    topic: bestScore > 0 ? best : 'world',
    scores,
    confidence: total > 0 ? +(bestScore / total).toFixed(2) : 0,
  };
}

export const TOPIC_IDS = TOPICS.map(t => t.id);
