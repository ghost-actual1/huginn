/**
 * HUGINN theme.
 * =====================================================================
 * Every colour the UI paints comes from here. Retheming this app means editing
 * this file and nothing else -- App.js and src/sources.js both read these
 * tokens, so a palette swap (dark→light, blue→amber, whatever) is one diff.
 *
 * Outlet brand colours (AP blue, BBC red) are NOT here: those identify a
 * publisher and live with the outlet in sources.js.
 */

export const C = {
  // Depths
  void: '#060a0d',
  abyss: '#0a1014',
  obsidian: '#0f171d',
  coal: '#162028',
  slate: '#1e2f3a',
  ash: '#2a4050',

  // Identity - cold intelligence blue
  raven: '#0ea5e9',     // Primary
  ravenDim: '#0284c7',
  ravenGlow: '#38bdf8',
  frost: '#67e8f9',
  ice: '#a5f3fc',

  // Semantic
  alive: '#22c55e',
  aliveDim: '#0a3d1f',
  dead: '#ef4444',
  deadDim: '#3d0a14',
  warning: '#f59e0b',
  neutral: '#7c8fa5',

  // Structural hairlines (borders/dividers); the only whites with alpha
  hairline: 'rgba(255,255,255,0.024)',
  hairlineStrong: 'rgba(255,255,255,0.031)',
  hairlineFaint: 'rgba(255,255,255,0.016)',

  // Text
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textGhost: '#475569',

  // Analysis (LLM) accents
  analysisPurple: '#c084fc',
  analysisPurpleDim: '#7c3aed',

  // Editorial lean colours
  leanWestern: '#3b82f6',
  leanState: '#ef4444',
  leanIndependent: '#22c55e',
  leanAnalysis: '#a78bfa',
  leanPanArab: '#f59e0b',
  leanGlobalSouth: '#f97316',
  leanOpposition: '#e879f9',
  leanRegional: '#2dd4bf',
};

/** leanType -> colour. Every `leanType` in sources.js must key this map. */
export const LEAN_COLORS = {
  western: C.leanWestern,
  state: C.leanState,
  independent: C.leanIndependent,
  analysis: C.leanAnalysis,
  panArab: C.leanPanArab,
  globalSouth: C.leanGlobalSouth,
  opposition: C.leanOpposition,
  regional: C.leanRegional,
};

/**
 * Desk accents, drawn only from the tokens above so the hero chips, desk dots
 * and cluster rail never introduce a hue the rest of the UI doesn't know.
 */
export const DESK_COLORS = {
  world: C.raven,
  business: C.leanPanArab,
  tech: C.leanAnalysis,
  science: C.frost,
  health: C.leanState,
  climate: C.leanIndependent,
  sports: C.leanRegional,
  culture: C.leanOpposition,
};
