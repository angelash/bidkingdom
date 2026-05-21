import { gameConfig } from './data';
import { validateGameConfig } from './validateGameConfig';

const result = validateGameConfig(gameConfig);

if (!result.ok) {
  console.error('Config validation failed:');
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Config validation passed: ${gameConfig.roles.length} roles, ${gameConfig.items.length} items, ${gameConfig.containers.length} containers.`
);
