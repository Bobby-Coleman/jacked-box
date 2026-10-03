// Text helpers for comparing player answers.

export function clean(t, n = 80) {
  return String(t || '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);
}

export function normText(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(a|an|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rough singular form of every word ("pancakes" -> "pancake", "fries" -> "fry").
export function stem(t) {
  return normText(t)
    .split(' ')
    .map((w) => {
      if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
      if (w.length > 4 && /(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
      if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
      return w;
    })
    .join(' ');
}

export function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Same answer, allowing typos and plurals.
export function similar(a, b) {
  const x = stem(a).replace(/ /g, '');
  const y = stem(b).replace(/ /g, '');
  if (!x || !y) return false;
  if (x === y) return true;
  const n = Math.min(x.length, y.length);
  if (n < 4) return false;
  return lev(x, y) <= Math.max(1, Math.floor(n * 0.18));
}

// Group answers that mean the same thing. Returns [{key, text, pids}].
export function groupAnswers(entries) {
  const groups = [];
  for (const [pid, text] of entries) {
    const g = groups.find((gr) => similar(gr.text, text));
    if (g) g.pids.push(pid);
    else groups.push({ key: 'g' + groups.length, text, pids: [pid] });
  }
  return groups;
}
