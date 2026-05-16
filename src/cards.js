export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const RANK_LABELS = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const RANK_FROM_LABEL = Object.fromEntries(Object.entries(RANK_LABELS).map(([k, v]) => [v, +k]));

export const SUITS = [0, 1, 2, 3];
export const SUIT_LABELS = ['♠', '♥', '♦', '♣'];
export const SUIT_KEYS = ['s', 'h', 'd', 'c'];
export const SUIT_CLASSES = ['suit-s', 'suit-h', 'suit-d', 'suit-c'];

export const ALL_CARDS = [];
for (const r of RANKS) {
  for (const s of SUITS) {
    ALL_CARDS.push({ rank: r, suit: s });
  }
}

export function cardKey(c) {
  return c.rank * 4 + c.suit;
}

export function cardEquals(a, b) {
  return a.rank === b.rank && a.suit === b.suit;
}

export function cardLabel(c) {
  return RANK_LABELS[c.rank] + SUIT_LABELS[c.suit];
}

export function cardShort(c) {
  return RANK_LABELS[c.rank] + SUIT_KEYS[c.suit];
}
