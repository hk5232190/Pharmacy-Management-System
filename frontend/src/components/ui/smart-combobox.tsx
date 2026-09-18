import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { Input } from './input';

export interface SmartComboboxProps {
  options: { value: number | string; label: string }[];
  value: number | string | undefined;
  onChange: (value: number | string) => void;
  onCreateNew?: (inputValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function SmartCombobox({
  options,
  value,
  onChange,
  onCreateNew,
  placeholder = 'Select or type to add...',
  disabled = false,
  className,
  id,
}: SmartComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value with selected option label when closed
  useEffect(() => {
    if (!isOpen) {
      const selectedOption = options.find((o) => o.value === value);
      setInputValue(selectedOption ? selectedOption.label : '');
    }
  }, [value, isOpen, options]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  const exactMatch = options.find((o) => o.label.toLowerCase() === inputValue.toLowerCase());
  const showCreate = onCreateNew && inputValue.trim() !== '' && !exactMatch;
  const totalItems = filteredOptions.length + (showCreate ? 1 : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission
      if (isOpen && activeIndex >= 0) {
        if (activeIndex < filteredOptions.length) {
          onChange(filteredOptions[activeIndex].value);
          setIsOpen(false);
          // Let the form tab focus logic handle next field, or we can just blur
          inputRef.current?.blur();
        } else if (showCreate) {
          onCreateNew!(inputValue.trim());
          setIsOpen(false);
          inputRef.current?.blur();
        }
      } else if (isOpen && filteredOptions.length > 0 && !showCreate) {
        // Auto select the top option if enter is pressed while open but not highlighted
        onChange(filteredOptions[0].value);
        setIsOpen(false);
        inputRef.current?.blur();
      } else if (isOpen && showCreate) {
          onCreateNew!(inputValue.trim());
          setIsOpen(false);
          inputRef.current?.blur();
      } else {
        setIsOpen(!isOpen);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("relative w-full", className)} ref={wrapperRef}>
      <div className="relative">
        <Input
          id={id}
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-8 bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 cursor-pointer" onClick={() => !disabled && setIsOpen(!isOpen)} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-60 overflow-auto animate-in fade-in-80 slide-in-from-top-1">
          {filteredOptions.length === 0 && !showCreate && (
            <div className="px-2 py-3 text-sm text-center text-muted-foreground">No results found.</div>
          )}
          {filteredOptions.map((option, index) => (
            <div
              key={option.value}
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                activeIndex === index && "bg-accent text-accent-foreground"
              )}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {value === option.value && <Check className="h-4 w-4" />}
              </span>
              {option.label}
            </div>
          ))}
          {showCreate && (
            <div
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-2 pr-2 text-sm font-medium text-primary hover:bg-accent hover:text-accent-foreground",
                activeIndex === (filteredOptions.length) && "bg-accent text-accent-foreground"
              )}
              onClick={() => {
                onCreateNew!(inputValue.trim());
                setIsOpen(false);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add &quot;{inputValue}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
