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
import Icon from '../common/Icon';

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

/**
 * Compute an overall bounding box (SW/NE) across all region geometries.
 * Uses outer rings only and works with Polygon or MultiPolygon.
 */
function regionsBBox(regions: { low: any }[]) {
  const all = regions.flatMap((r) => flattenCoords(r.low));
  if (all.length === 0) return null;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of all) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { sw: [minLon, minLat] as [number, number], ne: [maxLon, maxLat] as [number, number] };
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
            // Try to fit the region bounds to the viewport to avoid zooming too far in.
            const m = mapCtx.map();

            // Build bounding box from low-res geometries
            const bbox = regionsBBox(regions);
            if (m && bbox) {
              const { sw, ne } = bbox;
              try {
                // If previewRef is available, compute padding so the bbox fits inside the
                // preview box rather than the full viewport.
                let padding: number | { top: number; right: number; bottom: number; left: number } = 80;
                if (previewRef) {
                  const r = previewRef.getBoundingClientRect();
                  const inner = 12; // inner padding inside the preview box
                  padding = {
                    left: Math.max(8, Math.round(r.left + inner)),
                    top: Math.max(8, Math.round(r.top + inner)),
                    right: Math.max(8, Math.round(window.innerWidth - r.right + inner)),
                    bottom: Math.max(8, Math.round(window.innerHeight - r.bottom + inner)),
                  };
                }

                (m as any).fitBounds([sw, ne], { padding, maxZoom: 11, duration: 2200, linear: true });
              } catch (e) {
                mapCtx.flyToCoords(center, REGION_ZOOM, computePreviewOffset());
              }
            } else {
              mapCtx.flyToCoords(center, REGION_ZOOM, computePreviewOffset());
            }
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
              <Icon name="map-pin" class="w-5 h-5 text-mkz-primary shrink-0 mt-0.5" />
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
                <p class="text-sm text-gray-600">Sign in to collect and save plates.</p>
              </div>
              <Button variant="accent" class="pointer-events-auto">test</Button>
            </Show>

            <Show when={user()}>
              <Show when={!seenRecord()}>
                <Show
                  when={pendingImageUrl()}
                  fallback={<label
                    class="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-600 w-fit">
                    <Icon name="camera" class="w-4 h-4" />
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
                      <Button type="button" onClick={clearPendingImage} size="sm" variant="ghost" class="text-xs text-red-500 hover:underline w-fit p-0">Remove</Button>
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
                        <Icon name="camera" class="w-4 h-4" />
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
                          <Icon name="upload" class="w-4 h-4" />
                          {submitting() ? 'Updating…' : 'Change photo'}
                          <input ref={updateImageInputRef} type="file" accept="image/*" class="hidden"
                                 onChange={handleAddPhoto} data-testid="change-photo-input"/>
                        </label>
                        <Button type="button" onClick={handleRemovePhoto} disabled={submitting()} variant="light" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm transition-colors" data-testid="remove-photo-btn">
                          <Icon name="trash-2" class="w-4 h-4" />
                          Remove photo
                        </Button>
                        <Button type="button" onClick={handleRemoveEntry} disabled={submitting()} variant="ghost" size="sm" class="text-xs text-gray-400 hover:text-red-500 hover:underline text-left transition-colors p-0" data-testid="remove-seen-btn">Remove entire entry</Button>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>
            </Show>

            <Show when={submitSuccess()}>
              <span class="text-sm text-green-600 flex items-center gap-1" data-testid="submission-success">
                <Icon name="check-circle" class="w-4 h-4 shrink-0" />
                Added to your collection!
              </span>
            </Show>

            <Show when={submitError()}>
              <span class="text-sm text-red-600 flex items-center gap-1" data-testid="submission-error">
                <Icon name="alert-circle" class="w-4 h-4 shrink-0" />
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
            <Icon name="map-pin" class="w-8 h-8 text-white/40" />
            <p class="text-white/50 text-xs text-center leading-relaxed">Type a plate<br/>to see the region</p>
          </div>
        </Show>
        <Show when={kennzeichen()}>
          <div class="absolute bottom-3 left-0 right-0 flex justify-center">
            <span
              class="inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium"
              data-testid="preview-region-badge">
              <Icon name="map-pin" class="w-3.5 h-3.5 text-mkz-accent" />
              {kennzeichen()!.district_name}
            </span>
          </div>
        </Show>
      </div>
    </div>);
};

export default PlateSubmission;
