import { Component, Show } from 'solid-js';
import Icon from './Icon';

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
      case 'sm':
        return 'h-8 text-sm px-2';
      case 'lg':
        return 'h-16 text-3xl px-4';
      default:
        return 'h-12 text-xl px-3';
    }
  };

  return (<div
      class="grid auto-cols-max grid-flow-col gap-0 items-stretch rounded-md border-2 border-plate-border overflow-hidden shadow-md"
      data-testid="license-plate"
    >
      {/* EU blue strip */}
      <div class="bg-plate-blue flex flex-col items-center justify-center px-2">
        <Icon name="star" class="text-amber-400" />
        <span class="text-white font-bold text-xl">D</span>
      </div>

      {/* Plate content */}
      <Show
        when={props.editable}
        fallback={<div class={`bg-plate-bg flex items-center font-mono font-bold tracking-wider ${sizeClasses()}`}>
          {props.text || '\u00A0'}
        </div>}
      >
        <input
          type="text"
          value={props.text}
          placeholder={props.placeholder ?? 'M AB 1234'}
          onInput={(e) => props.onInput?.(e.currentTarget.value.toUpperCase())}
          class={`bg-plate-bg font-mono font-bold tracking-wider outline-none uppercase ${sizeClasses()} min-w-2 max-w-[17ch] pointer-events-auto`}
          data-testid="license-plate-input"
        />
      </Show>
    </div>);
};

export default LicensePlate;
