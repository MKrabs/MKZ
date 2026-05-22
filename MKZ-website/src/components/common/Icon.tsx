import { Component, splitProps } from 'solid-js';
import { FEATHER_ICONS } from '~/assets/feather-icons';

interface IconProps {
  name: string;
  class?: string;
  size?: number | string;
  strokeWidth?: number | string;
  spin?: boolean;
  ariaLabel?: string;
}

const Icon: Component<IconProps> = (props) => {
  const [local, rest] = splitProps(props, ['name','class','size','strokeWidth','spin','ariaLabel']);
  const content = FEATHER_ICONS[local.name];
  if (!content) {
    // Render nothing if icon missing (could also render a placeholder)
    return (<span aria-hidden="true" class={local.class} />) as any;
  }

  const sizeAttr = local.size ?? 16;
  const strokeW = local.strokeWidth ?? 2;
  const spinClass = local.spin ? 'animate-spin' : '';

  return (
    <svg
      class={`${local.class ?? ''} ${spinClass}`.trim()}
      width={sizeAttr}
      height={sizeAttr}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeW}
      stroke-linecap="round"
      stroke-linejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      role={local.ariaLabel ? 'img' : 'presentation'}
      aria-label={local.ariaLabel}
      innerHTML={content}
      {...rest}
    />
  );
};

export default Icon;
