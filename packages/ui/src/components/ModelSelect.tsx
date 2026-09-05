import { useState, useRef, useEffect, useCallback } from 'react';

interface ModelSelectProps {
  models: string[];
  value: string;
  onChange: (model: string) => void;
}

function parseModel(full: string): { provider: string; model: string } {
  const slash = full.indexOf('/');
  if (slash === -1) return { provider: full, model: '' };
  return { provider: full.slice(0, slash), model: full.slice(slash + 1) };
}

export function ModelSelect({ models, value, onChange }: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = models.filter((m) =>
    m.toLowerCase().includes(search.toLowerCase()),
  );

  // Clamp highlight index when filtered list changes
  const safeIdx = Math.min(highlightIdx, Math.max(0, filtered.length - 1));

  const selectModel = useCallback(
    (model: string) => {
      onChange(model);
      setSearch('');
      setOpen(false);
    },
    [onChange],
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[safeIdx]) selectModel(filtered[safeIdx]!);
        break;
      case 'Escape':
        setOpen(false);
        setSearch('');
        break;
    }
  };

  const displayValue = value
    ? (() => {
        const p = parseModel(value);
        return `${p.provider}/${p.model}`;
      })()
    : '';

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1">Model</label>
      <input
        ref={inputRef}
        type="text"
        value={open ? search : displayValue}
        placeholder="Search models..."
        onChange={(e) => {
          setSearch(e.target.value);
          setHighlightIdx(0);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setSearch('');
          setHighlightIdx(0);
        }}
        onKeyDown={handleKeyDown}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-600 text-sm"
      />

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-700 rounded shadow-lg max-h-60 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No models found</div>
          ) : (
            filtered.map((m, i) => {
              const { provider, model } = parseModel(m);
              return (
                <button
                  key={m}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-baseline gap-1.5 ${
                    i === safeIdx ? 'bg-blue-900/50 text-white' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectModel(m);
                  }}
                  onMouseEnter={() => setHighlightIdx(i)}
                >
                  <span className="font-semibold text-white shrink-0">{provider}</span>
                  <span className="text-gray-400 truncate">{model}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}