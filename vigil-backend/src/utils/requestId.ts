import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';

export function generateRequestId(req: IncomingMessage) {
  const existing = req.headers['x-request-id'];
  if (typeof existing === 'string' && existing.length > 0) return existing;
  return randomUUID();
}
