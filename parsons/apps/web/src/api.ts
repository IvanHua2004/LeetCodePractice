import {
  contentFileSchema,
  weaknessSchema,
  type Problem,
  type RecordAttempt,
  type RecordHint,
} from '@parsons/shared';
import bundled from '../../../content/problems.json';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export type Connection = 'server' | 'bundled';

let connection: Connection = 'bundled';
export const connectionUsed = () => connection;

export async function loadProblems(): Promise<Problem[]> {
  try {
    const response = await fetch(`${baseUrl}/api/problems`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error(String(response.status));
    const content = contentFileSchema.parse(await response.json());
    connection = 'server';
    return content.problems;
  } catch {
    connection = 'bundled';
    return contentFileSchema.parse(bundled).problems;
  }
}

export async function loadHintsByTopic(): Promise<Record<string, number>> {
  try {
    const response = await fetch(`${baseUrl}/api/weakness`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error(String(response.status));
    const rows = weaknessSchema.parse(await response.json());
    return Object.fromEntries(rows.map((row) => [row.topic, row.hints]));
  } catch {
    return {};
  }
}

async function post(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // the drill keeps working without the server; the record is simply lost
  }
}

export const recordAttempt = (attempt: RecordAttempt) => post('/api/attempts', attempt);
export const recordHint = (hint: RecordHint) => post('/api/hints', hint);
