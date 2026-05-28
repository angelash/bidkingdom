import { applyPublicEnvDefaults } from './public-env.mjs';

applyPublicEnvDefaults();
await import('./dev-control.mjs');
