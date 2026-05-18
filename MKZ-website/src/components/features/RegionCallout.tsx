/**
 * RegionCallout — callout box showing region details.
 *
 * Displays region name, Bundesland, plate count, and a cycling fun fact.
 * Connected by a leader line with horizontal elbow connector.
 * Shows only one info item at a time; idle animation cycles fun facts.
 */
import { Component, Show, createSignal, createEffect, onCleanup } from 'solid-js';

export interface RegionData {
  code: string;
  districtName: string;
  bundesland: string;
  plateCount: number;
  funFacts: string[];
}

interface RegionCalloutProps {
  region: RegionData | null;
}

const FUN_FACT_INTERVAL = 5000;

const RegionCallout: Component<RegionCalloutProps> = (props) => {
  const [factIndex, setFactIndex] = createSignal(0);

  // Cycle through fun facts
  createEffect(() => {
    const region = props.region;
    if (!region || region.funFacts.length <= 1) return;

    setFactIndex(0);
    const timer = setInterval(() => {
      setFactIndex((i) => (i + 1) % region.funFacts.length);
    }, FUN_FACT_INTERVAL);

    onCleanup(() => clearInterval(timer));
  });

  return (
    <Show when={props.region}>
      {(region) => (
        <div data-testid="region-callout" class="region-callout flex items-start gap-3">
          {/* Leader line connector */}
          <div data-testid="leader-line" class="leader-line flex items-center self-stretch">
            <div class="w-6 h-0.5 bg-gray-300" />
            <div class="w-0.5 h-full bg-gray-300 min-h-8" />
            <div class="w-3 h-0.5 bg-gray-300" />
          </div>

          {/* Callout content */}
          <div class="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/60 shadow-md px-4 py-3 min-w-48 max-w-72">
            {/* Region name */}
            <h3 class="text-sm font-bold text-gray-900 leading-tight">
              {region().districtName}
            </h3>

            {/* Bundesland */}
            <p class="text-xs text-gray-500 mt-0.5">
              {region().bundesland}
            </p>

            {/* Plate count */}
            <p class="text-xs text-mkz-primary font-medium mt-1.5">
              <span class="inline-flex items-center gap-1">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
                </svg>
                {region().plateCount} registered plates
              </span>
            </p>

            {/* Fun fact */}
            <div class="mt-2 pt-2 border-t border-gray-100">
              <p data-testid="fun-fact" class="text-xs text-gray-600 italic leading-relaxed">
                {region().funFacts[factIndex()]}
              </p>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default RegionCallout;
