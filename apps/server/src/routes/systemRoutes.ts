import { DirtyWords, ErrorCode, Guide, LanguageName, Notice, Sound } from '@bitkingdom/bidking-compat';
import { gameConfig } from '@bitkingdom/config';
import { MATCH_CORE_READY } from '@bitkingdom/match-core';
import type { FastifyInstance } from 'fastify';
import { containsDirtyWord, sanitizeText } from '../domain/system/textGuard';

export function registerSystemRoutes(app: FastifyInstance): void {
  app.get('/health', async () => ({
    ok: true,
    service: 'bitkingdom-server',
    matchCoreReady: MATCH_CORE_READY
  }));

  app.get('/api/config/public', async () => ({
    roles: gameConfig.roles,
    rules: gameConfig.rules,
    containerCount: gameConfig.containers.length,
    itemCount: gameConfig.items.length
  }));

  app.get('/api/bootstrap', async () => ({
    configVersion: 'bidking-compat-52',
    service: 'bitkingdom-server',
    features: {
      profile: true,
      tickets: true,
      shop: true,
      shopRefresh: true,
      giftPackage: true,
      demoPay: true,
      mail: true,
      missions: true,
      rank: true,
      market: true,
      guild: true,
      system: true
    },
    system: {
      dirtyWordCount: DirtyWords.length,
      notices: Notice.slice(0, 6).map((row) => ({
        id: row.id,
        title: row.packaged_name,
        body: row.packaged_desc,
        type: row.columns[4] ?? ''
      })),
      guides: Guide.slice(0, 8).map((row) => ({
        id: row.id,
        title: row.packaged_name,
        targetWindow: row.columns[11] ?? '',
        targetNode: row.columns[12] ?? '',
        position: row.columns[10] ?? ''
      })),
      sounds: Sound.slice(0, 12).map((row) => ({
        id: row.Id,
        name: row.Name,
        path: row.FullPathName,
        type: row.Type,
        loop: row.IsLoop === 1
      })),
      languageNameCount: LanguageName.length,
      errorCodes: ErrorCode.slice(0, 8).map((row) => ({
        id: row.id,
        code: row.columns[3] ?? row.id,
        message: row.packaged_name
      }))
    }
  }));

  app.post<{
    Body: { text?: string };
  }>('/api/text/validate', async (request) => {
    const text = request.body.text ?? '';
    return {
      ok: !containsDirtyWord(text),
      sanitized: sanitizeText(text),
      dirty: containsDirtyWord(text)
    };
  });
}
