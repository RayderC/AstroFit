// Which split a program uses for each number of lifting days. Shared by the builder page and lib/builder.ts,
// so it must stay free of server imports.

export type SplitOption = {
  id: string;
  label: string;
  hint: string;
  /** Day templates in lib/builder.ts, in training order. */
  days: string[];
};

export const SPLIT_OPTIONS: Record<number, SplitOption[]> = {
  2: [
    { id: "full", label: "Full body", hint: "Every muscle both days.", days: ["fullA", "fullB"] },
    { id: "ul", label: "Upper / Lower", hint: "Each half of the body once a week.", days: ["upperA", "lowerA"] },
  ],
  3: [
    { id: "full", label: "Full body", hint: "Every muscle three times a week. The most practice per lift.", days: ["fullA", "fullB", "fullC"] },
    { id: "ppl", label: "Push / Pull / Legs", hint: "Chest, shoulders and triceps; then back and biceps; then legs. Each once a week, with more exercises per muscle.", days: ["push", "pull", "legs"] },
    { id: "ulf", label: "Upper / Lower / Full", hint: "Upper body, lower body, then a full-body day.", days: ["upperA", "lowerA", "fullB"] },
  ],
  4: [
    { id: "ul", label: "Upper / Lower", hint: "Each half of the body twice a week.", days: ["upperA", "lowerA", "upperB", "lowerB"] },
    { id: "pplu", label: "Push / Pull / Legs + Upper", hint: "A push, pull and legs day, plus an extra upper day.", days: ["push", "pull", "legs", "upperA"] },
    { id: "full", label: "Full body", hint: "Every muscle four times a week, with fewer sets each day.", days: ["fullA", "fullB", "fullC", "fullA"] },
  ],
  5: [
    { id: "pplul", label: "Push / Pull / Legs + Upper / Lower", hint: "Push, pull and legs, then upper and lower.", days: ["push", "pull", "legs", "upperA", "lowerB"] },
    { id: "bro", label: "Body part", hint: "Chest, back, legs, shoulders and arms, one day each.", days: ["chest", "back", "legs", "shoulders", "arms"] },
  ],
  6: [
    { id: "ppl2", label: "Push / Pull / Legs ×2", hint: "Push, pull and legs, each twice a week.", days: ["push", "pull", "legs", "push", "pull", "legs"] },
    { id: "ul3", label: "Upper / Lower ×3", hint: "Upper and lower, each three times a week.", days: ["upperA", "lowerA", "upperB", "lowerB", "upperA", "lowerA"] },
  ],
};

/** Monday = 1 … Sunday = 0, spread out so rest days fall between sessions. */
export const DEFAULT_WEEKDAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

export function splitFor(days: number, id: string | undefined): SplitOption {
  const opts = SPLIT_OPTIONS[days] ?? SPLIT_OPTIONS[3];
  return opts.find(o => o.id === id) ?? opts[0];
}
