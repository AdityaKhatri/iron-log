import './FilterChips.css';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterChips({ options, value, onChange }: FilterChipsProps) {
  return (
    <div className="filter-chips">
      {options.map(opt => (
        <button
          key={opt.value}
          className={`filter-chip ${value === opt.value ? 'filter-chip--active' : ''}`}
          onClick={() => onChange(opt.value === value ? '' : opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
