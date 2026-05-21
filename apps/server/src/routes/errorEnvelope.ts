import type { FastifyInstance } from 'fastify';
import { apiErrorEnvelope } from '../domain/system/errorCodeCatalog';

export function registerErrorEnvelope(app: FastifyInstance): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    if (reply.statusCode < 400 || typeof payload !== 'string') {
      return payload;
    }
    const record = parseJsonObject(payload);
    if (!record || typeof record.error !== 'string' || typeof record.errorCode === 'string') {
      return payload;
    }
    return JSON.stringify({
      ...record,
      ...apiErrorEnvelope(record.error)
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error && error.message ? error.message : 'internal server error';
    reply.code(500).send(apiErrorEnvelope(message));
  });
}

function parseJsonObject(payload: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}
