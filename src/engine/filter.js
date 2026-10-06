// Family mode: mask common profanity and slurs in what players type (answers, names, crimes…).
// The host applies it to every input, so it covers every game. Spicy mode turns it off.
// Matching is whole-word with light leetspeak folding; a masked word keeps its first letter.

const WORDS = [
  // profanity
  'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking', 'fuckin', 'motherfucker', 'motherfuckers', 'motherfucking', 'fuk', 'fck', 'fcking', 'phuck',
  'shit', 'shits', 'shitty', 'shitting', 'bullshit', 'horseshit', 'shithead', 'shitface',
  'bitch', 'bitches', 'bitchy', 'bitching', 'sonofabitch',
  'cunt', 'cunts', 'twat', 'twats',
  'cock', 'cocks', 'cocksucker', 'dick', 'dicks', 'dickhead', 'prick', 'pricks',
  'pussy', 'pussies', 'asshole', 'assholes', 'arsehole', 'dumbass', 'jackass', 'ass', 'arse',
  'bastard', 'bastards', 'wanker', 'wankers', 'wank', 'bollocks', 'bugger', 'tosser',
  'slut', 'sluts', 'slutty', 'whore', 'whores', 'hoe', 'hoes', 'skank',
  'piss', 'pissed', 'pissing', 'damn', 'goddamn', 'goddamnit', 'crap',
  'jizz', 'cum', 'cumming', 'dildo', 'dildos', 'blowjob', 'handjob', 'porn', 'porno', 'boner', 'tits', 'titties', 'boobs',
  // slurs
  'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'fag', 'fags', 'dyke', 'dykes', 'tranny', 'trannies',
  'retard', 'retards', 'retarded', 'spic', 'spics', 'chink', 'chinks', 'gook', 'kike', 'kikes', 'wetback', 'beaner', 'beaners', 'raghead', 'towelhead', 'coon', 'coons',
];
const SET = new Set(WORDS);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

function fold(word) {
  let s = '';
  for (const ch of word.toLowerCase()) s += LEET[ch] || ch;
  // fuuuuck -> fuck, shiiit -> shit
  return s.replace(/(.)\1{2,}/g, '$1$1').replace(/[^a-z]/g, '');
}

function bad(word) {
  const f = fold(word);
  if (!f) return false;
  if (SET.has(f)) return true;
  // collapse doubled letters too: "fuckk", "shitt"
  const g = f.replace(/(.)\1+/g, '$1');
  return SET.has(g);
}

export function maskProfanity(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(/[A-Za-z0-9@$!]+/g, (w) => (/[A-Za-z]/.test(w) && bad(w) ? w[0] + '*'.repeat(Math.max(2, w.length - 1)) : w));
}

// Mask every string in a player's input (skipping images and short codes like ids).
export function maskInput(d) {
  if (!d || typeof d !== 'object') return d;
  const out = Array.isArray(d) ? [] : {};
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string') out[k] = v.startsWith('data:') || v.length < 2 ? v : maskProfanity(v);
    else if (v && typeof v === 'object' && !(k === 'st' || k === 's' || k === 'k')) out[k] = maskInput(v);
    else out[k] = v;
  }
  return out;
}
