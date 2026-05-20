import { Component, createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { fetchGeoRegions, type KennzeichenRecord, lookupCode } from '~/api/kennzeichen';
import {
  checkSeen, getSeenImageUrl, markSeen, removeSeen, removeSeenImage, type SeenPlateRecord, updateSeenImage,
} from '~/api/seenPlates';
import { HOME_PLACEHOLDER, IDLE_CODE_EVENT, type IdlePlateCodeEvent } from '~/components/features/IdleController';
import { useMap } from '~/components/map';
import MapRegionHighlighter from '~/components/map/MapRegionHighlighter';
import { extractPlatePrefix } from '~/data/plateRegions';
import { user } from '~/store/auth';
import Button from '../common/Button';
import LicensePlate from '../common/LicensePlate';
import LoginNudge from '../common/LoginNudge';

// ─── Constants ────────────────────────────────────────────────────────────────

const LOOKUP_DEBOUNCE = 400;
const REGION_ZOOM = 9;

const NO_PHOTO_MSGS = ["🕵️ On the record — but where's the photo?", '📋 Logged, but the jury needs proof!', "🫣 You say you saw it... sure, buddy.", '📝 Noted, but evidence is pending.', '🤔 Trust me bro? Snap a pic!', '🎩 On file — now make it official.', '📵 Words without a photo = just a rumour.', '👀 Spotted? Prove it!'];

const HAS_PHOTO_MSGS = ['📸 Full documentation — legend!', '🏅 Caught on camera!', '✅ Spotted AND photographed!', '🎯 Evidence locked in!', '🔍 Documented and verified!'];

function pickMsg(msgs: string[], text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) & 0xffff;
  return msgs[hash % msgs.length];
}

// ─── Centroid helpers ─────────────────────────────────────────────────────────

/**
 * Flatten any GeoJSON geometry (Polygon or MultiPolygon) into a flat
 * list of [lon, lat] coordinate pairs from the outer rings only.
 */
function flattenCoords(geometry: any): [number, number][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    // First ring = outer ring
    return geometry.coordinates[0] as [number, number][];
  }
  if (geometry.type === 'MultiPolygon') {
    // Outer ring of each polygon
    return (geometry.coordinates as number[][][][])
      .flatMap((poly) => poly[0] as [number, number][]);
  }
  return [];
}

/**
 * Compute the simple bounding-box centre of a set of [lon, lat] pairs.
 * Good enough for panning — no need for a full centroid algorithm.
 */
function bboxCenter(coords: [number, number][]): [number, number] | null {
  if (coords.length === 0) return null;
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

/**
 * Given an array of GeoRegionRecords, compute the overall bounding-box
 * centre across all their geometries. Handles multi-region codes (KA etc.)
 * by finding the centre of the combined extent.
 */
function regionsCenter(regions: { low: any }[]): [number, number] | null {
  const allCoords = regions.flatMap((r) => flattenCoords(r.low));
  return bboxCenter(allCoords);
}

// ─── Component ────────────────────────────────────────────────────────────────

const PlateSubmission: Component = () => {
  const [plateText, setPlateText] = createSignal('');
  const [pendingImage, setPendingImage] = createSignal<File | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = createSignal(false);
  const [lookupLoading, setLookupLoading] = createSignal(false);
  const [kennzeichen, setKennzeichen] = createSignal<KennzeichenRecord | null>(null);
  const [seenRecord, setSeenRecord] = createSignal<SeenPlateRecord | null>(null);
  const [lastCheckedPrefix, setLastCheckedPrefix] = createSignal('');
  const [lastCheckedText, setLastCheckedText] = createSignal('');

  let previewRef: HTMLDivElement | undefined;
  let imageInputRef: HTMLInputElement | undefined;
  let updateImageInputRef: HTMLInputElement | undefined;
  let lookupTimer: ReturnType<typeof setTimeout> | null = null;

  const mapCtx = useMap();

  function computePreviewOffset(): [number, number] {
    if (!previewRef) return [0, 0];
    const r = previewRef.getBoundingClientRect();
    return [r.left + r.width / 2 - window.innerWidth / 2, r.top + r.height / 2 - window.innerHeight / 2];
  }

  function clearLookup() {
    if (lookupTimer) {
      clearTimeout(lookupTimer);
      lookupTimer = null;
    }
    setKennzeichen(null);
    setSeenRecord(null);
    setLastCheckedPrefix('');
    setLastCheckedText('');
  }

  async function performLookup(text: string) {
    const prefix = extractPlatePrefix(text);
    if (!prefix) {
      clearLookup();
      return;
    }

    const prefixChanged = prefix !== lastCheckedPrefix();
    setLastCheckedPrefix(prefix);
    setLastCheckedText(text);
    setLookupLoading(true);

    try {
      const [kz, seen] = await Promise.all([prefixChanged ? lookupCode(prefix) : Promise.resolve(kennzeichen()), user()
        ? checkSeen(user()!.id, text) : Promise.resolve(null)]);

      if (prefixChanged) {
        setKennzeichen(kz);

        if (kz) {
          // Fetch geo regions to get the actual geometry for panning.
          // fetchGeoRegions is also called by MapRegionHighlighter — the
          // PocketBase SDK will deduplicate in-flight identical requests.
          const regions = await fetchGeoRegions(kz.id, 'low');
          const center = regionsCenter(regions);
          if (center) {
            mapCtx.flyToCoords(center, REGION_ZOOM, computePreviewOffset());
          }
        }
      }

      setSeenRecord(kz ? seen : null);
    } finally {
      setLookupLoading(false);
    }
  }

  function scheduleLookupFor(rawText: string) {
    if (lookupTimer) clearTimeout(lookupTimer);
    const text = rawText.trim().toUpperCase();
    lookupTimer = setTimeout(() => void performLookup(text), LOOKUP_DEBOUNCE);
  }

  createEffect(() => {
    const raw = plateText();
    raw.trim() !== '' ? scheduleLookupFor(raw) : clearLookup();
  });

  onMount(() => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
    if (!input) return;
    const onIdleCode = (e: Event) => {
      const { code, active } = (e as IdlePlateCodeEvent).detail;
      if (!active || code === '') {
        clearLookup();
        return;
      }
      scheduleLookupFor(code);
    };
    input.addEventListener(IDLE_CODE_EVENT, onIdleCode);
    onCleanup(() => input.removeEventListener(IDLE_CODE_EVENT, onIdleCode));
  });

  // ── Mark seen ─────────────────────────────────────────────────────────────

  const handleMarkSeen = async () => {
    const kz = kennzeichen();
    const u = user();
    const text = plateText().trim().toUpperCase();
    if (!kz || !u || !text) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const record = await markSeen(u.id, kz.id, text, pendingImage() ?? undefined);
      setSeenRecord(record);
      clearPendingImage();
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('unique') || msg.includes('constraint')) {
        setSeenRecord(await checkSeen(u.id, text));
      } else {
        setSubmitError('Could not save. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Image helpers ─────────────────────────────────────────────────────────

  function clearPendingImage() {
    if (pendingImageUrl()) URL.revokeObjectURL(pendingImageUrl()!);
    setPendingImage(null);
    setPendingImageUrl(null);
    if (imageInputRef) imageInputRef.value = '';
  }

  const handlePendingImageSelect = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (pendingImageUrl()) URL.revokeObjectURL(pendingImageUrl()!);
    setPendingImage(file);
    setPendingImageUrl(URL.createObjectURL(file));
    setSubmitError(null);
  };

  const handleAddPhoto = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    const rec = seenRecord();
    if (!file || !rec) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      setSeenRecord(await updateSeenImage(rec.id, file));
    } catch {
      setSubmitError('Could not upload photo. Try again.');
    } finally {
      setSubmitting(false);
      if (updateImageInputRef) updateImageInputRef.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    const rec = seenRecord();
    if (!rec?.image) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      setSeenRecord(await removeSeenImage(rec.id, rec.image));
    } catch {
      setSubmitError('Could not remove photo. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveEntry = async () => {
    const rec = seenRecord();
    if (!rec) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await removeSeen(rec.id);
      setSeenRecord(null);
    } catch {
      setSubmitError('Could not remove. Try again.');
    } finally {
      setSubmitting(false);
    }
  };


  return (<div class="grid md:grid-cols-2 gap-4 lg:mt-48 md:mt-32" data-testid="plate-submission">
      <div class="bg-white/40 backdrop-blur-sm rounded-xl shadow-lg border border-white/40 p-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">Submit a Plate</h2>
        <div class="flex flex-col gap-4">

          <div class="flex justify-center">
            <LicensePlate
              text={plateText()}
              editable
              onInput={(v) => {
                setPlateText(v);
                setSubmitError(null);
                setSubmitSuccess(false);
              }}
              size="lg"
              placeholder={HOME_PLACEHOLDER}
            />
          </div>

          <Show when={kennzeichen()}>
            <div class="flex items-start gap-3 bg-blue-50/80 rounded-lg px-4 py-3 border border-blue-100/60"
                 data-testid="region-info">
              <svg class="w-5 h-5 text-mkz-primary shrink-0 mt-0.5" fill="none" stroke="currentColor"
                   viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate">{kennzeichen()!.district_name}</p>
                <p class="text-xs text-gray-500">
                  {kennzeichen()!.bundesland}
                  {kennzeichen()!.derivation ? ` · ${kennzeichen()!.derivation}` : ''}
                </p>
                <Show when={!kennzeichen()!.active}>
                  <p class="text-xs text-amber-600 mt-0.5">⚠️ Phased-out code</p>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={lastCheckedPrefix() && !kennzeichen() && !lookupLoading()}>
            <p class="text-sm text-gray-400 text-center" data-testid="unknown-prefix">
              Unknown plate prefix "{lastCheckedPrefix()}"
            </p>
          </Show>

          <Show when={kennzeichen()}>
            <Show when={!user()}>
              <div data-testid="sign-in-to-collect">
                <LoginNudge/>
              </div>
            </Show>

            <Show when={user()}>
              <Show when={!seenRecord()}>
                <Show
                  when={pendingImageUrl()}
                  fallback={<label
                    class="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600 w-fit">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Add proof photo (optional)
                    <input ref={imageInputRef} type="file" accept="image/*" class="hidden"
                           onChange={handlePendingImageSelect} data-testid="image-upload-input"/>
                  </label>}
                >
                  <div class="flex items-center gap-3">
                    <img src={pendingImageUrl()!} alt="Preview"
                         class="h-14 w-20 object-cover rounded-lg border border-gray-200"/>
                    <div class="flex flex-col gap-1">
                      <span class="text-sm text-gray-600 font-medium">Photo ready</span>
                      <button type="button" onClick={clearPendingImage}
                              class="text-xs text-red-500 hover:underline w-fit">Remove
                      </button>
                    </div>
                  </div>
                </Show>
                <div class="flex items-center gap-3 flex-wrap">
                  <Button onClick={handleMarkSeen} loading={submitting()} disabled={submitting()}
                          testId="mark-seen-btn">
                    Mark as Found!
                  </Button>
                </div>
              </Show>

              <Show when={seenRecord()}>
                <div class="space-y-3" data-testid="already-seen-row">
                  <Show when={!seenRecord()!.image}>
                    <div class="bg-amber-50/80 border border-amber-200/60 rounded-lg px-4 py-3">
                      <p class="text-sm font-medium text-amber-800"
                         data-testid="already-seen-msg">{pickMsg(NO_PHOTO_MSGS, plateText())}</p>
                      <p class="text-xs text-amber-600 mt-1">Logged <span
                        class="font-mono">{seenRecord()!.plate_text}</span> — upload evidence to seal the deal.</p>
                    </div>
                    <div class="flex items-center gap-3 flex-wrap">
                      <label
                        class="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-mkz-primary text-white text-sm font-medium hover:bg-mkz-secondary transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        {submitting() ? 'Uploading…' : 'Add photo'}
                        <input ref={updateImageInputRef} type="file" accept="image/*" class="hidden"
                               onChange={handleAddPhoto} data-testid="add-photo-input"/>
                      </label>
                      <Button variant="ghost" onClick={handleRemoveEntry} loading={submitting()} disabled={submitting()}
                              testId="remove-seen-btn">
                        Remove from list
                      </Button>
                    </div>
                  </Show>

                  <Show when={seenRecord()!.image}>
                    <div class="bg-emerald-50/80 border border-emerald-200/60 rounded-lg px-4 py-3">
                      <p class="text-sm font-medium text-emerald-800"
                         data-testid="already-seen-msg">{pickMsg(HAS_PHOTO_MSGS, plateText())}</p>
                      <p class="text-xs text-emerald-600 mt-1"><span
                        class="font-mono">{seenRecord()!.plate_text}</span> — documented with proof.</p>
                    </div>
                    <div class="flex items-start gap-4">
                      <img src={getSeenImageUrl(seenRecord()!, '200x200')} alt="Plate photo"
                           class="h-24 w-32 object-cover rounded-xl border border-gray-200 shadow-sm"
                           data-testid="seen-photo"/>
                      <div class="flex flex-col gap-2">
                        <label
                          class="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 transition-colors">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                          </svg>
                          {submitting() ? 'Updating…' : 'Change photo'}
                          <input ref={updateImageInputRef} type="file" accept="image/*" class="hidden"
                                 onChange={handleAddPhoto} data-testid="change-photo-input"/>
                        </label>
                        <button type="button" onClick={handleRemovePhoto} disabled={submitting()}
                                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm transition-colors disabled:opacity-50"
                                data-testid="remove-photo-btn">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                          Remove photo
                        </button>
                        <button type="button" onClick={handleRemoveEntry} disabled={submitting()}
                                class="text-xs text-gray-400 hover:text-red-500 hover:underline text-left transition-colors"
                                data-testid="remove-seen-btn">
                          Remove entire entry
                        </button>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            </Show>

            <Show when={submitSuccess()}>
              <span class="text-sm text-green-600 flex items-center gap-1" data-testid="submission-success">
                <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clip-rule="evenodd"/>
                </svg>
                Added to your collection!
              </span>
            </Show>

            <Show when={submitError()}>
              <span class="text-sm text-red-600 flex items-center gap-1" data-testid="submission-error">
                <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"/>
                </svg>
                {submitError()}
              </span>
            </Show>
          </Show>
        </div>
      </div>

      <MapRegionHighlighter kennzeichenId={kennzeichen()?.id ?? null}/>

      <div ref={previewRef} data-testid="map-preview-box" class="relative rounded-xl overflow-hidden min-h-45">
        <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div class="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-white/70 rounded-tl"/>
          <div class="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-white/70 rounded-tr"/>
          <div class="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-white/70 rounded-bl"/>
          <div class="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-white/70 rounded-br"/>
        </div>
        <Show when={lookupLoading()}>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-6 h-6 border-2 border-white/40 border-t-white/80 rounded-full animate-spin"/>
          </div>
        </Show>
        <Show when={!kennzeichen() && !lookupLoading()}>
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <svg class="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p class="text-white/50 text-xs text-center leading-relaxed">Type a plate<br/>to see the region</p>
          </div>
        </Show>
        <Show when={kennzeichen()}>
          <div class="absolute bottom-3 left-0 right-0 flex justify-center">
            <span
              class="inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium"
              data-testid="preview-region-badge">
              <svg class="w-3.5 h-3.5 text-mkz-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clip-rule="evenodd"/>
              </svg>
              {kennzeichen()!.district_name}
            </span>
          </div>
        </Show>
      </div>
    </div>);
};

export default PlateSubmission;
