import { Component, Show } from 'solid-js';

interface LicensePlateProps {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  onInput?: (value: string) => void;
  placeholder?: string;
}

const LicensePlate: Component<LicensePlateProps> = (props) => {
  const sizeClasses = () => {
    switch (props.size ?? 'md') {
      case 'sm': return 'h-8 text-sm px-2';
      case 'lg': return 'h-16 text-3xl px-4';
      default:   return 'h-12 text-xl px-3';
    }
  };

  return (
    <div
      class="inline-flex items-stretch rounded-md border-2 border-plate-border overflow-hidden shadow-md"
      data-testid="license-plate"
    >
      {/* EU blue strip */}
      <div class="bg-plate-blue flex flex-col items-center justify-center px-2">
        <svg class="w-4 h-4 mb-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,16.5 5.5,21 7.5,14 2,9 9,9" fill="#FBBF24" />
        </svg>
        <span class="text-white font-bold text-xl">D</span>
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
          class={`bg-plate-bg font-mono font-bold tracking-wider outline-none uppercase ${sizeClasses()} min-w-25 max-w-[17ch]`}
          data-testid="license-plate-input"
        />
      </Show>
    </div>
  );
};

export default LicensePlate;
