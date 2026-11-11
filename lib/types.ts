// Shapes shared by API routes and pages.

export type SetKind = "normal" | "warmup" | "drop" | "failure";
export type LogType = "weight_reps" | "reps" | "time";

export type ExerciseDTO = {
  id: number;
  name: string;
  equipment: string;
  displayName: string;
  primary: string[];
  secondary: string[];
  pattern: string | null;
  logType: LogType;
  isBuiltin: boolean;
};

export type ActivityDTO = { id: number; name: string; hasDistance: boolean; icon: string; isBuiltin: boolean };

export type SetDTO = {
  id: number;
  position: number;
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  rpe: number | null;
  done: boolean;
};

export type PrevSet = { kind: SetKind; weightKg: number | null; reps: number | null; durationS: number | null };

export type Suggestion = {
  status: "increase" | "build" | "hold";
  repMin: number;
  repMax: number;
  inferred: boolean;
  lastWeightKg: number;
  nextWeightKg: number;
  lastDate: string;
};

export type CardioDTO = {
  durationS: number | null;
  distanceM: number | null;
  elevationM: number | null;
  avgHr: number | null;
  calories: number | null;
  route: [number, number, number][] | null; // [lat, lon, t(ms)]
  done: boolean;
};

export type LiftBlockDTO = {
  id: number;
  kind: "lift";
  position: number;
  superset: number | null;
  exercise: ExerciseDTO;
  repMin: number | null;
  repMax: number | null;
  restS: number;
  notes: string | null;
  stickyNote: string | null;
  sets: SetDTO[];
  previous: PrevSet[];
  suggestion: Suggestion | null;
};

export type CardioBlockDTO = {
  id: number;
  kind: "cardio";
  position: number;
  superset: null;
  activity: ActivityDTO;
  notes: string | null;
  cardio: CardioDTO;
  previous: { durationS: number | null; distanceM: number | null; date: string } | null;
};

export type BlockDTO = LiftBlockDTO | CardioBlockDTO;

export type SessionDTO = {
  id: number;
  name: string;
  routineId: number | null;
  startedAt: string;
  endedAt: string | null;
  pausedS: number;
  pausedAt: string | null;
  notes: string | null;
  source: string;
  blocks: BlockDTO[];
};

export type SessionSummary = {
  id: number;
  name: string;
  startedAt: string;
  endedAt: string | null;
  durationS: number;
  liftSets: number;
  volumeKg: number;
  cardioS: number;
  cardioM: number;
  exercises: string[];
  hasLift: boolean;
  hasCardio: boolean;
};

/** value is a number in stored units: kg for weight, meters for distance, seconds for duration, seconds per meter for pace. */
export type RecordHit = { exercise: string; label: string; value: string; kind?: "weight" | "distance" | "duration" | "pace" };

export type RoutineBlockDTO = {
  id?: number;
  kind: "lift" | "cardio";
  superset: number | null;
  exerciseId: number | null;
  activityTypeId: number | null;
  exercise?: ExerciseDTO | null;
  activity?: ActivityDTO | null;
  setsCount: number;
  repMin: number | null;
  repMax: number | null;
  targetWeightKg: number | null;
  restS: number | null;
  targetDurationS: number | null;
  targetDistanceM: number | null;
  notes: string | null;
};

export type RoutineDTO = {
  id: number;
  name: string;
  notes: string | null;
  programId: number | null;
  programName: string | null;
  updatedAt: string;
  blocks: RoutineBlockDTO[];
  lastDone: string | null;
};

// ── Food ──

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

/** Numbers are per serving. servingG is the serving's grams (or ml), when known. */
export type FoodDTO = {
  id: number; name: string; brand: string | null; barcode: string | null; source: "custom" | "off";
  servingLabel: string; servingG: number | null; unit: "g" | "ml";
  kcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null;
};
/** A food found online that isn't saved yet, so it has no id. */
export type FoundFood = Omit<FoodDTO, "id"> & { id?: number };

export type FoodEntryDTO = {
  id: number; day: string; meal: Meal; foodId: number | null; name: string; brand: string | null;
  amount: number; unit: "serving" | "g" | "ml"; kcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null;
};

export type FoodGoals = { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };

export type FoodDayDTO = {
  day: string;
  entries: FoodEntryDTO[];
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  goals: FoodGoals;
  week: { day: string; kcal: number }[];
};

// ── Personal plans (lib/coach.ts) ──

export type CoachAbout = {
  heightCm: number | null;
  sex: "male" | "female" | null;
  birthYear: number | null;
  /** Latest logged weight and body fat, from the body log. */
  weightKg: number | null;
  weightDate: string | null;
  bodyFatPct: number | null;
  bodyFatDate: string | null;
};

export type CoachStats = {
  totalSessions: number;
  trainingMonths: number;
  windowWeeks: number;
  sessionsPerWeek: number;
  /** Share of weeks in the window with at least one workout, 0 to 1. */
  consistency: number;
  daysSinceLast: number | null;
  typicalMinutes: number | null;
  typicalReps: number | null;
  /** Working sets per muscle each week over the last 4 weeks. Secondary muscles count half. */
  weeklySets: Record<string, number>;
  cardioMinutesPerWeek: number;
  cardioSessionsPerWeek: number;
  bestLifts: { name: string; e1rmKg: number }[];
};

export type CoachRecommendation = {
  level: "beginner" | "intermediate" | "advanced";
  goal: "strength" | "muscle" | "general";
  days: number;
  split: string;
  minutes: number;
  cardioDays: number;
  cardioMinutes: number;
  lagging: string[];
  returning: boolean;
  older: boolean;
  bmi: number | null;
  /** Fat-free mass index: lean mass for your height. */
  ffmi: number | null;
  fatBand: "lean" | "fit" | "average" | "high" | null;
  why: string[];
};

export type CoachProfile = { about: CoachAbout; stats: CoachStats; recommendation: CoachRecommendation; aiEnabled?: boolean };
