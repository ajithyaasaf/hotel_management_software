import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

interface Option {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  label,
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase()) || 
    o.sublabel?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      
      <div 
        className={`input flex items-center justify-between cursor-pointer transition-all ${isOpen ? 'border-text-primary ring-1 ring-text-primary' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-text-primary font-medium' : 'text-text-secondary'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-2">
          {value && (
            <button 
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="text-text-muted hover:text-danger-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className={`text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-border-light overflow-hidden animate-scaleIn origin-top">
          <div className="p-2 border-b border-border-light bg-surface-secondary">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
              <input
                autoFocus
                className="w-full bg-white border-none rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between hover:bg-surface-secondary transition-colors ${value === option.id ? 'bg-primary-50 text-primary-600' : 'text-text-primary'}`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                >
                  <div>
                    <p className="font-medium">{option.label}</p>
                    {option.sublabel && <p className="text-xs text-text-secondary">{option.sublabel}</p>}
                  </div>
                  {value === option.id && <Check size={16} />}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-text-muted text-sm italic">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
