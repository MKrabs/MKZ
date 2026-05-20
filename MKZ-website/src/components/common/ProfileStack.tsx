import { Component, For, Show } from 'solid-js';
import ProfileAvatar from './ProfileAvatar';

interface Player {
  name: string;
  imageUrl?: string | null;
}

interface ProfileStackProps {
  players: Player[];
  maxVisible?: number;
}

/**
 * Stacked profile pictures: first N visible, then "+X" counter.
 */
const ProfileStack: Component<ProfileStackProps> = (props) => {
  const maxVisible = () => props.maxVisible ?? 3;
  const visible = () => props.players.slice(0, maxVisible());
  const remaining = () => props.players.length - maxVisible();

  return (<div class="flex items-center -space-x-2" data-testid="profile-stack">
      <For each={visible()}>
        {(player) => (<ProfileAvatar
            name={player.name}
            imageUrl={player.imageUrl}
            size="sm"
          />)}
      </For>
      <Show when={remaining() > 0}>
        <div
          class="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-semibold text-gray-600"
          data-testid="profile-stack-remaining">
          +{remaining()}
        </div>
      </Show>
    </div>);
};

export default ProfileStack;
