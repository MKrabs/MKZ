import { Component, createSignal, Show } from 'solid-js';
import Button from './Button';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  onDelete?: () => void;
}

/**
 * Thumbnail with click-to-expand popup and delete option.
 */
const ImagePreview: Component<ImagePreviewProps> = (props) => {
  const [showFull, setShowFull] = createSignal(false);

  return (<>
      {/* Thumbnail */}
      <div class="relative inline-block group" data-testid="image-preview">
        <img
          src={props.src}
          alt={props.alt ?? 'Preview'}
          class="w-16 h-16 object-cover rounded-md border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowFull(true)}
        />
        <Show when={props.onDelete}>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete?.();
            }}
            size="sm"
            variant="light"
            class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs p-0 flex items-center justify-center hover:bg-red-600 transition-colors"
            aria-label="Delete image"
            data-testid="image-delete-btn"
          >
            ×
          </Button>
        </Show>
      </div>

      {/* Full-size popup */}
      <Show when={showFull()}>
        <div
          class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFull(false)}
          data-testid="image-popup"
        >
          <div class="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={props.src}
              alt={props.alt ?? 'Full preview'}
              class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <Button
              onClick={() => setShowFull(false)}
              size="sm"
              variant="light"
              class="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-gray-800 hover:bg-white transition-colors shadow p-0"
              aria-label="Close preview"
            >
              ×
            </Button>
          </div>
        </div>
      </Show>
    </>);
};

export default ImagePreview;
