// Which games are free and which need RiffRaff Premium. The classic Jackbox-style party
// games are free for everyone; the rest (face games, table games, originals) are Premium.
// One Premium player in a room unlocks Premium games for the whole room.
export const FREE_GAMES = ['zinger', 'fib', 'sketch', 'phone', 'dead'];

export function isPremiumGame(id) {
  return !FREE_GAMES.includes(id);
}

export function roomHasPremium(s) {
  return Object.values(s.players || {}).some((p) => p.premium && !p.bot);
}

export function canPlay(s, id) {
  return !isPremiumGame(id) || roomHasPremium(s);
}
