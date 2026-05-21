import { validateBidKingParity } from './parity';

const failures = validateBidKingParity();

if (failures.length > 0) {
  console.error(`BidKing compatibility validation failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('BidKing compatibility validation passed.');
