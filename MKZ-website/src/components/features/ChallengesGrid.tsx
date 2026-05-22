import { Component, createSignal, For, Show } from 'solid-js';
import ProfileStack from '../common/ProfileStack';
import ChallengeExpanded from './ChallengeExpanded';
import Button from '../common/Button';
import Icon from '../common/Icon';

// Types for challenge data
export interface ChallengePreview {
  id: number;
  name: string;
  goal: string;
  type: 'regions' | 'highscore' | 'timed' | 'composite';
  participants: { name: string; imageUrl?: string | null }[];
  participantCount: number;
  progress: ChallengeProgress;
  timeFrameEnd?: string | null;
}

export type ChallengeProgress = | { type: 'regions'; found: number; total: number; foundRegions: string[] } | {
  type: 'highscore';
  topScore: number;
  topUser: string
} | { type: 'timed'; endTime: string } | {
  type: 'composite';
  completed: number;
  total: number;
  items: { name: string; found: boolean }[]
};

// Mock data for development
const MOCK_CHALLENGES: ChallengePreview[] = [{
  id: 1,
  name: 'Germany / Regions',
  goal: 'Collect as many regions as possible',
  type: 'regions',
  participants: [{ name: 'Alice', imageUrl: null }, { name: 'Bob', imageUrl: null }, {
    name: 'Charlie',
    imageUrl: null,
  }, { name: 'Dave', imageUrl: null }, { name: 'Eve', imageUrl: null }],
  participantCount: 5,
  progress: { type: 'regions', found: 7, total: 16, foundRegions: ['BY', 'BW', 'NRW', 'HE', 'NI', 'SH', 'HH'] },
}, {
  id: 2,
  name: 'Rarest Plate of the Week',
  goal: 'Find the rarest plate',
  type: 'highscore',
  participants: [{ name: 'Alice', imageUrl: null }, { name: 'Bob', imageUrl: null }],
  participantCount: 14,
  progress: { type: 'highscore', topScore: 200, topUser: 'Bob' },
  timeFrameEnd: '2026-05-22T23:59:00Z',
}, {
  id: 3,
  name: 'Find 5 Different Regions',
  goal: 'Find plates from 5 different German regions',
  type: 'composite',
  participants: [{ name: 'Max', imageUrl: null }],
  participantCount: 8,
  progress: {
    type: 'composite',
    completed: 3,
    total: 5,
    items: [{ name: 'Bayern', found: true }, { name: 'Berlin', found: true }, {
      name: 'Hamburg',
      found: true,
    }, { name: 'Hessen', found: false }, { name: 'Sachsen', found: false }],
  },
}];

const ChallengesGrid: Component = () => {
  const [expandedId, setExpandedId] = createSignal<number | null>(null);
  const challenges = () => MOCK_CHALLENGES; // TODO: Replace with API data

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId() === id ? null : id);
  };

  return (<section data-testid="challenges-grid" class="">
      <h2
        class="text-lg font-semibold text-gray-800 w-fit mb-4 drop-shadow bg-white/40 backdrop-blur-lg rounded-xl p-3 pointer-events-none select-none">
        Your Challenges - 🚧 under construction
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pointer-events-auto">
        <For each={challenges()}>
          {(challenge) => (<ChallengeCard
              challenge={challenge}
              expanded={expandedId() === challenge.id}
              onToggle={() => toggleExpand(challenge.id)}
            />)}
        </For>
      </div>
    </section>);
};

// ─── Challenge Card ─────────────────────────────────────────────────

interface ChallengeCardProps {
  challenge: ChallengePreview;
  expanded: boolean;
  onToggle: () => void;
}

const ChallengeCard: Component<ChallengeCardProps> = (props) => {
  return (<div
      class={`bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/40 overflow-hidden transition-all duration-300 ${props.expanded
        ? 'md:col-span-2 lg:col-span-3' : ''}`}
      data-testid="challenge-card"
    >
      {/* Card header (always visible) */}
      <Button
        onClick={props.onToggle}
        variant="ghost"
        class="w-full p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-gray-800 truncate">{props.challenge.name}</h3>
            <p class="text-sm text-gray-500 mt-0.5 truncate">{props.challenge.goal}</p>
          </div>
          <div class="flex items-center gap-2 ml-3">
            <ProfileStack
              players={props.challenge.participants}
              maxVisible={3}
            />
          </div>
        </div>

        {/* Progress preview */}
        <div class="mt-3">
          <ProgressPreview progress={props.challenge.progress} timeEnd={props.challenge.timeFrameEnd}/>
        </div>
      </Button>

      {/* Expanded detail view */}
      <Show when={props.expanded}>
        <div class="border-t border-gray-100 p-4">
          <ChallengeExpanded challenge={props.challenge}/>
        </div>
      </Show>
    </div>);
};

// ─── Progress Preview ───────────────────────────────────────────────

interface ProgressPreviewProps {
  progress: ChallengeProgress;
  timeEnd?: string | null;
}

const ProgressPreview: Component<ProgressPreviewProps> = (props) => {
  return (<div data-testid="progress-preview">
      {props.progress.type === 'regions' && (<div>
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="text-gray-500">Regions found</span>
            <span class="font-medium text-gray-700">{props.progress.found}/{props.progress.total}</span>
          </div>
          <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-mkz-primary rounded-full transition-all duration-500"
              style={{ width: `${(props.progress.found / props.progress.total) * 100}%` }}
            />
          </div>
        </div>)}

      {props.progress.type === 'highscore' && (<div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="star" class="w-4 h-4 text-amber-500" />
            <span class="text-sm font-medium">{props.progress.topUser}: {props.progress.topScore}</span>
          </div>
          <Show when={props.timeEnd}>
            <TimeRemaining endTime={props.timeEnd!}/>
          </Show>
        </div>)}

      {props.progress.type === 'timed' && (<TimeRemaining endTime={props.progress.endTime}/>)}

      {props.progress.type === 'composite' && (<div class="flex items-center gap-1.5">
          <For each={props.progress.items}>
            {(item) => (<div
                class={`w-3 h-3 rounded-full ${item.found ? 'bg-mkz-primary' : 'bg-gray-200'}`}
                title={item.name}
              />)}
          </For>
          <span class="text-xs text-gray-500 ml-2">
            {props.progress.completed}/{props.progress.total}
          </span>
        </div>)}
    </div>);
};

// ─── Time Remaining ─────────────────────────────────────────────────

const TimeRemaining: Component<{ endTime: string }> = (props) => {
  const remaining = () => {
    const end = new Date(props.endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  return (<span class="text-xs text-gray-500  px-2 py-0.5 rounded-full">
      <Icon name="clock" /> {remaining()}
    </span>);
};

export default ChallengesGrid;
