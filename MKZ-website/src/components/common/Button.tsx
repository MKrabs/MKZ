import { Component, JSX, splitProps } from 'solid-js';
import './button.css';

interface ButtonProps {
  /** Either pass children or text */
  children?: JSX.Element;
  text?: string;
  onClick?: (e?: Event) => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'light' | 'dark' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: JSX.Element;
  iconPosition?: 'left' | 'right';
  class?: string;
  type?: 'button' | 'submit';
  testId?: string;
  [key: string]: any;
}

const Spinner = ({ class: cls = '' }: { class?: string }) => (
  <svg class={`btn__spinner ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <circle class="btn__spinner-track" cx="12" cy="12" r="10" stroke-width="2"/>
    <path class="btn__spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
  </svg>
);

const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'children', 'text', 'onClick', 'loading', 'disabled', 'variant', 'size', 'icon', 'iconPosition', 'class', 'type', 'testId'
  ]);

  const variant = local.variant ?? 'primary';
  const size = local.size ?? 'md';
  const isDisabled = !!local.disabled || !!local.loading;

  const classes = ['btn', `btn--${variant}`, `btn--${size}`, isDisabled ? 'is-disabled' : '', local.class ?? '']
    .filter(Boolean).join(' ');

  const content = (
    <>
      {local.icon && local.iconPosition !== 'right' && !local.loading ? <span class="btn__icon">{local.icon}</span> : null}
      {local.loading ? <span class="btn__loading"><Spinner/> <span>Loading…</span></span>
        : (local.children ?? local.text)}
      {local.icon && local.iconPosition === 'right' && !local.loading ? <span class="btn__icon">{local.icon}</span> : null}
    </>
  );

  return (
    <button
      type={local.type ?? 'button'}
      onClick={local.onClick}
      disabled={isDisabled}
      class={classes}
      data-testid={local.testId ?? rest['data-testid'] ?? 'button'}
      aria-busy={local.loading ? 'true' : undefined}
      {...rest}
    >
      {content}
    </button>
  );
};

export default Button;
