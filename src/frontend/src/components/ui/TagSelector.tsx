interface TagSelectorProps {
  label: string;
  tags: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  max?: number;
}

export function TagSelector({ label, tags, selected, onChange, max }: TagSelectorProps) {
  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter(t => t !== tag));
    } else if (!max || selected.length < max) {
      onChange([...selected, tag]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground mb-2">
        {label}
        {max && <span className="text-xs ml-1 opacity-60">(max {max})</span>}
        {selected.length > 0 && <span className="text-xs ml-2 text-primary">{selected.length} valda</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => {
          const isSelected = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-primary border-primary text-white'
                  : 'bg-transparent border-border text-muted-foreground hover:border-primary hover:text-primary'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
