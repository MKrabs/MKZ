/**
 * IdleController — manages idle animations for the MKZ app.
 *
 * Three idle tiers:
 * 1. Not-logged-in: types random German city names, pans map, shows details
 * 2. Logged-in no-input: uses user's recent plates (today/yesterday/last 10)
 * 3. Logged-in with-input: cycles fun facts about the current region
 *
 * Idle starts only after IDLE_TIMEOUT with no interaction.
 * Interactions: login, plate input, map drag, clicks on this component.
 */
import { Component, Show, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { useMap } from '../map/MapContext';
import { user } from '../../store/auth';
import { extractPlatePrefix } from '../../data/plateRegions';
import { BUNDESLAND_COORDS, BUNDESLAND_ZOOM } from '../../data/bundeslandCoords';
import pb from '../../lib/pb';
import { idleEnabled } from '../../store/idle';
import type { RegionData } from './RegionCallout';

// ─── Constants (exported for testing) ─────────────────────────────────────────

export const IDLE_TIMEOUT = 8000;       // ms before idle starts
export const TYPING_INTERVAL = 120;     // ms per character
const TYPING_PAUSE = 2000;              // pause after completing a word
const CITY_CYCLE_PAUSE = 5000;          // pause between cities
const FUN_FACT_CYCLE = 5000;            // cycle fun facts interval

// Random German cities for not-logged-in idle
const IDLE_CITIES = [
  'München', 'Berlin', 'Hamburg', 'Köln', 'Frankfurt',
  'Stuttgart', 'Düsseldorf', 'Dresden', 'Hannover', 'Nürnberg',
];

// ─── Component ────────────────────────────────────────────────────────────────

interface IdleControllerProps {
  /** If set, we're in "logged-in with input" mode — cycle fun facts */
  activeRegion?: RegionData | null;
}

const IdleController: Component<IdleControllerProps> = (props) => {
  const [isIdling, setIsIdling] = createSignal(false);
  const [typingText, setTypingText] = createSignal('');
  const [funFactText, setFunFactText] = createSignal('');
  const [recentPlates, setRecentPlates] = createSignal<string[]>([]);

  const mapCtx = useMap();

  let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let typingIntervalId: ReturnType<typeof setTimeout> | null = null;
  let cityIndex = 0;
  let charIndex = 0;
  let currentCities: string[] = [];
  let funFactIndex = 0;
  let funFactIntervalId: ReturnType<typeof setTimeout> | null = null;

  // ── Interaction reset ─────────────────────────────────────────────────────

  function resetIdle() {
    setIsIdling(false);
    setTypingText('');
    setFunFactText('');
    charIndex = 0;
    cityIndex = 0;

    if (idleTimeoutId) clearTimeout(idleTimeoutId);
    if (typingIntervalId) clearTimeout(typingIntervalId);
    if (funFactIntervalId) clearInterval(funFactIntervalId);
    typingIntervalId = null;
    funFactIntervalId = null;

    // Restart timeout
    idleTimeoutId = setTimeout(() => startIdle(), IDLE_TIMEOUT);
  }

  // ── Start idle ────────────────────────────────────────────────────────────

  function startIdle() {
    setIsIdling(true);

    // Determine which mode
    if (!idleEnabled()) {
      // idle globally disabled
      return;
    }

    if (props.activeRegion && props.activeRegion.funFacts.length > 0) {
      // Mode 3: cycle fun facts
      startFunFactCycle();
    } else if (user()) {
      // Mode 2: logged in, use recent plates
      fetchRecentAndType();
    } else {
      // Mode 1: not logged in, type random cities
      currentCities = shuffleArray([...IDLE_CITIES]).slice(0, 10);
      startTypingCycle();
    }
  }

  // ── Mode 1 & 2: typing animation ─────────────────────────────────────────

  function startTypingCycle() {
    if (!isIdling()) return;
    const target = currentCities[cityIndex % currentCities.length];
    if (!target) return;

    charIndex = 0;
    typeNextChar(target);
  }

  function typeNextChar(target: string) {
    if (!isIdling()) return;

    if (charIndex < target.length) {
      charIndex++;
      setTypingText(target.slice(0, charIndex));
      typingIntervalId = setTimeout(() => typeNextChar(target), TYPING_INTERVAL);
    } else {
      // Done typing this city — pan map then wait
      panToTypedCity(target);
      typingIntervalId = setTimeout(() => {
        // Clear and move to next city
        cityIndex++;
        if (isIdling()) startTypingCycle();
      }, CITY_CYCLE_PAUSE);
    }
  }

  function panToTypedCity(cityName: string) {
    // Try to find coords (simplified: check BUNDESLAND_COORDS by name)
    const coordsMap: Record<string, [number, number]> = {
      'München': [11.582, 48.135],
      'Berlin': [13.405, 52.52],
      'Hamburg': [9.993, 53.551],
      'Köln': [6.96, 50.94],
      'Frankfurt': [8.68, 50.11],
      'Stuttgart': [9.182, 48.776],
      'Düsseldorf': [6.773, 51.227],
      'Dresden': [13.738, 51.050],
      'Hannover': [9.733, 52.374],
      'Nürnberg': [11.08, 49.45],
    };
    const coords = coordsMap[cityName];
    if (coords) {
      mapCtx.flyToCoords(coords, BUNDESLAND_ZOOM, undefined);
    }
  }

  // ── Mode 2: fetch recent plates ──────────────────────────────────────────

  async function fetchRecentAndType() {
    const u = user();
    if (!u) {
      currentCities = shuffleArray([...IDLE_CITIES]).slice(0, 10);
      startTypingCycle();
      return;
    }

    try {
      // Today's plates
      const today = new Date().toISOString().split('T')[0];
      let result = await pb.collection('seen_plates').getList(1, 10, {
        filter: `user = "${u.id}" && noted_at >= "${today} 00:00:00"`,
        sort: '-noted_at',
      });

      if (result.items.length === 0) {
        // Try yesterday
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        result = await pb.collection('seen_plates').getList(1, 10, {
          filter: `user = "${u.id}" && noted_at >= "${yesterday} 00:00:00"`,
          sort: '-noted_at',
        });
      }

      if (result.items.length === 0) {
        // Last 10 regardless of date
        result = await pb.collection('seen_plates').getList(1, 10, {
          filter: `user = "${u.id}"`,
          sort: '-noted_at',
        });
      }

      const plates = result.items.map((i: any) => extractPlatePrefix(i.plate_text)).filter(Boolean);
      currentCities = plates.length > 0 ? plates : shuffleArray([...IDLE_CITIES]).slice(0, 10);
      startTypingCycle();
    } catch {
      currentCities = shuffleArray([...IDLE_CITIES]).slice(0, 10);
      startTypingCycle();
    }
  }

  // ── Mode 3: fun fact cycling ──────────────────────────────────────────────

  function startFunFactCycle() {
    const region = props.activeRegion;
    if (!region || region.funFacts.length === 0) return;

    funFactIndex = 0;
    setFunFactText(region.funFacts[0]);

    funFactIntervalId = setInterval(() => {
      funFactIndex = (funFactIndex + 1) % region.funFacts.length;
      setFunFactText(region.funFacts[funFactIndex]);
    }, FUN_FACT_CYCLE);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onMount(() => {
    idleTimeoutId = setTimeout(() => startIdle(), IDLE_TIMEOUT);
  });

  onCleanup(() => {
    if (idleTimeoutId) clearTimeout(idleTimeoutId);
    if (typingIntervalId) clearTimeout(typingIntervalId);
    if (funFactIntervalId) clearInterval(funFactIntervalId);
  });

  // Reset idle when user changes (login/logout) — skip initial run
  let firstRun = true;
  createEffect(() => {
    const _ = user();
    if (firstRun) { firstRun = false; return; }
    resetIdle();
  });

  return (
    <div
      data-testid="idle-controller"
      onClick={() => resetIdle()}
      style={{ display: 'contents' }}
    >
      {/* Typing animation display */}
      <Show when={isIdling() && typingText() && !funFactText()}>
        <div data-testid="idle-typing-text" class="idle-typing">
          {typingText()}
          <span class="idle-cursor">|</span>
        </div>
      </Show>

      {/* Fun fact display */}
      <Show when={isIdling() && funFactText()}>
        <div data-testid="idle-fun-fact" class="idle-fun-fact">
          {funFactText()}
        </div>
      </Show>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default IdleController;
