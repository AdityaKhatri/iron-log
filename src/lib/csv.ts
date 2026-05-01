import type { Exercise } from '../types';

/** Parse a single CSV line, handling quoted fields with internal commas */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export interface ParsedLibraryRow {
  id: string;
  name: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  category: string;
  videoUrl: string | null;
  defaultUnit: string | null;
}

export function parseLibraryCsv(text: string): ParsedLibraryRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const results: ParsedLibraryRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h.trim()] = (values[idx] ?? '').trim();
    });

    if (!raw.id || !raw.name) continue;

    results.push({
      id: raw.id,
      name: raw.name,
      muscleGroup: raw.muscleGroup || 'other',
      secondaryMuscles: raw.secondaryMuscles
        ? raw.secondaryMuscles.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      equipment: raw.equipment || 'other',
      category: raw.category || 'muscle',
      videoUrl: raw.videoUrl || null,
      defaultUnit: raw.defaultUnit || null,
    });
  }

  return results;
}

/** Build Exercise objects from parsed rows, ready for merge */
export function parsedRowToExercise(row: ParsedLibraryRow, now: number): Omit<Exercise, 'archived'> & { archived: false } {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscleGroup,
    secondaryMuscles: row.secondaryMuscles,
    equipment: row.equipment as Exercise['equipment'],
    category: row.category as Exercise['category'],
    videoUrl: row.videoUrl,
    defaultUnit: (row.defaultUnit as Exercise['defaultUnit']) || null,
    source: 'library',
    archived: false,
    updatedAt: now,
  };
}
