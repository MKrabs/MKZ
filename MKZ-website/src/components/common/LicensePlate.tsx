import { Component, Show } from 'solid-js';

interface LicensePlateProps {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  onInput?: (value: string) => void;
  placeholder?: string;
}

/**
 * Renders text styled like a European license plate.
 * Blue strip on the left (EU stars), white background, monospace black text.
 */
const LicensePlate: Component<LicensePlateProps> = (props) => {
  const sizeClasses = () => {
    switch (props.size ?? 'md') {
      case 'sm': return 'h-8 text-sm px-2';
      case 'lg': return 'h-16 text-3xl px-4';
      default: return 'h-12 text-xl px-3';
    }
  };

  return (
    <div class="inline-flex items-stretch rounded-md border-2 border-plate-border overflow-hidden shadow-md" data-testid="license-plate">
      {/* EU blue strip */}
      <div class="bg-plate-blue flex items-center justify-center px-2">
        <span class="text-white text-xs font-bold">D</span>
      </div>
      {/* Plate content */}
      <Show
        when={props.editable}
        fallback={
          <div class={`bg-plate-bg flex items-center font-mono font-bold tracking-wider ${sizeClasses()}`}>
            {props.text || '\u00A0'}
          </div>
        }
      >
        <input
          type="text"
          value={props.text}
          placeholder={props.placeholder ?? 'M AB 1234'}
          onInput={(e) => props.onInput?.(e.currentTarget.value.toUpperCase())}
          class={`bg-plate-bg font-mono font-bold tracking-wider outline-none uppercase ${sizeClasses()} min-w-25 max-w-[20ch]`}
          data-testid="license-plate-input"
        />
      </Show>
    </div>
  );
};

export default LicensePlate;
