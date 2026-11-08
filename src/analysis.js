/**
 * Optional analysis backend.
 * =====================================================================
 * HUGINN works fully offline: RSS in, clusters out, no server. The ANALYZE
 * button on a story cluster is the one feature that needs an LLM, and it can
 * talk to either
 *
 *   generate - a /generate JSON endpoint (prompt in, text out) of the shape
 *              llama.cpp shims and local agent stacks expose
 *   openai   - any OpenAI-compatible /v1/chat/completions endpoint
 *              (llama.cpp server, Ollama, vLLM, LM Studio, OpenAI itself)
 *
 * Nothing here is required for the feed, the clustering, or the export.
 * No endpoint is baked in: the default comes from EXPO_PUBLIC_HUGINN_BACKEND_URL
 * at bundle time and is empty when unset.
 */

const LABEL_OVERRIDE = process.env.EXPO_PUBLIC_HUGINN_BACKEND_LABEL || '';

export const BACKENDS = [
  { id: 'generate', label: LABEL_OVERRIDE || 'Custom /generate', hint: 'http://host:5005' },
  { id: 'openai', label: 'OpenAI-compatible', hint: 'http://host:8080/v1' },
];

/** House style: analyst brief, no preamble, sections in a stable order. */
export function buildAnalystPrompt(topicLabel = 'world') {
  return `You are a ${topicLabel} desk analyst. You are given several articles from
different outlets covering what appears to be the same story.

INSTRUCTIONS:
- Compare how each outlet frames the story
- Identify what each emphasizes or omits
- Flag contradictions between accounts (numbers, attribution, causality)
- Note what each outlet's incentive is: state media, wire service, independent,
  business press, partisan outlet, trade publication
- Synthesize the most likely ground truth from all accounts
- Be direct, no filler

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

## NARRATIVE FRAMING
How each outlet frames the story differently.

## EMPHASIS & OMISSIONS
What each highlights vs what each leaves out.

## CONTRADICTIONS
Direct conflicts between accounts.

## INCENTIVES
Why each outlet frames it the way it does, given who owns and funds it.

## GROUND TRUTH SYNTHESIS
Best assessment of what actually happened, synthesized from all accounts.

Keep it tight. No preamble, no "certainly", no restating the question.`;
}

export function buildPrompt(cluster, getSource) {
  const sourceBreakdown = cluster.articles.map(article => {
    const source = getSource(article.sourceId);
    if (!source) return '';
    return `[${source.name} | ${source.lean} | ${source.country}]\nTitle: ${article.title}\n${article.description ? `Summary: ${article.description}` : '(no summary)'}`;
  }).filter(Boolean).join('\n\n');

  return `Analyze this story cluster. ${cluster.articles.length} outlets from ${cluster.leanTypes.length} perspective types are covering it.

STORY: ${cluster.label}

ARTICLES:
${sourceBreakdown}

Provide your analysis.`;
}

/**
 * @param {Object} cluster   - cluster from clusterArticles()
 * @param {Object} settings  - { backend, url, model, topicLabel }
 * @param {Function} getSource
 * @returns {Promise<{text, tokens, ms, backend}>}
 */
export async function analyzeCluster(cluster, settings, getSource) {
  const { backend = 'generate', url, model = 'local-model', topicLabel = 'news' } = settings || {};
  if (!url) throw new Error('No analysis backend configured. Set a URL in Config.');

  const prompt = buildPrompt(cluster, getSource);
  const systemPrompt = buildAnalystPrompt(topicLabel);
  const started = Date.now();

  if (backend === 'openai') {
    const endpoint = /\/v1\/?$/.test(url) ? `${url.replace(/\/$/, '')}/chat/completions` : url;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
        temperature: 0.4,
        top_p: 0.9,
      }),
    });
    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Backend returned ${response.status}: ${err.slice(0, 200)}`);
    }
    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      tokens: data.usage?.completion_tokens || 0,
      ms: Date.now() - started,
      backend,
      timestamp: new Date(),
    };
  }

  // Custom /generate
  const response = await fetch(`${url.replace(/\/$/, '')}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      system_prompt: systemPrompt,
      max_tokens: 4096,
      temperature: 0.4,
      top_p: 0.9,
      top_k: 30,
      session_id: null,   // stateless: don't write into the daemon's memory
      stream: false,
      thinking: true,
      voice: false,
    }),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Backend returned ${response.status}: ${err.slice(0, 200)}`);
  }
  const data = await response.json();

  // Best-effort KV clear on the engine port so analyses don't stack.
  try {
    const engineUrl = (settings.engineUrl || url).replace(/:\d+$/, ':5007');
    fetch(`${engineUrl}/slots/0`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'erase' }),
    }).catch(() => {});
  } catch { /* optional */ }

  return {
    text: data.response || data.text || '',
    tokens: data.tokens_generated || 0,
    ms: Date.now() - started,
    backend,
    timestamp: new Date(),
  };
}

export async function checkBackend(settings) {
  const { backend = 'generate', url } = settings || {};
  if (!url) throw new Error('No URL configured');
  const healthUrl = backend === 'openai'
    ? (/\/v1\/?$/.test(url) ? `${url.replace(/\/$/, '')}/models` : url)
    : `${url.replace(/\/$/, '')}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(healthUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${healthUrl}`);
    return true;
  } finally {
    clearTimeout(timer);
  }
}
