// One stable color per guest (by position in the guest list).
const PALETTE = [
  '#4f46e5', '#059669', '#e11d48', '#d97706', '#0891b2',
  '#7c3aed', '#65a30d', '#db2777', '#ea580c', '#0284c7',
  '#9333ea', '#16a34a', '#dc2626', '#ca8a04', '#2563eb',
];

export function colorMap(participants) {
  const map = new Map();
  participants.forEach((p, i) => map.set(p.id, PALETTE[i % PALETTE.length]));
  return map;
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
