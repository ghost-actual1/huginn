/**
 * HUGINN source registry.
 *
 * Every entry is one RSS/Atom endpoint. `topic` files the outlet under a desk
 * (world, business, tech, science, health, climate, sports, culture) and is
 * only a prior -- article-level topic detection re-files individual stories,
 * so a general wire like Reuters still surfaces tech pieces on the tech desk.
 *
 * `leanType` feeds the bias-tagging UI and the cross-perspective clustering
 * score. Values must exist in LEAN_COLORS.
 */

import { DESK_COLORS } from './theme.js';

export const TOPICS = [
  { id: 'world', label: 'World', color: DESK_COLORS.world },
  { id: 'business', label: 'Business', color: DESK_COLORS.business },
  { id: 'tech', label: 'Tech', color: DESK_COLORS.tech },
  { id: 'science', label: 'Science', color: DESK_COLORS.science },
  { id: 'health', label: 'Health', color: DESK_COLORS.health },
  { id: 'climate', label: 'Climate', color: DESK_COLORS.climate },
  { id: 'sports', label: 'Sports', color: DESK_COLORS.sports },
  { id: 'culture', label: 'Culture', color: DESK_COLORS.culture },
];

export const SOURCES = [
  // --------------------------------------------------------------- WORLD
  { id: 'ap', name: 'AP News', region: 'North America', country: 'US', lean: 'Western Wire', leanType: 'western', topic: 'world', rss: 'https://news.google.com/rss/search?q=site:apnews.com+when:24h&ceid=US:en&hl=en-US&gl=US', fallback: 'https://news.google.com/rss/search?q=site:apnews.com+when:48h&ceid=US:en&hl=en-US&gl=US', color: '#3b82f6', icon: 'AP' },
  { id: 'reuters', name: 'Reuters', region: 'Europe', country: 'UK', lean: 'Western Wire', leanType: 'western', topic: 'world', rss: 'https://news.google.com/rss/search?q=site:reuters.com+when:24h&ceid=US:en&hl=en-US&gl=US', fallback: 'https://openrss.org/reuters.com/world', color: '#ff6b35', icon: 'RE' },
  { id: 'bbc', name: 'BBC World', region: 'Europe', country: 'UK', lean: 'Western Public', leanType: 'western', topic: 'world', rss: 'https://feeds.bbci.co.uk/news/world/rss.xml', color: '#bb1919', icon: 'BB' },
  { id: 'aljazeera', name: 'Al Jazeera', region: 'Middle East', country: 'Qatar', lean: 'Pan-Arab', leanType: 'panArab', topic: 'world', rss: 'https://www.aljazeera.com/xml/rss/all.xml', color: '#d4a843', icon: 'AJ' },
  { id: 'presstv', name: 'Press TV', region: 'Middle East', country: 'Iran', lean: 'Iranian State', leanType: 'state', topic: 'world', rss: 'https://www.presstv.ir/rss.xml', fallback: 'https://openrss.org/presstv.ir', color: '#059669', icon: 'PT' },
  { id: 'anadolu', name: 'Anadolu Agency', region: 'Middle East', country: 'Turkey', lean: 'Turkish State', leanType: 'state', topic: 'world', rss: 'https://www.aa.com.tr/en/rss/default?cat=world', fallback: 'https://openrss.org/aa.com.tr/en', color: '#dc2626', icon: 'AA' },
  { id: '972mag', name: '+972 Magazine', region: 'Middle East', country: 'Palestine/Israel', lean: 'Independent Left', leanType: 'independent', topic: 'world', rss: 'https://www.972mag.com/feed/', color: '#8b5cf6', icon: '97' },
  { id: 'haaretz', name: 'Haaretz', region: 'Middle East', country: 'Israel', lean: 'Liberal Israeli', leanType: 'independent', topic: 'world', rss: 'https://www.haaretz.com/srv/haaretz-latest-headlines', fallback: 'https://openrss.org/haaretz.com', color: '#10b981', icon: 'HA' },
  { id: 'middleeasteye', name: 'Middle East Eye', region: 'Middle East', country: 'UK', lean: 'Regional Lens', leanType: 'regional', topic: 'world', rss: 'https://www.middleeasteye.net/rss', fallback: 'https://openrss.org/middleeasteye.net', color: '#06b6d4', icon: 'ME' },
  { id: 'thenational', name: 'The National', region: 'Middle East', country: 'UAE', lean: 'Gulf State', leanType: 'state', topic: 'world', rss: 'https://news.google.com/rss/search?q=site:thenationalnews.com+when:24h&ceid=US:en&hl=en-US&gl=US', fallback: 'https://news.google.com/rss/search?q=site:thenationalnews.com+when:48h&ceid=US:en&hl=en-US&gl=US', color: '#0284c7', icon: 'TN' },
  { id: 'rt', name: 'RT', region: 'Eurasia', country: 'Russia', lean: 'Russian State', leanType: 'state', topic: 'world', rss: 'https://www.rt.com/rss/news/', color: '#16a34a', icon: 'RT' },
  { id: 'tass', name: 'TASS', region: 'Eurasia', country: 'Russia', lean: 'Russian Wire', leanType: 'state', topic: 'world', rss: 'https://tass.com/rss/v2.xml', color: '#1d4ed8', icon: 'TA' },
  { id: 'meduza', name: 'Meduza', region: 'Eurasia', country: 'Latvia (exiled)', lean: 'Anti-Kremlin', leanType: 'opposition', topic: 'world', rss: 'https://meduza.io/rss/en/all', color: '#e879f9', icon: 'MZ' },
  { id: 'ukrpravda', name: 'Ukrainska Pravda', region: 'Eurasia', country: 'Ukraine', lean: 'Ukrainian', leanType: 'independent', topic: 'world', rss: 'https://www.pravda.com.ua/eng/rss/', fallback: 'https://openrss.org/pravda.com.ua/eng', color: '#fbbf24', icon: 'UP' },
  { id: 'interfax', name: 'Interfax', region: 'Eurasia', country: 'Russia', lean: 'Russian Wire', leanType: 'state', topic: 'world', rss: 'https://news.google.com/rss/search?q=site:interfax.com+when:48h&ceid=US:en&hl=en-US&gl=US', fallback: 'https://openrss.org/interfax.com', color: '#64748b', icon: 'IF' },
  { id: 'xinhua', name: 'Xinhua', region: 'East Asia', country: 'China', lean: 'Chinese State', leanType: 'state', topic: 'world', rss: 'http://www.xinhuanet.com/english/rss/worldrss.xml', fallback: 'https://openrss.org/english.news.cn', color: '#b91c1c', icon: 'XH' },
  { id: 'globaltimes', name: 'Global Times', region: 'East Asia', country: 'China', lean: 'Chinese Nationalist', leanType: 'state', topic: 'world', rss: 'https://www.globaltimes.cn/rss/outbrain.xml', fallback: 'https://news.google.com/rss/search?q=site:globaltimes.cn+when:48h&ceid=US:en&hl=en-US&gl=US', color: '#991b1b', icon: 'GT' },
  { id: 'scmp', name: 'South China Morning Post', region: 'East Asia', country: 'Hong Kong', lean: 'HK Moderate', leanType: 'independent', topic: 'world', rss: 'https://www.scmp.com/rss/91/feed', color: '#0ea5e9', icon: 'SC' },
  { id: 'nikkei', name: 'Nikkei Asia', region: 'East Asia', country: 'Japan', lean: 'Business Asia', leanType: 'independent', topic: 'world', rss: 'https://asia.nikkei.com/rss/feed/nar', fallback: 'https://news.google.com/rss/search?q=site:asia.nikkei.com+when:24h&ceid=US:en&hl=en-US&gl=US', color: '#38bdf8', icon: 'NK' },
  { id: 'yonhap', name: 'Yonhap News', region: 'East Asia', country: 'South Korea', lean: 'Korean Wire', leanType: 'globalSouth', topic: 'world', rss: 'https://en.yna.co.kr/RSS/news.xml', color: '#0369a1', icon: 'YN' },
  { id: 'diplomat', name: 'The Diplomat', region: 'East Asia', country: 'US/Asia', lean: 'Asia Analysis', leanType: 'regional', topic: 'world', rss: 'https://thediplomat.com/feed/', color: '#7c3aed', icon: 'TD' },
  { id: 'thehindu', name: 'The Hindu', region: 'South Asia', country: 'India', lean: 'Indian Balanced', leanType: 'independent', topic: 'world', rss: 'https://www.thehindu.com/news/international/feeder/default.rss', fallback: 'https://openrss.org/thehindu.com', color: '#1e40af', icon: 'TH' },
  { id: 'dawn', name: 'Dawn', region: 'South Asia', country: 'Pakistan', lean: 'Pakistani Elite', leanType: 'independent', topic: 'world', rss: 'https://www.dawn.com/feeds/home', fallback: 'https://www.dawn.com/feeds/world', color: '#059669', icon: 'DW' },
  { id: 'scroll', name: 'Scroll.in', region: 'South Asia', country: 'India', lean: 'Indian Independent', leanType: 'independent', topic: 'world', rss: 'https://feeds.feedburner.com/ScrollinArticles.rss', fallback: 'https://news.google.com/rss/search?q=site:scroll.in+when:24h&ceid=US:en&hl=en-US&gl=US', color: '#ea580c', icon: 'SL' },
  { id: 'wion', name: 'WION', region: 'South Asia', country: 'India', lean: 'Global South', leanType: 'globalSouth', topic: 'world', rss: 'https://news.google.com/rss/search?q=site:wionews.com+when:24h&ceid=US:en&hl=en-US&gl=US', fallback: 'https://openrss.org/wionews.com', color: '#f59e0b', icon: 'WI' },
  { id: 'dailymaverick', name: 'Daily Maverick', region: 'Africa', country: 'South Africa', lean: 'Investigative', leanType: 'independent', topic: 'world', rss: 'https://www.dailymaverick.co.za/dmrss/', color: '#4ade80', icon: 'DM' },
  { id: 'allafrica', name: 'AllAfrica', region: 'Africa', country: 'Pan-African', lean: 'Aggregator', leanType: 'regional', topic: 'world', rss: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', fallback: 'https://openrss.org/allafrica.com', color: '#15803d', icon: 'AA' },
  { id: 'premiumtimes', name: 'Premium Times', region: 'Africa', country: 'Nigeria', lean: 'Investigative', leanType: 'independent', topic: 'world', rss: 'https://www.premiumtimesng.com/feed', color: '#b45309', icon: 'PT' },
  { id: 'nationafrica', name: 'Nation Africa', region: 'Africa', country: 'Kenya', lean: 'East African', leanType: 'regional', topic: 'world', rss: 'https://nation.africa/kenya/rss.xml', fallback: 'https://news.google.com/rss/search?q=site:nation.africa+when:24h&ceid=US:en&hl=en-US&gl=US', color: '#16a34a', icon: 'NA' },
  { id: 'mailguardian', name: 'Mail & Guardian', region: 'Africa', country: 'South Africa', lean: 'Investigative', leanType: 'independent', topic: 'world', rss: 'https://mg.co.za/rss/', fallback: 'https://news.google.com/rss/search?q=site:mg.co.za+when:24h&ceid=US:en&hl=en-US&gl=US', color: '#65a30d', icon: 'MG' },
  { id: 'telesur', name: 'TeleSUR', region: 'Latin America', country: 'Venezuela', lean: 'Anti-Imperialist', leanType: 'state', topic: 'world', rss: 'https://www.telesurenglish.net/feed/', fallback: 'https://openrss.org/telesurenglish.net', color: '#22d3ee', icon: 'TS' },
  { id: 'folha', name: 'Folha de S.Paulo', region: 'Latin America', country: 'Brazil', lean: 'Brazilian Independent', leanType: 'independent', topic: 'world', rss: 'https://feeds.folha.uol.com.br/mundo/rss091.xml', fallback: 'https://openrss.org/folha.uol.com.br', color: '#0284c7', icon: 'FO' },
  { id: 'lanacion', name: 'La Nación', region: 'Latin America', country: 'Argentina', lean: 'Conservative', leanType: 'independent', topic: 'world', rss: 'https://www.lanacion.com.ar/arcio/rss/', fallback: 'https://openrss.org/lanacion.com.ar', color: '#1e3a5f', icon: 'LN' },
  { id: 'pagina12', name: 'Página/12', region: 'Latin America', country: 'Argentina', lean: 'Left', leanType: 'globalSouth', topic: 'world', rss: 'https://www.pagina12.com.ar/arc/outboundfeeds/rss/portada', fallback: 'https://www.pagina12.com.ar/rss/portada', color: '#dc2626', icon: 'P12' },
  { id: 'eluniversal', name: 'El Universal', region: 'Latin America', country: 'Mexico', lean: 'Mexican Mainstream', leanType: 'independent', topic: 'world', rss: 'https://www.eluniversal.com.mx/arc/outboundfeeds/rss/', fallback: 'https://news.google.com/rss/search?q=site:eluniversal.com.mx+when:48h&ceid=US:en&hl=en-US&gl=US', color: '#854d0e', icon: 'EU' },
  { id: 'bellingcat', name: 'Bellingcat', region: 'Global', country: 'Netherlands', lean: 'OSINT', leanType: 'analysis', topic: 'world', rss: 'https://www.bellingcat.com/feed/', color: '#a78bfa', icon: 'BC' },
  { id: 'grayzone', name: 'The Grayzone', region: 'Global', country: 'US', lean: 'Anti-Interventionist', leanType: 'analysis', topic: 'world', rss: 'https://thegrayzone.com/feed/', color: '#6b7280', icon: 'GZ' },
  // --------------------------------------------------------------- TECH
  { id: 'arstechnica', name: 'Ars Technica', region: 'North America', country: 'US', lean: 'Tech Trade', leanType: 'independent', topic: 'tech', rss: 'https://feeds.arstechnica.com/arstechnica/index', color: '#f97316', icon: 'ARS' },
  { id: 'register', name: 'The Register', region: 'Europe', country: 'UK', lean: 'Snarky Trade', leanType: 'independent', topic: 'tech', rss: 'https://www.theregister.com/headlines.atom', color: '#84cc16', icon: 'REG' },
  { id: 'restofworld', name: 'Rest of World', region: 'Global', country: 'US', lean: 'Global Tech', leanType: 'globalSouth', topic: 'tech', rss: 'https://restofworld.org/feed/latest/', color: '#14b8a6', icon: 'RoW' },
  { id: 'techcabal', name: 'TechCabal', region: 'Africa', country: 'Nigeria', lean: 'African Tech', leanType: 'globalSouth', topic: 'tech', rss: 'https://techcabal.com/feed/', color: '#22c55e', icon: 'TCL' },
  { id: 'wired', name: 'WIRED', region: 'North America', country: 'US', lean: 'Tech Culture', leanType: 'independent', topic: 'tech', rss: 'https://www.wired.com/feed/rss', color: '#e879f9', icon: 'WRD' },
  // --------------------------------------------------------------- SCIENCE
  { id: 'nature', name: 'Nature', region: 'Global', country: 'UK', lean: 'Peer Review', leanType: 'analysis', topic: 'science', rss: 'https://www.nature.com/nature.rss', color: '#0ea5e9', icon: 'NAT' },
  { id: 'sciencedaily', name: 'ScienceDaily', region: 'Global', country: 'US', lean: 'Aggregator', leanType: 'analysis', topic: 'science', rss: 'https://www.sciencedaily.com/rss/top/science.xml', color: '#6366f1', icon: 'SD' },
  { id: 'physorg', name: 'Phys.org', region: 'Global', country: 'US', lean: 'Aggregator', leanType: 'analysis', topic: 'science', rss: 'https://phys.org/rss-feed/', color: '#8b5cf6', icon: 'PHY' },
  { id: 'quanta', name: 'Quanta Magazine', region: 'North America', country: 'US', lean: 'Longform Science', leanType: 'analysis', topic: 'science', rss: 'https://www.quantamagazine.org/feed/', color: '#06b6d4', icon: 'QNT' },
  // --------------------------------------------------------------- HEALTH
  { id: 'stat', name: 'STAT News', region: 'North America', country: 'US', lean: 'Health Trade', leanType: 'independent', topic: 'health', rss: 'https://www.statnews.com/feed/', color: '#ef4444', icon: 'STAT' },
  { id: 'medicalxpress', name: 'Medical Xpress', region: 'Global', country: 'US', lean: 'Aggregator', leanType: 'analysis', topic: 'health', rss: 'https://medicalxpress.com/rss-feed/', color: '#f43f5e', icon: 'MX' },
  { id: 'who', name: 'WHO Newsroom', region: 'Global', country: 'Switzerland', lean: 'Multilateral', leanType: 'state', topic: 'health', rss: 'https://www.who.int/rss-feeds/news-english.xml', color: '#0d9488', icon: 'WHO' },
  // --------------------------------------------------------------- CLIMATE
  { id: 'carbonbrief', name: 'Carbon Brief', region: 'Europe', country: 'UK', lean: 'Climate Analysis', leanType: 'analysis', topic: 'climate', rss: 'https://www.carbonbrief.org/feed', color: '#65a30d', icon: 'CB' },
  { id: 'insideclimate', name: 'Inside Climate News', region: 'North America', country: 'US', lean: 'Climate Investigative', leanType: 'independent', topic: 'climate', rss: 'https://insideclimatenews.org/feed/', color: '#16a34a', icon: 'ICN' },
  { id: 'climatehomenews', name: 'Climate Home News', region: 'Europe', country: 'UK', lean: 'Climate Policy', leanType: 'independent', topic: 'climate', rss: 'https://www.climatechangenews.com/feed/', color: '#4d7c0f', icon: 'CHN' },
  // --------------------------------------------------------------- BUSINESS
  { id: 'cnbc', name: 'CNBC', region: 'North America', country: 'US', lean: 'Market Mainstream', leanType: 'western', topic: 'business', rss: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', color: '#3b82f6', icon: 'CNBC' },
  { id: 'marketwatch', name: 'MarketWatch', region: 'North America', country: 'US', lean: 'Market Mainstream', leanType: 'western', topic: 'business', rss: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', color: '#2563eb', icon: 'MW' },
  { id: 'livemint', name: 'Mint', region: 'South Asia', country: 'India', lean: 'Indian Business', leanType: 'globalSouth', topic: 'business', rss: 'https://www.livemint.com/rss/markets', color: '#f59e0b', icon: 'MINT' },
  { id: 'ft', name: 'Financial Times', region: 'Europe', country: 'UK', lean: 'Business Elite', leanType: 'western', topic: 'business', rss: 'https://www.ft.com/rss/home', color: '#fca5a5', icon: 'FT' },
  // --------------------------------------------------------------- SPORTS
  { id: 'bbc_sport', name: 'BBC Sport', region: 'Europe', country: 'UK', lean: 'Western Public', leanType: 'western', topic: 'sports', rss: 'https://feeds.bbci.co.uk/sport/rss.xml', color: '#bbf7d0', icon: 'BBCS' },
  { id: 'espn', name: 'ESPN', region: 'North America', country: 'US', lean: 'Sports Mainstream', leanType: 'western', topic: 'sports', rss: 'https://www.espn.com/espn/rss/news', color: '#dc2626', icon: 'ESPN' },
  { id: 'guardian_sport', name: 'Guardian Sport', region: 'Europe', country: 'UK', lean: 'Liberal Sport', leanType: 'independent', topic: 'sports', rss: 'https://www.theguardian.com/uk/sport/rss', color: '#052e16', icon: 'GS' },
  // --------------------------------------------------------------- CULTURE
  { id: 'guardian_culture', name: 'Guardian Culture', region: 'Europe', country: 'UK', lean: 'Liberal Culture', leanType: 'independent', topic: 'culture', rss: 'https://www.theguardian.com/culture/rss', color: '#a855f7', icon: 'GC' },
  { id: 'hyperallergic', name: 'Hyperallergic', region: 'North America', country: 'US', lean: 'Art Criticism', leanType: 'independent', topic: 'culture', rss: 'https://hyperallergic.com/feed/', color: '#c084fc', icon: 'HA' },
  { id: 'pitchfork', name: 'Pitchfork', region: 'North America', country: 'US', lean: 'Music Criticism', leanType: 'independent', topic: 'culture', rss: 'https://pitchfork.com/feed/feed-news/rss', color: '#7c3aed', icon: 'PF' },
  // --------------------------------------------------------------- WORLD
  { id: 'guardian_world', name: 'Guardian World', region: 'Europe', country: 'UK', lean: 'Liberal Western', leanType: 'independent', topic: 'world', rss: 'https://www.theguardian.com/world/rss', color: '#1d4ed8', icon: 'GW' },
  { id: 'dw', name: 'Deutsche Welle', region: 'Europe', country: 'Germany', lean: 'German Public', leanType: 'western', topic: 'world', rss: 'https://rss.dw.com/rdf/rss-en-world', color: '#0e7490', icon: 'DW' },
  { id: 'france24', name: 'France 24', region: 'Europe', country: 'France', lean: 'French Public', leanType: 'western', topic: 'world', rss: 'https://www.france24.com/en/rss', color: '#1e40af', icon: 'F24' },
  { id: 'lemonde', name: 'Le Monde', region: 'Europe', country: 'France', lean: 'French Mainstream', leanType: 'western', topic: 'world', rss: 'https://www.lemonde.fr/international/rss_full.xml', color: '#374151', icon: 'LM' },
  { id: 'straitstimes', name: 'The Straits Times', region: 'East Asia', country: 'Singapore', lean: 'Singapore Mainstream', leanType: 'regional', topic: 'world', rss: 'https://www.straitstimes.com/news/world/rss.xml', color: '#0891b2', icon: 'ST' },
];

export const REGIONS = [...new Set(SOURCES.map(s => s.region))];

export const getSource = (id) => SOURCES.find(s => s.id === id);
