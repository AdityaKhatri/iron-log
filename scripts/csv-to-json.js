// Converts public/library.csv → public/exercises.json before every build.
// AI agents can fetch the JSON at /iron-log/exercises.json to browse the
// exercise library when generating workouts for the Import from AI feature.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const csvPath = join(root, 'public', 'library.csv');
const outPath = join(root, 'public', 'exercises.json');

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current); current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const text = readFileSync(csvPath, 'utf-8');
const lines = text.trim().split(/\r?\n/);
const headers = parseCsvLine(lines[0]);

const exercises = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const values = parseCsvLine(line);
  const raw = {};
  headers.forEach((h, idx) => { raw[h.trim()] = (values[idx] ?? '').trim(); });
  if (!raw.name) continue;

  exercises.push({
    name: raw.name,
    muscleGroup: raw.muscleGroup || 'other',
    secondaryMuscles: raw.secondaryMuscles
      ? raw.secondaryMuscles.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    equipment: raw.equipment || 'other',
    category: raw.category || 'muscle',
    defaultUnit: raw.defaultUnit || null,
  });
}

writeFileSync(outPath, JSON.stringify(exercises, null, 2), 'utf-8');
console.log(`✓ exercises.json — ${exercises.length} exercises`);
