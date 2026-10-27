/**
 * Emoji suggestion engine (spec section 20). Rule-based keyword → emoji map,
 * shared by dev and real providers. Never spams: capped by `max`.
 */

export const EMOJI_MAP: Record<string, string[]> = {
  insane: ['🤯'], crazy: ['🤯'], insane_match: ['😱'], clutch: ['🔥', '😱'],
  'let\'s go': ['🔥'], letsgo: ['🔥'], lets_go: ['🔥'], win: ['🏆'], won: ['🏆'],
  lose: ['💀'], lost: ['💀'], record: ['📈'], 'one million': ['1M', '🔥'],
  million: ['1M', '💰'], views: ['👀'], screaming: ['😱'], scream: ['😱'],
  best: ['👑'], worst: ['💀'], money: ['💰'], broke: ['💸'], sad: ['😢'],
  love: ['❤️'], hate: ['😤'], amazing: ['✨'], unbelievable: ['🤯'],
  funny: ['😂'], joke: ['😂'], omg: ['😱'], wow: ['😮'], no: ['🙅'], yes: ['✅'],
  fight: ['🥊'], drama: ['🍿'], scared: ['😨'], happy: ['😄'], angry: ['😡'],
};

export const EMOTION_WORDS = new Set([
  'insane', 'crazy', 'unbelievable', 'screaming', 'amazing', 'best', 'worst',
  'clutch', 'epic', 'legend', 'wild', 'incredible', 'drama', 'wow', 'omg',
  'shocked', 'hilarious', 'crying', 'freaking', 'huge', 'massive', 'record',
]);

/** Suggest a few emojis for a line of transcript text. */
export function suggestEmojis(text: string, max = 3): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const [key, emojis] of Object.entries(EMOJI_MAP)) {
    if (lower.includes(key)) hits.push(...emojis);
    if (hits.length >= max) break;
  }
  return Array.from(new Set(hits)).slice(0, max);
}

