/** Epley formula: estimated 1RM from a set of (weight × reps) */
export function estimated1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
