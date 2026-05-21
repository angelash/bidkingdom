import { createBitKingdomServer } from './serverApp';

const port = Number(process.env.BITKINGDOM_PORT ?? 8787);
const host = process.env.BITKINGDOM_HOST ?? '0.0.0.0';

const { app } = await createBitKingdomServer();

await app.listen({ port, host });
