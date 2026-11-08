/**
 * HUGINN - multi-source news reader
 * ========================================
 * The raven that flies across Midgard each day, returning with knowledge from
 * all corners of the world.
 *
 * A self-contained RSS/Atom reader. It fetches ~60 outlets directly from the
 * device -- no aggregator API, no account, no server -- tags each story with
 * its editorial perspective, and groups articles that cover the same event so
 * you can read one story across many tellings instead of one telling of many
 * stories.
 *
 * Optional: an LLM endpoint for per-story analysis (see src/analysis.js).
 * Everything else works with no backend at all.
 *
 * Layout:
 *   src/sources.js   outlet registry (feed URL, desk, region, editorial lean)
 *   src/rss.js       RSS 2.0 / Atom parsing
 *   src/cluster.js   story clustering (TF-IDF, entity-aware, cross-perspective)
 *   src/topics.js    article -> desk classification
 *   src/analysis.js  optional analysis backend (/generate or OpenAI-compatible)
 *   App.js           UI
 *
 * Screens: Feed (timeline / stories), Sources, Desks, Config.
 * Stack: Expo + React Native.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Alert,
  StatusBar,
  Vibration,
  ActivityIndicator,
  Linking,
  Platform,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportClusters } from './src/export';
import { SOURCES, REGIONS, TOPICS, getSource } from './src/sources';
import { clusterArticles } from './src/cluster';
import { classifyTopic } from './src/topics';
import { C, LEAN_COLORS } from './src/theme';
import { parseRSS } from './src/rss';
import { analyzeCluster, checkBackend, BACKENDS } from './src/analysis';

// ============================================================================
// CONFIG
// ============================================================================

const REFRESH_INTERVAL = 300000; // 5 min auto-refresh

// Optional analysis backend. Defaults are inlined at BUNDLE time from
// EXPO_PUBLIC_HUGINN_* (see .env.example). Unset -- which is what a clean clone
// and any published build looks like -- the app ships with no endpoint at all.
const DEFAULT_SETTINGS = {
  backend: process.env.EXPO_PUBLIC_HUGINN_BACKEND || 'generate',
  url: process.env.EXPO_PUBLIC_HUGINN_BACKEND_URL || '',
  model: process.env.EXPO_PUBLIC_HUGINN_MODEL || 'local-model',
};

// Source registry (feeds, desks, regions, editorial leans) lives in ./src/sources.js


// ============================================================================
// ICONS
// ============================================================================

const HuginnLogo = ({ size = 48, color = C.raven }) => {
  const w = size * (223 / 250);
  const h = size;
  return (
    <Svg width={w} height={h} viewBox="0 0 223 250">
      <Path fill={color} opacity={0.95} d="M0 0 C5.29363516 2.55402431 7.41047738 5.96106589 9.40625 11.3984375 C9.59058594 11.99011719 9.77492188 12.58179687 9.96484375 13.19140625 C9.30484375 13.19140625 8.64484375 13.19140625 7.96484375 13.19140625 C8.34176655 17.56569455 8.7831584 21.60597569 10.08984375 25.81640625 C11.92820311 32.90722092 9.05093191 39.12019754 6.40234375 45.62890625 C6.07298828 46.45583984 5.74363281 47.28277344 5.40429688 48.13476562 C4.59798539 50.15638718 3.78236252 52.17429074 2.96484375 54.19140625 C2.63484375 53.53140625 2.30484375 52.87140625 1.96484375 52.19140625 C1.51753906 52.54074219 1.07023437 52.89007813 0.609375 53.25 C-0.29748047 53.93255859 -0.29748047 53.93255859 -1.22265625 54.62890625 C-1.81433594 55.08136719 -2.40601562 55.53382812 -3.015625 56 C-5.35536257 57.3803094 -7.38001421 57.67501569 -10.03515625 58.19140625 C-12.40572272 59.31963923 -12.40572272 59.31963923 -14.66015625 60.69140625 C-17.16809959 62.16364602 -19.26017273 63.26641174 -22.03515625 64.19140625 C-21.60203125 64.81789063 -21.16890625 65.444375 -20.72265625 66.08984375 C-20.16578125 66.90710938 -19.60890625 67.724375 -19.03515625 68.56640625 C-18.47828125 69.37851563 -17.92140625 70.190625 -17.34765625 71.02734375 C-16.03515625 73.19140625 -16.03515625 73.19140625 -16.03515625 75.19140625 C-15.40351562 75.18238281 -14.771875 75.17335938 -14.12109375 75.1640625 C-3.73935267 75.50812597 5.80288717 79.87620024 13.46484375 86.87890625 C19.98865677 94.11823425 23.6414712 102.49022988 23.96484375 112.19140625 C22.47984375 112.68640625 22.47984375 112.68640625 20.96484375 113.19140625 C20.82949219 112.60875 20.69414062 112.02609375 20.5546875 111.42578125 C17.65802543 100.39418199 12.37285739 90.87434008 2.96484375 84.19140625 C-5.50236611 79.95780132 -23.23745202 80.93195973 -32.34765625 83.19140625 C-40.35160056 86.04899043 -48.12416965 91.54720517 -52.03515625 99.19140625 C-53.14030391 102.50684924 -53.35623256 105.39550736 -53.59765625 108.87890625 C-53.68144531 110.05839844 -53.76523438 111.23789063 -53.8515625 112.453125 C-53.94244141 113.80857422 -53.94244141 113.80857422 -54.03515625 115.19140625 C-53.23722656 115.31386719 -52.43929687 115.43632812 -51.6171875 115.5625 C-49.03515625 116.19140625 -49.03515625 116.19140625 -47.72265625 118.25390625 C-47.38234375 119.21296875 -47.38234375 119.21296875 -47.03515625 120.19140625 C-48.52015625 119.20140625 -48.52015625 119.20140625 -50.03515625 118.19140625 C-51.68515625 118.19140625 -53.33515625 118.19140625 -55.03515625 118.19140625 C-56.68515625 121.16140625 -58.33515625 124.13140625 -60.03515625 127.19140625 C-60.36515625 126.20140625 -60.69515625 125.21140625 -61.03515625 124.19140625 C-60.41640625 123.11890625 -59.79765625 122.04640625 -59.16015625 120.94140625 C-56.94118098 116.85818986 -56.71115735 113.37161945 -56.53515625 108.75390625 C-56.08912866 99.18803792 -53.74910237 92.83707652 -46.73828125 86.1875 C-41.02588916 81.96924515 -34.47281134 79.12897702 -28.03515625 76.19140625 C-31.66515625 72.89140625 -35.29515625 69.59140625 -39.03515625 66.19140625 C-37.55015625 68.66640625 -37.55015625 68.66640625 -36.03515625 71.19140625 C-39.16868622 73.85490673 -42.29939626 76.38450015 -45.66015625 78.75390625 C-49.54560052 81.63229146 -52.93564038 84.90490533 -56.34765625 88.31640625 C-57.12133545 89.0889978 -57.12133545 89.0889978 -57.91064453 89.87719727 C-60.5073953 92.51187236 -62.91049788 95.16032366 -65.03515625 98.19140625 C-67.41015625 97.44140625 -67.41015625 97.44140625 -70.03515625 96.19140625 C-70.69515625 94.87140625 -71.35515625 93.55140625 -72.03515625 92.19140625 C-69.39515625 89.55140625 -66.75515625 86.91140625 -64.03515625 84.19140625 C-66.01515625 85.84140625 -67.99515625 87.49140625 -70.03515625 89.19140625 C-70.69515625 88.86140625 -71.35515625 88.53140625 -72.03515625 88.19140625 C-70.38515625 86.21140625 -68.73515625 84.23140625 -67.03515625 82.19140625 C-68.35515625 81.86140625 -69.67515625 81.53140625 -71.03515625 81.19140625 C-71.03515625 80.86140625 -71.03515625 80.53140625 -71.03515625 80.19140625 C-73.01515625 81.18140625 -73.01515625 81.18140625 -75.03515625 82.19140625 C-74.78946704 78.86692419 -73.8936616 78.06492484 -71.34765625 75.7890625 C-69.69395608 74.50085404 -68.02051842 73.24299533 -66.33984375 71.99023438 C-63.03331287 69.42966667 -63.03331287 69.42966667 -61.3359375 65.71875 C-61.18705078 64.46771484 -61.18705078 64.46771484 -61.03515625 63.19140625 C-58.35801188 57.45819861 -55.27437276 51.91976312 -51.03515625 47.19140625 C-52.35515625 48.18140625 -53.67515625 49.17140625 -55.03515625 50.19140625 C-55.421875 48.12890625 -55.421875 48.12890625 -55.03515625 45.19140625 C-53.24222071 42.6008413 -51.06033104 40.42556332 -48.84765625 38.19140625 C-48.26951172 37.588125 -47.69136719 36.98484375 -47.09570312 36.36328125 C-45.42317229 34.62460512 -43.73317664 32.9051586 -42.03515625 31.19140625 C-41.19597656 30.33933594 -40.35679688 29.48726562 -39.4921875 28.609375 C-36.68465428 25.84647665 -33.81382897 23.16500282 -30.91015625 20.50390625 C-30.38550781 20.01857422 -29.86085937 19.53324219 -29.3203125 19.03320312 C-23.00386401 13.23646243 -23.00386401 13.23646243 -19.34765625 13.06640625 C-18.58453125 13.10765625 -17.82140625 13.14890625 -17.03515625 13.19140625 C-16.82381095 10.80017675 -16.82381095 10.80017675 -18.03515625 8.19140625 C-20.90190469 6.49840198 -23.90928996 5.32177002 -27.03515625 4.19140625 C-27.03515625 3.53140625 -27.03515625 2.87140625 -27.03515625 2.19140625 C-19.17369125 -2.52296511 -8.73780066 -2.32783106 0 0 Z" transform="translate(128.03515625,65.80859375)" />
      <Path fill={color} opacity={0.97} d="M0 0 C1.15242188 0.02964844 2.30484375 0.05929688 3.4921875 0.08984375 C11.664904 0.50765095 15.87444301 2.60746353 21.5 8.5625 C26.79104543 14.88823876 31.74917277 22.27593548 32.25390625 30.71875 C31.76319395 35.12761127 29.92466366 39.04328802 28 43 C23.54447198 42.76954165 20.12127679 42.51865158 16.4375 39.875 C14 37 14 37 14 33.375 C15 30 15 30 17 27 C16.71725862 23.68913741 16.71725862 23.68913741 15 21 C15 21.99 15 22.98 15 24 C13.515 24.495 13.515 24.495 12 25 C12.99 25.33 13.98 25.66 15 26 C13.47793243 31.79128148 12.3641954 35.75653301 7 39 C5.01549844 40.03041427 3.01800895 41.03685937 1 42 C-0.36222307 43.15016254 -0.36222307 43.15016254 -0.3125 46.25 C0.05150348 50.61804171 1.25341143 51.73842608 4 55 C4.3125 57.75 4.3125 57.75 4 60 C3.67 60.33 3.34 60.66 3 61 C2.96828815 64.07604912 3.06853857 67.14015453 3.16015625 70.21484375 C3 73 3 73 1 75 C-4.20349178 75.86724863 -7.04443512 74.0461603 -11.16796875 71.19140625 C-15.03263571 68.67813669 -18.52307518 68.91552972 -23 69 C-22.65572952 72.67221848 -21.4496816 74.99877999 -19.4375 78 C-17.37063157 81.13593831 -16.39789324 83.14651673 -17 87 C-21.33333333 87 -25.66666667 87 -30 87 C-30.33 85.68 -30.66 84.36 -31 83 C-35.455 83.99 -35.455 83.99 -40 85 C-40 83.35 -40 81.7 -40 80 C-41.98 80 -43.96 80 -46 80 C-45.71125 79.01 -45.4225 78.02 -45.125 77 C-43.98624782 73.02250133 -42.98680107 69.01769007 -42 65 C-42.928125 65.309375 -43.85625 65.61875 -44.8125 65.9375 C-46.875 66.625 -48.9375 67.3125 -51 68 C-51.086985 64.22931168 -51.14038579 60.45888068 -51.1875 56.6875 C-51.21263672 55.61564453 -51.23777344 54.54378906 -51.26367188 53.43945312 C-51.27333984 52.41142578 -51.28300781 51.38339844 -51.29296875 50.32421875 C-51.3086792 49.37635498 -51.32438965 48.42849121 -51.34057617 47.4519043 C-50.93430774 44.52706283 -50.19472409 43.87568648 -48 42 C-47.38125 40.948125 -46.7625 39.89625 -46.125 38.8125 C-45.42375 37.884375 -44.7225 36.95625 -44 36 C-41.25 35.625 -41.25 35.625 -39 36 C-40.32 35.34 -41.64 34.68 -43 34 C-43.5595313 20.03244081 -43.5595313 20.03244081 -40 15 C-39.01 13.5459375 -39.01 13.5459375 -38 12.0625 C-27.61783028 0.17475884 -14.54572 -0.45477756 0 0 Z" transform="translate(117,147)" />
      <Path fill={color} opacity={0.85} d="M0 0 C0.33 0.99 0.66 1.98 1 3 C4.3 3 7.6 3 11 3 C7.3558226 5.4294516 5.28758728 5.16179575 1 5 C1.80172193 7.16993333 1.80172193 7.16993333 3.890625 7.7109375 C4.66921875 7.93007812 5.4478125 8.14921875 6.25 8.375 C10.21865522 9.64522245 13.12481294 10.85526415 16 14 C17.125 16.75 17.125 16.75 17 20 C15.43155002 23.23789863 13.55949636 26.44050364 11 29 C5.39930059 29.57443071 0.17987445 28.03095797 -5 26 C-7.35601599 23.64398401 -7.30838856 22.9044427 -7.5625 19.6875 C-7.85972856 16.39675525 -8.27085593 13.2290666 -9 10 C-6.03 9.34 -3.06 8.68 0 8 C0 5.36 0 2.72 0 0 Z" transform="translate(98,184)" />
      <Path fill={color} opacity={0.85} d="M0 0 C-0.125 1.6875 -0.125 1.6875 -1 4 C-2.48562106 5.22725218 -3.97441046 6.45170856 -5.5 7.62890625 C-7.77381751 9.70731757 -8.82602941 12.19551469 -10 15 C-11.65 14.67 -13.3 14.34 -15 14 C-16.97680763 9.05798092 -17.43020546 5.24850659 -17 0 C-13.93217546 -5.95518882 -5.06309715 -1.5499277 0 0 Z" transform="translate(86,193)" />
    </Svg>
  );
};

const FeedIcon = ({ size = 20, color = C.textGhost }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 11a9 9 0 0 1 9 9" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M4 4a16 16 0 0 1 16 16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Circle cx="5" cy="19" r="1.5" fill={color} />
  </Svg>
);

const SourcesIcon = ({ size = 20, color = C.textGhost }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} />
    <Path d="M2 12h20" stroke={color} strokeWidth={1.5} />
    <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
      stroke={color} strokeWidth={1.5} />
  </Svg>
);

const RegionsIcon = ({ size = 20, color = C.textGhost }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke={color} strokeWidth={2} />
    <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={2} />
  </Svg>
);

const ConfigIcon = ({ size = 20, color = C.textGhost }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.65.77 1.09 1.45 1.12H21a2 2 0 1 1 0 4h-.09c-.68.03-1.25.47-1.51 1.12z"
      stroke={color} strokeWidth={2} />
  </Svg>
);

const ExternalLinkIcon = ({ size = 14, color = C.textDim }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Polyline points="15 3 21 3 21 9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Line x1="10" y1="14" x2="21" y2="3" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const RefreshIcon = ({ size = 16, color = C.raven }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polyline points="23 4 23 10 17 10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SearchIcon = ({ size = 16, color = C.textGhost }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={2} />
    <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const ChevronIcon = ({ size = 16, color = C.textGhost, up = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={up ? { transform: [{ rotate: '180deg' }] } : {}}>
    <Polyline points="6 9 12 15 18 9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Brain icon for the analyze button
const BrainIcon = ({ size = 14, color = C.analysisPurple }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" stroke={color} strokeWidth={1.8} />
    <Line x1="9" y1="21" x2="15" y2="21" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <Path d="M12 2v4M8 5l2 3M16 5l-2 3" stroke={color} strokeWidth={1.2} strokeLinecap="round" opacity={0.6} />
  </Svg>
);

// RSS parsing lives in ./src/rss.js

// ============================================================================
// UTILITIES
// ============================================================================

const timeAgo = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// Analysis backend lives in ./src/analysis.js

// ============================================================================
// MARKDOWN-ISH RENDERER
// ============================================================================

/**
 * Renders the analyst output with basic markdown styling.
 * Handles: ## headers, **bold**, bullet points, and paragraphs.
 */
const AnalysisRenderer = ({ text }) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<View key={key++} style={{ height: 6 }} />);
      continue;
    }

    // ## Header
    if (trimmed.startsWith('## ')) {
      elements.push(
        <Text key={key++} style={s.analysisH2}>
          {trimmed.replace('## ', '')}
        </Text>
      );
      continue;
    }

    // # Header (bigger)
    if (trimmed.startsWith('# ')) {
      elements.push(
        <Text key={key++} style={s.analysisH1}>
          {trimmed.replace('# ', '')}
        </Text>
      );
      continue;
    }

    // Bullet point
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const bulletText = trimmed.replace(/^[-*•]\s*/, '');
      elements.push(
        <View key={key++} style={s.analysisBulletRow}>
          <Text style={s.analysisBulletDot}>•</Text>
          <Text style={s.analysisBulletText}>{renderInlineMarkdown(bulletText)}</Text>
        </View>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <Text key={key++} style={s.analysisParagraph}>
        {renderInlineMarkdown(trimmed)}
      </Text>
    );
  }

  return <View style={s.analysisContainer}>{elements}</View>;
};

/**
 * Handle inline **bold** within text.
 * Returns an array of Text elements / strings for nesting.
 */
function renderInlineMarkdown(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: '700', color: C.text }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

// ============================================================================
// SOURCE BADGE COMPONENT
// ============================================================================

const SourceBadge = ({ source, small = false }) => {
  if (!source) return null;
  const leanColor = LEAN_COLORS[source.leanType] || C.neutral;
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: small ? 4 : 6 }}>
      <View style={{
        width: small ? 20 : 24, height: small ? 20 : 24,
        borderRadius: small ? 4 : 5,
        backgroundColor: source.color + '20',
        borderWidth: 1, borderColor: source.color + '40',
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={[s.mono, {
          fontSize: small ? 7 : 8, fontWeight: '800',
          color: source.color, letterSpacing: 0.5,
        }]}>
          {source.icon}
        </Text>
      </View>
      <View>
        <Text style={{ fontSize: small ? 10 : 11, fontWeight: '600', color: C.text }}>
          {source.name}
        </Text>
        {!small && (
          <Text style={{ fontSize: 9, color: leanColor, fontWeight: '600' }}>
            {source.lean} · {source.country}
          </Text>
        )}
      </View>
    </View>
  );
};

// ============================================================================
// LEAN TAG
// ============================================================================

const LeanTag = ({ lean, leanType, small = false }) => {
  const color = LEAN_COLORS[leanType] || C.neutral;
  return (
    <View style={{
      backgroundColor: color + '15',
      borderWidth: 1, borderColor: color + '30',
      borderRadius: 3,
      paddingHorizontal: small ? 5 : 7,
      paddingVertical: small ? 1 : 2,
    }}>
      <Text style={[s.mono, {
        fontSize: small ? 7 : 8, fontWeight: '700',
        color: color, letterSpacing: 1,
      }]}>
        {lean.toUpperCase()}
      </Text>
    </View>
  );
};

// ============================================================================
// ARTICLE CARD
// ============================================================================

const ArticleCard = ({ article, onPress, onOpenLink, expanded }) => {
  const source = getSource(article.sourceId);
  if (!source) return null;

  return (
    <TouchableOpacity
      style={[s.card, s.articleCard, { borderLeftColor: source.color }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.articleHeader}>
        <SourceBadge source={source} small />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LeanTag lean={source.lean} leanType={source.leanType} small />
          <Text style={s.ghost}>{timeAgo(article.pubDate)}</Text>
        </View>
      </View>

      <Text style={s.articleTitle} numberOfLines={expanded ? undefined : 2}>
        {article.title}
      </Text>

      {expanded && (
        <View style={{ marginTop: 10 }}>
          {article.description ? (
            <Text style={s.articleDesc}>{article.description}</Text>
          ) : null}

          <View style={s.articleMeta}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={s.ghost}>{source.region}</Text>
              <Text style={[s.ghost, { color: C.textGhost + '60' }]}>·</Text>
              <Text style={s.ghost}>{source.country}</Text>
              {article.category ? (
                <>
                  <Text style={[s.ghost, { color: C.textGhost + '60' }]}>·</Text>
                  <Text style={s.ghost}>{article.category}</Text>
                </>
              ) : null}
            </View>

            <TouchableOpacity
              style={s.readBtn}
              onPress={() => onOpenLink(article.link)}
            >
              <Text style={s.readBtnText}>READ</Text>
              <ExternalLinkIcon size={10} color={C.raven} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Story clustering lives in ./src/cluster.js

// ============================================================================
// STORY CLUSTER CARD
// ============================================================================

const StoryClusterCard = ({ cluster, expanded, onToggle, onOpenLink, onAnalyze, analysis, analyzing }) => {
  const sourceCount = cluster.articles.length;
  const outletCount = cluster.sourceCount || new Set(cluster.articles.map(a => a.sourceId)).size;
  const leanCount = cluster.leanTypes.length;
  const matchPct = Math.round((cluster.confidence || 0) * 100);

  return (
    <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: C.raven }]}>
      {/* Cluster header — always visible */}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        {/* Lean type dots row. Pills wrap; the match score is pinned right so a
             five-perspective story can't shove it off the card. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <View style={{
            flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap',
            columnGap: 4, rowGap: 4,
          }}>
          {cluster.leanTypes.map((lt) => (
            <View key={lt} style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              backgroundColor: (LEAN_COLORS[lt] || C.neutral) + '15',
              borderWidth: 1, borderColor: (LEAN_COLORS[lt] || C.neutral) + '30',
              borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1,
            }}>
              <View style={{
                width: 5, height: 5, borderRadius: 3,
                backgroundColor: LEAN_COLORS[lt] || C.neutral,
              }} />
              <Text style={[s.mono, {
                fontSize: 7, fontWeight: '700',
                color: LEAN_COLORS[lt] || C.neutral, letterSpacing: 0.5,
              }]}>
                {lt.toUpperCase()}
              </Text>
            </View>
          ))}
          </View>
          <Text style={[s.mono, {
            fontSize: 7, letterSpacing: 0.5, flexShrink: 0, marginTop: 1,
            color: matchPct >= 70 ? C.alive : C.textGhost,
          }]}>
            {matchPct}% MATCH
          </Text>
        </View>

        {/* Story label */}
        <Text style={{
          fontSize: 15, fontWeight: '700', color: C.text, lineHeight: 21,
        }}>
          {cluster.label}
        </Text>

        {/* Meta row. The stats block wraps (and shrinks); the action pair never does. */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
        }}>
          <View style={{
            flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap',
            alignItems: 'center', columnGap: 6, rowGap: 2,
          }}>
            <Text style={[s.mono, {
              fontSize: 9, fontWeight: '700', color: C.raven, letterSpacing: 1,
            }]}>
              {sourceCount} {sourceCount === 1 ? 'ARTICLE' : 'ARTICLES'}
            </Text>
            <Text style={[s.mono, {
              fontSize: 9, fontWeight: '700', color: C.frost, letterSpacing: 1,
            }]}>
              {outletCount} OUTLETS
            </Text>
            <Text style={[s.mono, {
              fontSize: 9, fontWeight: '700', color: leanCount > 1 ? C.leanIndependent : C.textGhost,
              letterSpacing: 1,
            }]}>
              {leanCount} {leanCount === 1 ? 'PERSPECTIVE' : 'PERSPECTIVES'}
            </Text>
            <Text style={[s.ghost, { fontSize: 10 }]}>{timeAgo(cluster.newestDate)}</Text>
          </View>

          {/* ANALYZE button */}
          <TouchableOpacity
            style={[s.analyzeBtn, analyzing && { opacity: 0.5 }, analysis && s.analyzeBtnDone]}
            onPress={(e) => {
              e.stopPropagation && e.stopPropagation();
              if (!analyzing) onAnalyze(cluster.id);
            }}
            disabled={analyzing}
            activeOpacity={0.6}
          >
            {analyzing ? (
              <ActivityIndicator size={10} color={C.analysisPurple} />
            ) : (
              <BrainIcon size={12} color={analysis ? C.alive : C.analysisPurple} />
            )}
            <Text style={[s.mono, {
              fontSize: 8, fontWeight: '700', letterSpacing: 0.5,
              color: analysis ? C.alive : C.analysisPurple,
            }]}>
              {analyzing ? 'THINKING' : analysis ? 'ANALYZED' : 'ANALYZE'}
            </Text>
          </TouchableOpacity>

          <ChevronIcon size={14} color={C.textGhost} up={expanded} />
        </View>
      </TouchableOpacity>

      {/* Analysis result — rendered between the header and the articles */}
      {analysis && expanded && (
        <View style={s.analysisBlock}>
          <View style={s.analysisHeaderRow}>
            <BrainIcon size={14} color={C.analysisPurple} />
            <Text style={[s.mono, { fontSize: 9, fontWeight: '700', color: C.analysisPurple, letterSpacing: 1 }]}>
              ANALYSIS
            </Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={s.copyBtn}
              onPress={() => {
                Clipboard.setStringAsync(analysis.text);
                Vibration.vibrate(30);
              }}
              activeOpacity={0.6}
            >
              <Text style={[s.mono, { fontSize: 8, fontWeight: '700', color: C.analysisPurple, letterSpacing: 0.5 }]}>
                COPY
              </Text>
            </TouchableOpacity>
            <Text style={[s.ghost, { marginLeft: 8 }]}>
              {analysis.generationTime ? `${analysis.generationTime.toFixed(1)}s` : ''}
              {analysis.tokensGenerated ? ` · ${analysis.tokensGenerated} tok` : ''}
            </Text>
          </View>
          <AnalysisRenderer text={analysis.text} />
          <Text style={[s.ghost, { marginTop: 8, fontSize: 9 }]}>
            Generated {timeAgo(analysis.timestamp)}
          </Text>
        </View>
      )}

      {/* Expanded: per-source breakdown */}
      {expanded && (
        <View style={{
          marginTop: 12, paddingTop: 12,
          borderTopWidth: 1, borderTopColor: C.hairlineStrong,
        }}>
          {cluster.articles.map((article, idx) => {
            const source = getSource(article.sourceId);
            if (!source) return null;

            return (
              <View key={article.id} style={{
                paddingVertical: 10,
                borderBottomWidth: idx < cluster.articles.length - 1 ? 1 : 0,
                borderBottomColor: C.hairline,
              }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 6,
                }}>
                  <SourceBadge source={source} small />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <LeanTag lean={source.lean} leanType={source.leanType} small />
                    <Text style={s.ghost}>{timeAgo(article.pubDate)}</Text>
                  </View>
                </View>

                <Text style={{
                  fontSize: 13, fontWeight: '500', color: C.text, lineHeight: 19,
                  paddingLeft: 30,
                }}>
                  {article.title}
                </Text>

                {article.description ? (
                  <Text style={{
                    fontSize: 11, color: C.textDim, lineHeight: 16,
                    marginTop: 4, paddingLeft: 30,
                  }} numberOfLines={2}>
                    {article.description}
                  </Text>
                ) : null}

                <View style={{ paddingLeft: 30, marginTop: 6 }}>
                  <TouchableOpacity
                    style={[s.readBtn, { alignSelf: 'flex-start' }]}
                    onPress={() => onOpenLink(article.link)}
                  >
                    <Text style={s.readBtnText}>READ</Text>
                    <ExternalLinkIcon size={10} color={C.raven} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

// ============================================================================
// FEED SCREEN
// ============================================================================

const ChipRow = ({ items, active, onSelect, style }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={style}
    contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
  >
    {items.map(item => (
      <TouchableOpacity
        key={item.key}
        style={[s.filterChip, active === item.key && [s.filterChipActive, {
          borderColor: (item.color || C.raven) + '40',
          backgroundColor: (item.color || C.raven) + '15',
        }]]}
        onPress={() => onSelect(item.key)}
      >
        {item.color && (
          <View style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: active === item.key ? item.color : C.textGhost,
          }} />
        )}
        <Text style={[s.filterChipText, active === item.key && { color: item.color || C.raven }]}>
          {item.label}
        </Text>
        {item.count !== undefined && (
          <Text style={[s.filterChipText, { color: C.textGhost, marginLeft: 2 }]}>{item.count}</Text>
        )}
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const FeedScreen = ({ articles, onOpenLink, searchQuery, onSearchChange, backendBacked, analysisCache, onAnalyze, analyzingIds, refreshing, onRefresh }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [leanFilter, setLeanFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [viewMode, setViewMode] = useState('timeline');

  const leanFilters = [
    { key: 'all', label: 'ALL' },
    { key: 'western', label: 'WESTERN', color: C.leanWestern },
    { key: 'state', label: 'STATE', color: C.leanState },
    { key: 'independent', label: 'INDEPENDENT', color: C.leanIndependent },
    { key: 'analysis', label: 'ANALYSIS', color: C.leanAnalysis },
    { key: 'panArab', label: 'PAN-ARAB', color: C.leanPanArab },
    { key: 'globalSouth', label: 'GLOBAL SOUTH', color: C.leanGlobalSouth },
    { key: 'opposition', label: 'OPPOSITION', color: C.leanOpposition },
    { key: 'regional', label: 'REGIONAL', color: C.leanRegional },
  ];

  // Filtering is cheap; clustering ~1000 headlines is not, so it runs off the
  // render path. Otherwise the tap that opens STORIES stalls the JS thread.
  const { filtered, topicCounts } = useMemo(() => {
    const counts = {};
    const f = articles.filter(a => {
      const source = getSource(a.sourceId);
      if (!source) return false;
      if (a.topic) counts[a.topic] = (counts[a.topic] || 0) + 1;
      if (leanFilter !== 'all' && source.leanType !== leanFilter) return false;
      if (topicFilter !== 'all' && a.topic !== topicFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (a.title || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
      }
      return true;
    });
    return { filtered: f, topicCounts: counts };
  }, [articles, leanFilter, topicFilter, searchQuery]);

  const [clusters, setClusters] = useState([]);
  const [grouping, setGrouping] = useState(false);

  useEffect(() => {
    if (viewMode !== 'stories') {
      setClusters([]);
      setGrouping(false);
      return undefined;
    }
    let cancelled = false;
    setGrouping(true);
    // Defer a tick so the tab switch paints before the grouping work starts.
    const timer = setTimeout(() => {
      const result = clusterArticles(filtered, getSource);
      if (cancelled) return;
      setClusters(result.clusters);
      setGrouping(false);
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filtered, viewMode]);

  const topicFilters = [
    { key: 'all', label: 'ALL', count: articles.length },
    ...TOPICS.map(t => ({ key: t.id, label: t.label.toUpperCase(), color: t.color, count: topicCounts[t.id] || 0 })),
  ];

  const stories = viewMode === 'stories';
  const data = stories ? clusters : filtered;

  const listHeader = (
    <View>
      {/* Search bar */}
      <View style={s.searchBar}>
        <SearchIcon size={14} color={C.textGhost} />
        <TextInput
          style={s.searchInput}
          placeholder="Search articles..."
          placeholderTextColor={C.textGhost}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Text style={{ fontSize: 18, color: C.textGhost, lineHeight: 20 }}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* View mode toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 8, gap: 8 }}>
        <View style={{
          flexDirection: 'row', backgroundColor: C.obsidian,
          borderRadius: 6, borderWidth: 1, borderColor: C.hairline,
          overflow: 'hidden',
        }}>
          <TouchableOpacity
            style={{
              paddingHorizontal: 10, paddingVertical: 6,
              backgroundColor: viewMode === 'timeline' ? C.raven + '20' : 'transparent',
              borderRightWidth: 1, borderRightColor: C.hairline,
            }}
            onPress={() => { setViewMode('timeline'); setExpandedId(null); }}
          >
            <Text style={[s.mono, {
              fontSize: 8, fontWeight: '700', letterSpacing: 1,
              color: viewMode === 'timeline' ? C.raven : C.textGhost,
            }]}>TIMELINE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              paddingHorizontal: 10, paddingVertical: 6,
              backgroundColor: viewMode === 'stories' ? C.raven + '20' : 'transparent',
            }}
            onPress={() => { setViewMode('stories'); setExpandedId(null); }}
          >
            <Text style={[s.mono, {
              fontSize: 8, fontWeight: '700', letterSpacing: 1,
              color: viewMode === 'stories' ? C.raven : C.textGhost,
            }]}>STORIES</Text>
          </TouchableOpacity>
        </View>

        {/* analysis backend indicator (stories mode only) */}
        {stories && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[s.statusDot, { backgroundColor: backendBacked ? C.alive : C.warning }]} />
            <Text style={[s.mono, { fontSize: 7, color: C.textGhost, letterSpacing: 0.5 }]}>
              {backendBacked ? 'LLM READY' : 'NO LLM'}
            </Text>
          </View>
        )}
      </View>

      {/* Topic (desk) filter chips */}
      <ChipRow items={topicFilters} active={topicFilter} onSelect={setTopicFilter} style={s.filterScroll} />

      {/* Editorial-lean filter chips */}
      <ChipRow items={leanFilters} active={leanFilter} onSelect={setLeanFilter} style={s.filterScrollTight} />

      {/* Count bar */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Text style={s.ghost}>
          {stories
            ? (grouping ? 'grouping stories…' : `${clusters.length} stories from ${filtered.length} articles`)
            : `${filtered.length} articles`
          }
        </Text>
      </View>
    </View>
  );

  const empty = stories ? (
    <View style={s.emptyState}>
      <HuginnLogo size={32} color={C.textGhost} />
      <Text style={s.emptyText}>{grouping ? 'Grouping…' : 'No story clusters here'}</Text>
      <Text style={[s.ghost, { textAlign: 'center', paddingHorizontal: 24 }]}>
        A story forms when 2+ outlets cover the same event within 48 hours.
        A desk with a single outlet will have none — switch to TIMELINE or widen the desk filter.
      </Text>
    </View>
  ) : (
    <View style={s.emptyState}>
      <HuginnLogo size={32} color={C.textGhost} />
      <Text style={s.emptyText}>No articles found</Text>
      <Text style={s.ghost}>
        {searchQuery ? 'Try a different search' : 'Pull to refresh or check source settings'}
      </Text>
    </View>
  );

  return (
    <FlatList
      style={s.scroll}
      contentContainerStyle={{ paddingBottom: 100 }}
      data={data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={empty}
      // Virtualization: only ~1 screen of cards is mounted, so the Android
      // save-state parcel stays far below the 1MB Binder limit and the first
      // paint isn't gated on 1200 card layouts.
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      updateCellsBatchingPeriod={50}
      windowSize={5}
      removeClippedSubviews
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.raven} />}
      renderItem={({ item }) => (stories ? (
        <StoryClusterCard
          cluster={item}
          expanded={expandedId === item.id}
          onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          onOpenLink={onOpenLink}
          onAnalyze={onAnalyze}
          analysis={analysisCache[item.id] || null}
          analyzing={analyzingIds.has(item.id)}
        />
      ) : (
        <ArticleCard
          article={item}
          expanded={expandedId === item.id}
          onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
          onOpenLink={onOpenLink}
        />
      ))}
    />
  );
};

// ============================================================================
// SOURCES SCREEN
// ============================================================================

const SourcesScreen = ({ enabledSources, onToggleSource, sourceErrors, articleCounts, onToggleAll }) => {
  return (
    <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={s.quickActions}>
        <TouchableOpacity style={s.quickBtn} onPress={() => onToggleAll(true)}>
          <Text style={[s.mono, { fontSize: 10, color: C.alive, letterSpacing: 0.5 }]}>ENABLE ALL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.quickBtn} onPress={() => onToggleAll(false)}>
          <Text style={[s.mono, { fontSize: 10, color: C.dead, letterSpacing: 0.5 }]}>DISABLE ALL</Text>
        </TouchableOpacity>
      </View>

      {REGIONS.map(region => {
        const regionSources = SOURCES.filter(s => s.region === region);
        const enabledCount = regionSources.filter(s => enabledSources.has(s.id)).length;

        return (
          <View key={region}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{region.toUpperCase()}</Text>
              <Text style={s.ghost}>{enabledCount}/{regionSources.length}</Text>
            </View>

            <View style={{ paddingHorizontal: 16 }}>
              {regionSources.map(source => {
                const enabled = enabledSources.has(source.id);
                const hasError = sourceErrors[source.id];
                const count = articleCounts[source.id] || 0;

                return (
                  <TouchableOpacity
                    key={source.id}
                    style={[s.sourceRow, !enabled && { opacity: 0.4 }]}
                    onPress={() => onToggleSource(source.id)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={[s.statusDot, {
                        backgroundColor: hasError ? C.dead : enabled ? C.alive : C.textGhost,
                      }]} />
                      
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>
                            {source.name}
                          </Text>
                          <LeanTag lean={source.lean} leanType={source.leanType} small />
                        </View>
                        <Text style={[s.ghost, { marginTop: 2 }]}>
                          {source.country} · {source.region} · {(TOPICS.find(t => t.id === source.topic) || { label: 'World' }).label}
                        </Text>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.mono, { fontSize: 14, fontWeight: '700', color: count > 0 ? C.text : C.textGhost }]}>
                        {count}
                      </Text>
                      {hasError && (
                        <Text style={{ fontSize: 8, color: C.dead, maxWidth: 90, textAlign: 'right' }}>
                          {(sourceErrors[source.id] || 'ERROR').toUpperCase()}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

// ============================================================================
// DESKS SCREEN (topic first, then the stories inside each desk)
// ============================================================================

const DeskSection = ({ topic, articles, onOpenLink, analysisCache, onAnalyze, analyzingIds }) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [clusters, setClusters] = useState([]);
  const outlets = useMemo(() => new Set(articles.map(a => a.sourceId)).size, [articles]);

  useEffect(() => {
    if (!expanded) { setClusters([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => {
      const result = clusterArticles(articles, getSource);
      if (!cancelled) setClusters(result.clusters);
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [expanded, articles]);

  return (
    <View>
      <TouchableOpacity style={s.regionHeader} onPress={() => setExpanded(!expanded)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: topic.color }} />
          <Text style={[s.sectionTitle, expanded && { color: topic.color }]}>
            {topic.label.toUpperCase()}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[s.ghost, { fontSize: 9 }]}>{outlets} OUTLETS</Text>
          <Text style={[s.mono, { fontSize: 13, fontWeight: '700', color: topic.color }]}>
            {articles.length}
          </Text>
          <ChevronIcon size={14} color={C.textGhost} up={expanded} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={s.articleList}>
          {clusters.length > 0 ? clusters.slice(0, 8).map(cluster => (
            <StoryClusterCard
              key={cluster.id}
              cluster={cluster}
              expanded={expandedId === cluster.id}
              onToggle={() => setExpandedId(expandedId === cluster.id ? null : cluster.id)}
              onOpenLink={onOpenLink}
              onAnalyze={onAnalyze}
              analysis={analysisCache[cluster.id] || null}
              analyzing={analyzingIds.has(cluster.id)}
            />
          )) : (
            <Text style={[s.ghost, { paddingHorizontal: 16, paddingBottom: 12 }]}>
              No cross-outlet stories in this desk yet — see the Feed timeline for its {articles.length} articles.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const DesksScreen = ({ articles, onOpenLink, analysisCache, onAnalyze, analyzingIds }) => {
  const desks = useMemo(() => TOPICS
    .map(topic => ({
      topic,
      articles: articles.filter(a => (a.topic || 'world') === topic.id),
    }))
    .filter(d => d.articles.length > 0)
    .sort((a, b) => b.articles.length - a.articles.length), [articles]);

  if (desks.length === 0) {
    return (
      <View style={s.emptyState}>
        <HuginnLogo size={32} color={C.textGhost} />
        <Text style={s.emptyText}>No articles loaded</Text>
        <Text style={s.ghost}>Pull to refresh</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
      {desks.map(desk => (
        <DeskSection
          key={desk.topic.id}
          topic={desk.topic}
          articles={desk.articles}
          onOpenLink={onOpenLink}
          analysisCache={analysisCache}
          onAnalyze={onAnalyze}
          analyzingIds={analyzingIds}
        />
      ))}
    </ScrollView>
  );
};

// ============================================================================
// CONFIG SCREEN
// ============================================================================

const ConfigScreen = ({ enabledSources, articleCounts, sourceErrors, lastFetched, settings, onSettingsChange, onTestBackend, backendStatus }) => {
  const totalArticles = Object.values(articleCounts).reduce((a, b) => a + b, 0);
  const failedSources = Object.keys(sourceErrors).length;
  const activeSources = enabledSources.size;
  const backend = BACKENDS.find(b => b.id === settings.backend) || BACKENDS[0];

  const ConfigRow = ({ label, value, color }) => (
    <View style={s.configRow}>
      <Text style={{ fontSize: 13, color: C.textDim }}>{label}</Text>
      <Text style={[s.mono, { fontSize: 14, fontWeight: '700', color: color || C.text }]}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        {/* Optional analysis backend */}
        <View style={[s.card, { backgroundColor: C.analysisPurple + '08', borderColor: C.analysisPurple + '20' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BrainIcon size={16} color={C.analysisPurple} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.analysisPurple, letterSpacing: 2 }}>ANALYSIS (OPTIONAL)</Text>
            </View>
            <Text style={[s.mono, { fontSize: 12, fontWeight: '800', color: backendStatus === 'connected' ? C.alive : backendStatus === 'error' ? C.dead : C.warning }]}>
              {backendStatus === 'connected' ? 'CONNECTED' : backendStatus === 'error' ? 'UNREACHABLE' : settings.url ? 'UNCHECKED' : 'OFF'}
            </Text>
          </View>

          <Text style={[s.ghost, { marginTop: 6, marginBottom: 10, lineHeight: 16 }]}>
            Reading, pairing and clustering need no server. Only the ANALYZE button on a
            story uses an LLM, and it is entirely optional.
          </Text>

          {/* Backend selector */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {BACKENDS.map(b => (
              <TouchableOpacity
                key={b.id}
                onPress={() => onSettingsChange({ backend: b.id })}
                style={[s.filterChip, settings.backend === b.id && [s.filterChipActive, {
                  borderColor: C.analysisPurple + '40', backgroundColor: C.analysisPurple + '15',
                }]]}
              >
                <Text style={[s.filterChipText, settings.backend === b.id && { color: C.analysisPurple }]}>
                  {b.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* URL input */}
          <View style={[s.searchBar, { marginHorizontal: 0, marginTop: 0, marginBottom: 8 }]}>
            <Text style={{ fontSize: 12, color: C.analysisPurple, fontWeight: '700' }}>URL</Text>
            <TextInput
              style={[s.searchInput, { fontSize: 12 }]}
              placeholder={backend.hint}
              placeholderTextColor={C.textGhost}
              value={settings.url}
              onChangeText={(url) => onSettingsChange({ url })}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* Model name — only meaningful for OpenAI-compatible servers */}
          {settings.backend === 'openai' && (
            <View style={[s.searchBar, { marginHorizontal: 0, marginTop: 0, marginBottom: 8 }]}>
              <Text style={{ fontSize: 12, color: C.analysisPurple, fontWeight: '700' }}>MODEL</Text>
              <TextInput
                style={[s.searchInput, { fontSize: 12 }]}
                placeholder="local-model"
                placeholderTextColor={C.textGhost}
                value={settings.model}
                onChangeText={(model) => onSettingsChange({ model })}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <TouchableOpacity
            style={[s.readBtn, { alignSelf: 'flex-start', borderColor: C.analysisPurple + '30', backgroundColor: C.analysisPurple + '15' }]}
            onPress={onTestBackend}
          >
            <Text style={[s.readBtnText, { color: C.analysisPurple }]}>TEST CONNECTION</Text>
          </TouchableOpacity>
        </View>

        {/* Status card */}
        <View style={[s.card, { backgroundColor: C.raven + '08', borderColor: C.raven + '20', marginTop: 12 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: C.raven, letterSpacing: 2 }}>STATUS</Text>
            <Text style={[s.mono, { fontSize: 14, fontWeight: '800', color: C.alive }]}>
              LOCAL
            </Text>
          </View>
          <Text style={[s.ghost, { marginTop: 4, fontSize: 11 }]}>
            Huginn watches. Huginn reports.
          </Text>
        </View>

        {/* Stats */}
        <View style={[s.card, { marginTop: 12 }]}>
          <Text style={s.labelUp}>STATS</Text>
          <ConfigRow label="Total Articles" value={totalArticles} color={C.raven} />
          <ConfigRow label="Active Sources" value={`${activeSources}/${SOURCES.length}`} color={C.alive} />
          <ConfigRow label="Failed Sources" value={failedSources} color={failedSources > 0 ? C.dead : C.alive} />
          <ConfigRow label="Desks" value={TOPICS.length} />
          <ConfigRow label="Refresh Interval" value="5 min" />
          <ConfigRow label="Last Fetched" value={lastFetched ? timeAgo(lastFetched) : 'Never'} color={C.textDim} />
        </View>

        {/* Bias legend */}
        <View style={[s.card, { marginTop: 12 }]}>
          <Text style={s.labelUp}>PERSPECTIVE LEGEND</Text>
          <Text style={[s.ghost, { marginBottom: 10, lineHeight: 16 }]}>
            Every outlet has a perspective. The value is in comparing them.
          </Text>
          {[
            { label: 'Western Wire/Public', color: C.leanWestern, desc: 'AP, Reuters, BBC — baseline framing' },
            { label: 'State Media', color: C.leanState, desc: 'Government-run — shows what they want you to think' },
            { label: 'Independent', color: C.leanIndependent, desc: 'Not government-aligned — ground truth check' },
            { label: 'Pan-Arab', color: C.leanPanArab, desc: 'Al Jazeera etc — regional perspective' },
            { label: 'Global South', color: C.leanGlobalSouth, desc: 'Multipolar world framing' },
            { label: 'Analysis/OSINT', color: C.leanAnalysis, desc: 'Investigative, open-source intelligence' },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <View style={{
                width: 10, height: 10, borderRadius: 2,
                backgroundColor: item.color, marginTop: 3,
              }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: item.color }}>{item.label}</Text>
                <Text style={[s.ghost, { marginTop: 1 }]}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* About */}
        <View style={[s.card, { marginTop: 12 }]}>
          <Text style={s.labelUp}>ABOUT HUGINN</Text>
          <Text style={{ fontSize: 12, color: C.textDim, lineHeight: 18, marginTop: 4 }}>
            In Norse mythology, Huginn ("thought") is one of Odin's two ravens who flies across Midgard each day, gathering knowledge from all corners of the world and reporting back.
          </Text>
          <Text style={{ fontSize: 12, color: C.textDim, lineHeight: 18, marginTop: 8 }}>
            {`${SOURCES.length} outlets across ${REGIONS.length} regions and ${TOPICS.length} desks. Feeds are fetched directly from the device — no aggregator, no account, no server. Articles that cover the same event are grouped so you can read one story across many tellings.`}
          </Text>
          <View style={{ marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.textGhost + '15' }}>
            <Text style={[s.mono, { fontSize: 9, color: C.textGhost, letterSpacing: 1 }]}>
              HUGINN v3.0
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [activeTab, setActiveTab] = useState('feed');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ done: 0, total: 0 });
  const [enabledSources, setEnabledSources] = useState(new Set(SOURCES.map(s => s.id)));
  const [sourceErrors, setSourceErrors] = useState({});
  const [articleCounts, setArticleCounts] = useState({});
  const [lastFetched, setLastFetched] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Optional analysis backend
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [backendStatus, setBackendStatus] = useState('unchecked'); // 'unchecked' | 'connected' | 'error'
  const [analysisCache, setAnalysisCache] = useState({}); // clusterId -> { text, ... }
  const [analyzingIds, setAnalyzingIds] = useState(new Set());

  // Load saved settings on mount (migrates the old single-URL key)
  useEffect(() => {
    AsyncStorage.multiGet(['huginn_settings', 'huginn_mork_url']).then(pairs => {
      const map = Object.fromEntries(pairs);
      if (map.huginn_settings) {
        try {
          const saved = JSON.parse(map.huginn_settings) || {};
          if (saved.backend === 'mork') saved.backend = 'generate';
          // A key the user blanked must not clobber the build-time default:
          // empty means "not set", not "explicitly none".
          const set = Object.fromEntries(
            Object.entries(saved).filter(([, value]) => value !== '' && value !== null && value !== undefined),
          );
          setSettings({ ...DEFAULT_SETTINGS, ...set });
          return;
        } catch { /* fall through to legacy */ }
      }
      if (map.huginn_mork_url && !/^http:\/\/100\.x/.test(map.huginn_mork_url)) {
        setSettings(s => ({ ...s, backend: 'generate', url: map.huginn_mork_url }));
      }
    }).catch(() => {});
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem('huginn_settings', JSON.stringify(next)).catch(() => {});
      return next;
    });
    setBackendStatus('unchecked');
  }, []);

  const testBackend = useCallback(async () => {
    if (!settings.url) {
      Alert.alert('No backend set', 'Analysis is optional. Paste a URL first if you want the ANALYZE button.');
      return;
    }
    try {
      await checkBackend(settings);
      setBackendStatus('connected');
      Vibration.vibrate(50);
      Alert.alert('Backend online', `Reached ${settings.url}`);
    } catch (err) {
      setBackendStatus('error');
      Alert.alert('Backend unreachable', `${settings.url}\n\n${err.message}`);
    }
  }, [settings]);

  const handleAnalyzeCluster = useCallback(async (clusterId) => {
    if (analysisCache[clusterId]) return;
    if (!settings.url) {
      Alert.alert('Analysis is optional', 'Set an LLM endpoint in the Config tab to enable ANALYZE.');
      return;
    }

    // Rebuild the same cluster the UI is showing so the id matches.
    const visible = articles.filter(a => enabledSources.has(a.sourceId));
    const cluster = clusterArticles(visible, getSource).clusters.find(c => c.id === clusterId);
    if (!cluster) return;

    setAnalyzingIds(prev => new Set([...prev, clusterId]));
    Vibration.vibrate(30);

    try {
      const result = await analyzeCluster(
        cluster,
        { ...settings, topicLabel: cluster.topic || 'news' },
        getSource,
      );
      setAnalysisCache(prev => ({ ...prev, [clusterId]: result }));
      setBackendStatus('connected');
      Vibration.vibrate([0, 40, 60, 40]);
    } catch (err) {
      Alert.alert('Analysis failed', err.message);
      setBackendStatus('error');
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(clusterId);
        return next;
      });
    }
  }, [articles, enabledSources, settings, analysisCache]);

  // ---- Fetch all feeds ----
  const fetchAllFeeds = useCallback(async () => {
    const activeSources = SOURCES.filter(s => enabledSources.has(s.id));
    setFetchProgress({ done: 0, total: activeSources.length });

    const headers = {
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      'User-Agent': 'HUGINN/3.0 (+https://github.com/) RSS reader',
    };

    // One URL attempt. Throws with a specific reason so the Sources screen can
    // show why a feed is dark instead of a generic failure.
    const attempt = async (url, source) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, { signal: controller.signal, headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const head = text.slice(0, 4000);
        if (/<!doctype html/i.test(head) && !/<rss|<feed/i.test(head)) throw new Error('HTML, not a feed');
        const items = parseRSS(text, source.id);
        if (items.length === 0) throw new Error('No items');
        return items;
      } finally {
        clearTimeout(timer);
      }
    };

    // Declared per-source so `source` is in scope for attempt(); measures one
    // outlet end to end, primary then fallback mirror.
    const fetchOne = async (source) => {
      try {
        return await attempt(source.rss, source);
      } catch (primaryError) {
        if (!source.fallback) throw primaryError;
        try {
          return await attempt(source.fallback, source);
        } catch {
          throw primaryError; // report the primary failure, not the mirror's
        }
      }
    };

    const allArticles = [];
    const errors = {};
    const counts = {};
    let done = 0;

    // Bounded concurrency: 60+ parallel requests is rude to small outlets and
    // thrashes mobile radios.
    const CONCURRENCY = 8;
    let cursor = 0;
    const worker = async () => {
      while (cursor < activeSources.length) {
        const source = activeSources[cursor++];
        try {
          const items = await fetchOne(source);
          // Feeds lie about time: some publish 90 minutes into the future, some
          // stamp every item with the feed's build time. A negative age made
          // timeAgo print "just now" and floated those outlets to the top of the
          // timeline, so nothing may claim to be newer than the moment it arrived.
          const now = Date.now();
          for (const item of items) {
            item.topic = classifyTopic(item, source).topic;
            if (item.pubDate.getTime() > now) item.pubDate = new Date(now);
          }
          counts[source.id] = items.length;
          allArticles.push(...items);
        } catch (err) {
          errors[source.id] = err.message || 'Failed';
          counts[source.id] = 0;
        } finally {
          done++;
          setFetchProgress({ done, total: activeSources.length });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, activeSources.length) }, worker));

    allArticles.sort((a, b) => b.pubDate - a.pubDate);

    setArticles(allArticles);
    setSourceErrors(errors);
    setArticleCounts(counts);
    setLastFetched(new Date());

    // Optional export for pipeline consumers; no-op when no backend is set.
    await exportClusters({
      articles: allArticles,
      enabledSources,
      analysisCache,
      backendUrl: settings.url,
      clusterFn: clusterArticles,
      getSourceFn: getSource,
    });

    setLoading(false);
    setRefreshing(false);
    setAnalysisCache({}); // cluster ids change when the article set changes
  }, [enabledSources, analysisCache, settings.url]);

  // Initial fetch
  useEffect(() => {
    fetchAllFeeds();
  }, []);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(fetchAllFeeds, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAllFeeds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Vibration.vibrate(50);
    await fetchAllFeeds();
  }, [fetchAllFeeds]);

  // ---- Source management ----
  const toggleSource = (id) => {
    const next = new Set(enabledSources);
    if (next.has(id)) next.delete(id); else next.add(id);
    setEnabledSources(next);
  };

  const toggleAllSources = (enable) => {
    if (enable) {
      setEnabledSources(new Set(SOURCES.map(s => s.id)));
    } else {
      setEnabledSources(new Set());
    }
  };

  // ---- Open article link ----
  const openLink = (url) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  // ---- Filter articles by enabled sources ----
  const visibleArticles = articles.filter(a => enabledSources.has(a.sourceId));

  // ---- Loading state ----
  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.void} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <HuginnLogo size={48} color={C.raven} />
          <Text style={[s.mono, { color: C.raven, fontSize: 11, marginTop: 12, letterSpacing: 2 }]}>
            HUGINN SOARS...
          </Text>
          <Text style={[s.ghost, { marginTop: 8 }]}>
            Fetching {fetchProgress.done}/{fetchProgress.total} sources
          </Text>
          <View style={{
            width: 160, height: 3, backgroundColor: C.coal,
            borderRadius: 2, overflow: 'hidden', marginTop: 12,
          }}>
            <View style={{
              width: `${(fetchProgress.done / Math.max(fetchProgress.total, 1)) * 100}%`,
              height: 3, backgroundColor: C.raven, borderRadius: 2,
            }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.void} />

      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={s.headerTitle}>HUGINN</Text>
          <View style={s.verBadge}>
            <Text style={s.verBadgeText}>v3.0</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.statusDot, {
            backgroundColor: Object.keys(sourceErrors).length > SOURCES.length / 2 ? C.dead : C.alive,
          }]} />
          <Text style={[s.mono, { fontSize: 8, color: C.textGhost, letterSpacing: 1 }]}>
            {visibleArticles.length} ARTICLES
          </Text>
          <TouchableOpacity onPress={onRefresh} style={{ padding: 4 }}>
            <RefreshIcon size={16} color={refreshing ? C.textGhost : C.raven} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {/* No outer ScrollView: an unfocused 1200-row list here is what blew
          Android's 1MB save-state parcel on activity stop. Each tab owns its
          own virtualized list instead. */}
      <View style={{ flex: 1 }}>
        {activeTab === 'feed' && (
          <FeedScreen
            articles={visibleArticles}
            onOpenLink={openLink}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            refreshing={refreshing}
            onRefresh={onRefresh}
            backendUrl={settings.url}
            backendBacked={Boolean(settings.url)}
            analysisCache={analysisCache}
            onAnalyze={handleAnalyzeCluster}
            analyzingIds={analyzingIds}
          />
        )}
        {activeTab === 'sources' && (
          <SourcesScreen
            enabledSources={enabledSources}
            onToggleSource={toggleSource}
            onToggleAll={toggleAllSources}
            sourceErrors={sourceErrors}
            articleCounts={articleCounts}
          />
        )}
        {activeTab === 'desks' && (
          <DesksScreen
            articles={visibleArticles}
            onOpenLink={openLink}
            analysisCache={analysisCache}
            onAnalyze={handleAnalyzeCluster}
            analyzingIds={analyzingIds}
          />
        )}
        {activeTab === 'config' && (
          <ConfigScreen
            enabledSources={enabledSources}
            articleCounts={articleCounts}
            sourceErrors={sourceErrors}
            lastFetched={lastFetched}
            settings={settings}
            onSettingsChange={updateSettings}
            onTestBackend={testBackend}
            backendStatus={backendStatus}
          />
        )}
      </View>

      {/* Bottom Nav */}
      <View style={s.bottomNav}>
        {[
          { key: 'feed', icon: FeedIcon, label: 'Feed' },
          { key: 'sources', icon: SourcesIcon, label: 'Sources' },
          { key: 'desks', icon: RegionsIcon, label: 'Desks' },
          { key: 'config', icon: ConfigIcon, label: 'Config' },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.navItem}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon size={20} color={active ? C.raven : C.textGhost} />
              <Text style={[s.navLabel, active && { color: C.raven }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text style={s.footerText}>The raven watches.</Text>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.void },
  scroll: { flex: 1 },

  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  ghost: { fontSize: 10, color: C.textGhost },
  labelUp: { fontSize: 9, fontWeight: '700', color: C.textGhost, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.raven + '10',
    backgroundColor: C.void,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '900', letterSpacing: 3,
    color: C.raven,
  },
  verBadge: {
    backgroundColor: C.raven + '15', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: C.raven + '25',
  },
  verBadgeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 8, fontWeight: '700', color: C.raven, letterSpacing: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: C.obsidian, borderRadius: 8,
    borderWidth: 1, borderColor: C.hairline,
  },
  searchInput: {
    flex: 1, fontSize: 13, color: C.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 0,
  },

  // Filter chips
  filterScroll: { marginVertical: 8 },
  filterScrollTight: { marginBottom: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: C.obsidian, borderWidth: 1, borderColor: C.hairline,
  },
  filterChipActive: {},
  filterChipText: { fontSize: 9, fontWeight: '700', color: C.textGhost, letterSpacing: 0.5 },

  // Cards
  card: {
    backgroundColor: C.obsidian, borderRadius: 10,
    padding: 14, borderWidth: 1, borderColor: C.hairline,
  },

  // Article cards
  articleList: { paddingHorizontal: 16, gap: 8 },
  articleCard: {
    borderLeftWidth: 3,
    borderLeftColor: C.raven,
  },
  articleHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  articleTitle: {
    fontSize: 14, fontWeight: '600', color: C.text, lineHeight: 20,
  },
  articleDesc: {
    fontSize: 12, color: C.textDim, lineHeight: 18, marginBottom: 10,
  },
  articleMeta: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: C.hairlineStrong,
  },
  readBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.raven + '15', borderRadius: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: C.raven + '30',
  },
  readBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 9, fontWeight: '700', color: C.raven, letterSpacing: 1,
  },

  // Analyze button
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0,
    backgroundColor: C.analysisPurple + '12',
    borderRadius: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.analysisPurple + '30',
  },
  analyzeBtnDone: {
    backgroundColor: C.alive + '10',
    borderColor: C.alive + '25',
  },

  // Analysis block
  analysisBlock: {
    marginTop: 12, paddingTop: 12, paddingBottom: 4,
    borderTopWidth: 1, borderTopColor: C.analysisPurple + '20',
    borderBottomWidth: 1, borderBottomColor: C.analysisPurple + '10',
  },
  analysisHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  copyBtn: {
    backgroundColor: C.analysisPurple + '15',
    borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: C.analysisPurple + '30',
  },
  analysisContainer: {
    paddingLeft: 4,
  },
  analysisH1: {
    fontSize: 15, fontWeight: '800', color: C.analysisPurple, letterSpacing: 0.5,
    marginTop: 8, marginBottom: 6,
  },
  analysisH2: {
    fontSize: 13, fontWeight: '700', color: C.analysisPurple, letterSpacing: 0.3,
    marginTop: 10, marginBottom: 4,
    textTransform: 'uppercase',
  },
  analysisParagraph: {
    fontSize: 12, color: C.textDim, lineHeight: 18,
    marginBottom: 4,
  },
  analysisBulletRow: {
    flexDirection: 'row', paddingLeft: 4, marginBottom: 3,
  },
  analysisBulletDot: {
    fontSize: 12, color: C.analysisPurple, marginRight: 6, lineHeight: 18,
  },
  analysisBulletText: {
    fontSize: 12, color: C.textDim, lineHeight: 18, flex: 1,
  },

  // Source rows
  sourceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.hairlineFaint,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 8, marginBottom: 4,
  },
  quickBtn: {
    backgroundColor: C.obsidian, borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: C.hairline,
  },

  // Region header
  regionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.hairline,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: C.raven, letterSpacing: 2 },

  // Config
  configRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.hairline,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: C.textDim, marginTop: 8, marginBottom: 4 },

  // Bottom Nav
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 8, paddingBottom: 28,
    backgroundColor: C.void + 'f2',
    borderTopWidth: 1, borderTopColor: C.raven + '08',
  },
  navItem: { alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 12 },
  navLabel: { fontSize: 9, fontWeight: '600', color: C.textGhost, letterSpacing: 0.3 },

  // Footer
  footer: {
    position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center',
  },
  footerText: { fontSize: 10, color: C.textGhost + '40', fontStyle: 'italic' },
});
