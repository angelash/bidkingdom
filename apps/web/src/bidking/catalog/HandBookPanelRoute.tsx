import { codexCatalogItems } from './codexRuntime';
import { HandBookPanel } from './HandBookPanel';

export default function HandBookPanelRoute({ onClose }: { onClose: () => void }): JSX.Element {
  return <HandBookPanel items={codexCatalogItems} onClose={onClose} />;
}
