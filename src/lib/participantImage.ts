/**
 * Returns the best src for participant lists/avatars.
 * Uses the small pre-generated thumbnail when available so mobile lists
 * load quickly, and falls back to the full image_url otherwise.
 * Detail views should keep using image_url directly.
 */
export function getParticipantThumb(p: {
  image_thumb_url?: string | null;
  image_url?: string | null;
}): string | undefined {
  return p.image_thumb_url || p.image_url || undefined;
}