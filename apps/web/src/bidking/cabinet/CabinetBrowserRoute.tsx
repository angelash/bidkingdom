import type { PlayerProfile } from '@bitkingdom/shared';
import { codexCatalogItems } from '../catalog/codexRuntime';
import { CabinetBrowser } from './CabinetBrowser';

export default function CabinetBrowserRoute({
  profile,
  onSellAllCabinetItems
}: {
  profile: PlayerProfile;
  onSellAllCabinetItems: () => void;
}): JSX.Element {
  return (
    <CabinetBrowser
      items={codexCatalogItems}
      profile={profile}
      onSellAllCabinetItems={onSellAllCabinetItems}
    />
  );
}
