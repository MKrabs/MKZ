import { Component, Show } from 'solid-js';

interface ProfileAvatarProps {
  imageUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  borderColour?: string;
}

/**
 * User profile avatar with fallback to initials.
 */
const ProfileAvatar: Component<ProfileAvatarProps> = (props) => {
  const sizeClasses = () => {
    switch (props.size ?? 'md') {
      case 'sm': return 'w-8 h-8 text-xs';
      case 'lg': return 'w-16 h-16 text-xl';
      default: return 'w-10 h-10 text-sm';
    }
  };

  const initials = () => {
    return props.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const borderStyle = () => {
    if (props.borderColour) {
      return { 'border-color': props.borderColour };
    }
    return {};
  };

  return (
    <div
      class={`rounded-full border-2 border-gray-200 flex items-center justify-center overflow-hidden bg-gray-100 font-semibold text-gray-600 ${sizeClasses()}`}
      style={borderStyle()}
      title={props.name}
      data-testid="profile-avatar"
    >
      <Show
        when={props.imageUrl}
        fallback={<span>{initials()}</span>}
      >
        <img
          src={props.imageUrl!}
          alt={props.name}
          class="w-full h-full object-cover"
        />
      </Show>
    </div>
  );
};

export default ProfileAvatar;
