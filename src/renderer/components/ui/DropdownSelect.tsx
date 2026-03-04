import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface DropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
}

export function DropdownSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className,
  menuClassName,
  align = 'left',
}: DropdownSelectProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) return undefined;

    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  function handleToggle() {
    if (disabled) return;

    if (open) {
      setOpen(false);
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.max(rect.width, 220);
    const left = align === 'right'
      ? Math.max(12, rect.right - width)
      : Math.max(12, rect.left);

    setMenuPosition({
      top: rect.bottom + 8,
      left,
      width,
    });
    setOpen(true);
  }

  function handleSelect(option: DropdownOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'group no-drag flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border/90 bg-[color-mix(in_oklab,var(--color-card)_82%,transparent)] px-3 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl transition-colors hover:bg-accent/55 hover:border-border disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className="min-w-0 flex-1">
          {selectedOption ? (
            <span className="flex min-w-0 items-center gap-2.5">
              {selectedOption.icon && (
                <span className="shrink-0">{selectedOption.icon}</span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">
                  {selectedOption.label}
                </span>
                {selectedOption.description && (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {selectedOption.description}
                  </span>
                )}
              </span>
            </span>
          ) : (
            <span className="block truncate text-sm text-muted-foreground">
              {placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && createPortal(
        <>
          <button
            type="button"
            aria-label="Close dropdown"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />
          <div
            className={cn(
              'fixed z-50 max-h-80 overflow-auto rounded-2xl border border-border/90 bg-[color-mix(in_oklab,var(--color-card)_96%,transparent)] p-2 shadow-[0_24px_64px_rgba(0,0,0,0.28)] backdrop-blur-2xl',
              menuClassName,
            )}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              minWidth: menuPosition.width,
            }}
          >
            <div className="space-y-1">
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      option.disabled
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:bg-accent/65',
                      selected && 'bg-accent/55',
                    )}
                  >
                    <span className="min-w-0 flex items-center gap-2.5">
                      {option.icon && (
                        <span className="shrink-0">{option.icon}</span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-foreground">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </span>
                    </span>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
