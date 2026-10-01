import {
  contentFileSchema,
  weaknessSchema,
  type Problem,
  type RecordAttempt,
  type RecordHint,
} from '@parsons/shared';
import bundled from '../../../content/problems.json';
import { API_TIMEOUT_MS, API_URL, HAS_API, SYNCED_CONTENT_URL } from './constants';

export type Connection = 'server' | 'bundled';

let connection: Connection = 'bundled';
export const connectionUsed = () => connection;

async function getJson(path: string): Promise<unknown> {
  if (!HAS_API) throw new Error('no API configured');
  const response = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

export async function loadProblems(): Promise<Problem[]> {
  try {
    const content = contentFileSchema.parse(await getJson('/api/problems'));
    connection = 'server';
    return content.problems;
  } catch {
    connection = 'bundled';
    return [...contentFileSchema.parse(bundled).problems, ...(await loadSynced())];
  }
}

// Fetched rather than imported, so a sync landing mid-session doesn't force a page reload.
async function loadSynced(): Promise<Problem[]> {
  try {
    const response = await fetch(SYNCED_CONTENT_URL, { cache: 'no-store' });
    if (!response.ok) return [];
    return contentFileSchema.parse(await response.json()).problems;
  } catch {
    return [];
  }
}

export async function loadHintsByTopic(): Promise<Record<string, number>> {
  try {
    const rows = weaknessSchema.parse(await getJson('/api/weakness'));
    return Object.fromEntries(rows.map((row) => [row.topic, row.hints]));
  } catch {
    return {};
  }
}

async function post(path: string, body: unknown): Promise<void> {
  if (!HAS_API) return;
  try {
    await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    // the drill keeps working without the server; the record is simply lost
  }
}

export const recordAttempt = (attempt: RecordAttempt) => post('/api/attempts', attempt);
export const recordHint = (hint: RecordHint) => post('/api/hints', hint);
