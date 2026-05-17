import { Component, JSX, Show } from 'solid-js';

interface ButtonProps {
  children: JSX.Element;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  class?: string;
  type?: 'button' | 'submit';
  /** Custom data-testid; defaults to "button" for backwards compat */
  testId?: string;
}

const Button: Component<ButtonProps> = (props) => {
  const variantClasses = () => {
    switch (props.variant ?? 'primary') {
      case 'secondary':
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300';
      case 'ghost':
        return 'bg-transparent text-gray-600 hover:bg-gray-100';
      default:
        return 'bg-mkz-primary text-white hover:bg-mkz-secondary';
    }
  };

  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.loading || props.disabled}
      class={`px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses()} ${props.class ?? ''}`}
      data-testid={props.testId ?? 'button'}
    >
      <Show when={!props.loading} fallback={
        <span class="flex items-center gap-2">
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </span>
      }>
        {props.children}
      </Show>
    </button>
  );
};

export default Button;
