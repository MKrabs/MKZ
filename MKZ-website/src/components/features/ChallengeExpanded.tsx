import { Component, For, Show } from 'solid-js';
import LicensePlate from '../common/LicensePlate';
import ProfileAvatar from '../common/ProfileAvatar';
import type { ChallengePreview } from './ChallengesGrid';
import Icon from '../common/Icon';

interface ChallengeExpandedProps {
  challenge: ChallengePreview;
}

/**
 * Expanded challenge view with full details, map, and leaderboard.
 */
const ChallengeExpanded: Component<ChallengeExpandedProps> = (props) => {
  return (<div class="space-y-4" data-testid="challenge-expanded">
      {props.challenge.progress.type === 'regions' && (<RegionsDetail progress={props.challenge.progress}/>)}
      {props.challenge.progress.type === 'highscore' && (<HighscoreDetail challenge={props.challenge}/>)}
      {props.challenge.progress.type === 'composite' && (<CompositeDetail progress={props.challenge.progress}/>)}

      {/* Leaderboard section */}
      <LeaderboardPreview challenge={props.challenge}/>
    </div>);
};

// ─── Regions Detail (Germany Map placeholder) ────────────────────────

const RegionsDetail: Component<{
  progress: Extract<import('./ChallengesGrid').ChallengeProgress, { type: 'regions' }>
}> = (props) => {
  // German state codes to names
  const REGIONS: Record<string, string> = {
    'BY': 'Bayern',
    'BW': 'Baden-Württemberg',
    'NRW': 'Nordrhein-Westfalen',
    'HE': 'Hessen',
    'NI': 'Niedersachsen',
    'SH': 'Schleswig-Holstein',
    'HH': 'Hamburg',
    'HB': 'Bremen',
    'BE': 'Berlin',
    'BB': 'Brandenburg',
    'MV': 'Mecklenburg-Vorpommern',
    'SN': 'Sachsen',
    'ST': 'Sachsen-Anhalt',
    'TH': 'Thüringen',
    'RP': 'Rheinland-Pfalz',
    'SL': 'Saarland',
  };

  return (<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Map placeholder (SVG map would go here) */}
      <div class="bg-gray-50 rounded-lg p-4 min-h-[300px] flex items-center justify-center" data-testid="germany-map">
        <div class="text-center">
          <div class="grid grid-cols-4 gap-2 mb-4">
            <For each={Object.entries(REGIONS)}>
              {([code, name]) => (<div
                  class={`px-2 py-1 rounded text-xs font-medium text-center transition-colors ${props.progress.foundRegions.includes(code)
                    ? 'bg-mkz-primary text-white' : 'bg-gray-200 text-gray-500'}`}
                  title={name}
                >
                  {code}
                </div>)}
            </For>
          </div>
          <p class="text-sm text-gray-500">
            {props.progress.found} of {props.progress.total} regions discovered
          </p>
        </div>
      </div>

      {/* Found regions list */}
      <div class="space-y-2">
        <h4 class="font-medium text-gray-700 text-sm">Discovered Regions</h4>
        <div class="space-y-1.5 max-h-[280px] overflow-y-auto">
          <For each={props.progress.foundRegions}>
            {(code) => (<div class="flex items-center gap-2 p-2 bg-green-50 rounded-md">
                <div class="w-2 h-2 bg-green-500 rounded-full"/>
                <span class="text-sm font-medium">{REGIONS[code] ?? code}</span>
              </div>)}
          </For>
        </div>
      </div>
    </div>);
};

// ─── Highscore Detail ────────────────────────────────────────────────

const HighscoreDetail: Component<{ challenge: ChallengePreview }> = (props) => {
  // Mock leaderboard data
  const entries = [{ rank: 1, name: 'Bob', plate: 'B X 1', score: 200 }, {
    rank: 2,
    name: 'Max',
    plate: 'M G 12',
    score: 135,
  }, { rank: 3, name: 'Alice', plate: 'M G 12', score: 135 }];

  return (<div class="space-y-3">
      <h4 class="font-medium text-gray-700 text-sm">Submissions</h4>
      <div class="space-y-2">
        <For each={entries}>
          {(entry) => (
            <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <span class={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${entry.rank === 1
                ? 'bg-amber-100 text-amber-700' : entry.rank === 2 ? 'bg-gray-200 text-gray-700'
                  : 'bg-orange-100 text-orange-700'}`}>
                {entry.rank}
              </span>
              <ProfileAvatar name={entry.name} size="sm"/>
              <span class="font-medium text-sm flex-1">{entry.name}</span>
              <LicensePlate text={entry.plate} size="sm"/>
              <span class="text-sm font-semibold text-gray-700">{entry.score} pts</span>
            </div>)}
        </For>
      </div>
    </div>);
};

// ─── Composite Detail ────────────────────────────────────────────────

const CompositeDetail: Component<{
  progress: Extract<import('./ChallengesGrid').ChallengeProgress, { type: 'composite' }>
}> = (props) => {
  return (<div class="space-y-2">
      <h4 class="font-medium text-gray-700 text-sm">Progress</h4>
      <div class="space-y-1.5">
        <For each={props.progress.items}>
          {(item) => (<div class="flex items-center gap-3 p-2 rounded-md bg-gray-50">
              <div class={`w-5 h-5 rounded-full flex items-center justify-center ${item.found ? 'bg-mkz-primary'
                : 'bg-gray-200'}`}>
                <Show when={item.found}>
                  <Icon name="check" class="w-3 h-3 text-white" />
                </Show>
              </div>
              <span class={`text-sm ${item.found ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                {item.name}
              </span>
            </div>)}
        </For>
      </div>
    </div>);
};

// ─── Leaderboard Preview ─────────────────────────────────────────────

const LeaderboardPreview: Component<{ challenge: ChallengePreview }> = (props) => {
  // Mock data - in production would come from API
  const scores = [{ name: 'Alice', score: 45 }, { name: 'Max', score: 38 }, { name: 'Bob', score: 22 }];
  const maxScore = () => Math.max(...scores.map(s => s.score), 1);

  return (<div class="border-t border-gray-100 pt-4">
      <h4 class="font-medium text-gray-700 text-sm mb-3">Leaderboard</h4>
      <div class="space-y-2">
        <For each={scores}>
          {(entry, idx) => (<div class="flex items-center gap-3">
              <span class="text-xs font-medium text-gray-400 w-4">{idx() + 1}</span>
              <ProfileAvatar name={entry.name} size="sm"/>
              <span class="text-sm font-medium flex-1">{entry.name}</span>
              <div class="flex-1 max-w-[120px]">
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-mkz-primary rounded-full"
                    style={{ width: `${(entry.score / maxScore()) * 100}%` }}
                  />
                </div>
              </div>
              <span class="text-sm font-semibold text-gray-700 w-8 text-right">{entry.score}</span>
            </div>)}
        </For>
      </div>
    </div>);
};

export default ChallengeExpanded;
