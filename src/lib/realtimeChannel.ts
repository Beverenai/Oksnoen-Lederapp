let channelSequence = 0;

/**
 * Supabase returns an existing channel when the same topic name is reused.
 * A second hook instance would then try to add callbacks after subscribe(),
 * which Realtime rejects. Give every subscription instance its own topic.
 */
export function uniqueRealtimeChannelName(base: string): string {
  channelSequence += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${channelSequence.toString(36)}-${random}`;
}
