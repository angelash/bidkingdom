import {
  itemTypeFilterOptions,
  type BidKingItemTypeFilterId,
  type BidKingItemTypeFilterScope
} from './itemTypeFilterRuntime';

interface ItemTypeFilterStripProps {
  selected: BidKingItemTypeFilterId;
  scope: BidKingItemTypeFilterScope;
  onSelect: (filterId: BidKingItemTypeFilterId) => void;
}

export function ItemTypeFilterStrip({ selected, scope, onSelect }: ItemTypeFilterStripProps): JSX.Element {
  return (
    <div className="item-type-filter-strip">
      {itemTypeFilterOptions(scope).map((option) => (
        <button
          className={selected === option.id ? 'selected' : ''}
          key={`${scope}_${option.id}`}
          onClick={() => onSelect(option.id)}
          title={option.detail}
          type="button"
        >
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
