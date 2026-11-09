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
