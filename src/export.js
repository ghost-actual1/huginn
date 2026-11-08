/**
 * Optional cluster export.
 * =====================================================================
 * After each refresh, POST the current clusters (plus any analyses) to a
 * pipeline consumer: POST a cluster/analysis document to a JSON endpoint. The
 * default path matches a local agent stack's intel pipeline; point it anywhere.
 *
 * It is fire-and-forget: no backend, no endpoint, offline device -- the app
 * carries on, and nothing here is required for the reader to work.
 */

const INGEST_PATH = '/huginn/clusters/ingest';

export async function exportClusters({
  articles,
  enabledSources,
  analysisCache,
  backendUrl,
  clusterFn,
  getSourceFn,
  appVersion = '3.0',
}) {
  if (!backendUrl) return { exported: false, reason: 'no backend' };

  try {
    const visible = articles.filter(a => enabledSources.has(a.sourceId));
    const clusters = clusterFn(visible, getSourceFn).clusters || [];
    if (clusters.length === 0) return { exported: false, reason: 'no clusters' };

    const payload = {
      exported_at: new Date().toISOString(),
      app_version: appVersion,
      cluster_count: clusters.length,
      clusters: clusters.map(cluster => ({
        id: cluster.id,
        label: cluster.label || 'Unlabeled',
        topic: cluster.topic || 'world',
        article_count: cluster.articleCount,
        source_count: cluster.sourceCount,
        confidence: cluster.confidence,
        editorial_leans: cluster.leanTypes || [],
        sources: (cluster.sources || []).map(s => ({
          name: s?.name || '?',
          region: s?.region || '',
          lean: s?.leanType || '',
        })),
        headlines: cluster.articles.slice(0, 5).map(a => ({
          title: a.title || '',
          source: getSourceFn ? (getSourceFn(a.sourceId)?.name || '') : '',
          url: a.link || '',
          published: a.pubDate ? a.pubDate.toISOString() : '',
          lean: getSourceFn ? (getSourceFn(a.sourceId)?.leanType || '') : '',
        })),
        keywords: Object.keys(cluster.keywordCounts || {}),
        created_at: cluster.newestDate ? cluster.newestDate.toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      analyses: Object.entries(analysisCache || {}).map(([clusterId, result]) => {
        const cluster = clusters.find(c => c.id === clusterId);
        return {
          cluster_id: clusterId,
          cluster_label: cluster?.label || clusterId,
          text: result?.text || '',
          backend: result?.backend || '',
          at: (result?.timestamp instanceof Date ? result.timestamp : new Date()).toISOString(),
        };
      }).filter(a => a.text),
    };

    // AbortController, not AbortSignal.timeout(): the latter is missing on
    // some Hermes builds and would throw before the request is even made.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let res;
    try {
      res = await fetch(`${backendUrl.replace(/\/$/, '')}${INGEST_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return { exported: false, reason: `HTTP ${res.status}` };
    return { exported: true, clusters: clusters.length };
  } catch (err) {
    // Never let an optional pipeline hook break the reader.
    return { exported: false, reason: err.message };
  }
}
