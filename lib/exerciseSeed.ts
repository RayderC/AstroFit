// Built-in exercise library.
// Names follow Strong's convention (name + equipment shown as "Bench Press (Barbell)")
// so Strong imports match directly.

export type Muscle =
  | "chest" | "lats" | "upper_back" | "lower_back" | "traps"
  | "front_delts" | "side_delts" | "rear_delts"
  | "biceps" | "triceps" | "forearms"
  | "abs" | "obliques"
  | "glutes" | "quads" | "hamstrings" | "adductors" | "calves";

export const MUSCLES: { id: Muscle; label: string; group: "upper" | "lower" | "core" }[] = [
  { id: "chest", label: "Chest", group: "upper" },
  { id: "lats", label: "Lats", group: "upper" },
  { id: "upper_back", label: "Upper back", group: "upper" },
  { id: "lower_back", label: "Lower back", group: "core" },
  { id: "traps", label: "Traps", group: "upper" },
  { id: "front_delts", label: "Front delts", group: "upper" },
  { id: "side_delts", label: "Side delts", group: "upper" },
  { id: "rear_delts", label: "Rear delts", group: "upper" },
  { id: "biceps", label: "Biceps", group: "upper" },
  { id: "triceps", label: "Triceps", group: "upper" },
  { id: "forearms", label: "Forearms", group: "upper" },
  { id: "abs", label: "Abs", group: "core" },
  { id: "obliques", label: "Obliques", group: "core" },
  { id: "glutes", label: "Glutes", group: "lower" },
  { id: "quads", label: "Quads", group: "lower" },
  { id: "hamstrings", label: "Hamstrings", group: "lower" },
  { id: "adductors", label: "Adductors", group: "lower" },
  { id: "calves", label: "Calves", group: "lower" },
];

export type Pattern =
  | "h_push" | "v_push" | "h_pull" | "v_pull"
  | "squat" | "hinge" | "lunge"
  | "chest_iso" | "side_delt" | "rear_delt" | "biceps" | "triceps"
  | "quad_iso" | "ham_iso" | "glute_iso" | "calves" | "traps"
  | "core" | "carry" | "power" | "conditioning" | "forearms";

export type Equipment =
  | "barbell" | "dumbbell" | "cable" | "machine" | "smith"
  | "bodyweight" | "kettlebell" | "band" | "other";

export const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbell", label: "Dumbbell" },
  { id: "cable", label: "Cable" },
  { id: "machine", label: "Machine" },
  { id: "smith", label: "Smith Machine" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "band", label: "Band" },
  { id: "other", label: "Other" },
];

export type LogType = "weight_reps" | "reps" | "time";

type Seed = [
  name: string,
  equipment: Equipment,
  primary: Muscle[],
  secondary: Muscle[],
  pattern: Pattern,
  logType: LogType,
  rank: number, // lower = more standard choice for the workout builder
];

export const EXERCISE_SEED: Seed[] = [
  // Chest
  ["Bench Press", "barbell", ["chest"], ["triceps", "front_delts"], "h_push", "weight_reps", 1],
  ["Bench Press", "dumbbell", ["chest"], ["triceps", "front_delts"], "h_push", "weight_reps", 2],
  ["Incline Bench Press", "barbell", ["chest"], ["front_delts", "triceps"], "h_push", "weight_reps", 3],
  ["Incline Bench Press", "dumbbell", ["chest"], ["front_delts", "triceps"], "h_push", "weight_reps", 2],
  ["Decline Bench Press", "barbell", ["chest"], ["triceps"], "h_push", "weight_reps", 6],
  ["Bench Press", "smith", ["chest"], ["triceps", "front_delts"], "h_push", "weight_reps", 5],
  ["Chest Press", "machine", ["chest"], ["triceps", "front_delts"], "h_push", "weight_reps", 3],
  ["Push Up", "bodyweight", ["chest"], ["triceps", "front_delts", "abs"], "h_push", "reps", 4],
  ["Chest Dip", "bodyweight", ["chest"], ["triceps", "front_delts"], "h_push", "reps", 5],
  ["Chest Fly", "dumbbell", ["chest"], ["front_delts"], "chest_iso", "weight_reps", 2],
  ["Cable Crossover", "cable", ["chest"], ["front_delts"], "chest_iso", "weight_reps", 1],
  ["Chest Fly", "machine", ["chest"], ["front_delts"], "chest_iso", "weight_reps", 1],
  ["Chest Fly", "band", ["chest"], [], "chest_iso", "weight_reps", 4],

  // Back
  ["Deadlift", "barbell", ["hamstrings", "glutes", "lower_back"], ["upper_back", "traps", "forearms", "quads"], "hinge", "weight_reps", 1],
  ["Romanian Deadlift", "barbell", ["hamstrings", "glutes"], ["lower_back"], "hinge", "weight_reps", 1],
  ["Romanian Deadlift", "dumbbell", ["hamstrings", "glutes"], ["lower_back"], "hinge", "weight_reps", 2],
  ["Trap Bar Deadlift", "other", ["glutes", "quads", "hamstrings"], ["lower_back", "traps"], "hinge", "weight_reps", 3],
  ["Bent Over Row", "barbell", ["upper_back", "lats"], ["biceps", "rear_delts", "lower_back"], "h_pull", "weight_reps", 1],
  ["Bent Over One Arm Row", "dumbbell", ["lats", "upper_back"], ["biceps", "rear_delts"], "h_pull", "weight_reps", 1],
  ["Seated Row", "cable", ["upper_back", "lats"], ["biceps", "rear_delts"], "h_pull", "weight_reps", 1],
  ["Seated Row", "machine", ["upper_back", "lats"], ["biceps", "rear_delts"], "h_pull", "weight_reps", 2],
  ["T Bar Row", "other", ["upper_back", "lats"], ["biceps", "rear_delts"], "h_pull", "weight_reps", 3],
  ["Chest Supported Row", "dumbbell", ["upper_back", "lats"], ["rear_delts", "biceps"], "h_pull", "weight_reps", 2],
  ["Inverted Row", "bodyweight", ["upper_back", "lats"], ["biceps", "rear_delts"], "h_pull", "reps", 4],
  ["Pull Up", "bodyweight", ["lats"], ["biceps", "upper_back"], "v_pull", "reps", 1],
  ["Chin Up", "bodyweight", ["lats", "biceps"], ["upper_back"], "v_pull", "reps", 2],
  ["Pull Up (Assisted)", "machine", ["lats"], ["biceps", "upper_back"], "v_pull", "weight_reps", 3],
  ["Lat Pulldown", "cable", ["lats"], ["biceps", "upper_back"], "v_pull", "weight_reps", 1],
  ["Lat Pulldown", "machine", ["lats"], ["biceps", "upper_back"], "v_pull", "weight_reps", 2],
  ["Lat Pulldown", "band", ["lats"], ["biceps"], "v_pull", "weight_reps", 5],
  ["Straight Arm Pulldown", "cable", ["lats"], ["triceps"], "v_pull", "weight_reps", 6],
  ["Back Extension", "bodyweight", ["lower_back"], ["glutes", "hamstrings"], "hinge", "reps", 6],
  ["Good Morning", "barbell", ["hamstrings", "lower_back"], ["glutes"], "hinge", "weight_reps", 5],

  // Shoulders
  ["Overhead Press", "barbell", ["front_delts"], ["triceps", "side_delts", "traps"], "v_push", "weight_reps", 1],
  ["Overhead Press", "dumbbell", ["front_delts"], ["triceps", "side_delts"], "v_push", "weight_reps", 1],
  ["Shoulder Press", "machine", ["front_delts"], ["triceps", "side_delts"], "v_push", "weight_reps", 2],
  ["Arnold Press", "dumbbell", ["front_delts", "side_delts"], ["triceps"], "v_push", "weight_reps", 3],
  ["Pike Push Up", "bodyweight", ["front_delts"], ["triceps"], "v_push", "reps", 4],
  ["Overhead Press", "kettlebell", ["front_delts"], ["triceps"], "v_push", "weight_reps", 4],
  ["Lateral Raise", "dumbbell", ["side_delts"], [], "side_delt", "weight_reps", 1],
  ["Lateral Raise", "cable", ["side_delts"], [], "side_delt", "weight_reps", 1],
  ["Lateral Raise", "machine", ["side_delts"], [], "side_delt", "weight_reps", 2],
  ["Lateral Raise", "band", ["side_delts"], [], "side_delt", "weight_reps", 4],
  ["Front Raise", "dumbbell", ["front_delts"], [], "side_delt", "weight_reps", 6],
  ["Reverse Fly", "dumbbell", ["rear_delts"], ["upper_back"], "rear_delt", "weight_reps", 2],
  ["Reverse Fly", "machine", ["rear_delts"], ["upper_back"], "rear_delt", "weight_reps", 1],
  ["Face Pull", "cable", ["rear_delts"], ["upper_back", "traps"], "rear_delt", "weight_reps", 1],
  ["Face Pull", "band", ["rear_delts"], ["upper_back"], "rear_delt", "weight_reps", 3],
  ["Upright Row", "barbell", ["side_delts", "traps"], ["biceps"], "side_delt", "weight_reps", 7],
  ["Shrug", "barbell", ["traps"], ["forearms"], "traps", "weight_reps", 1],
  ["Shrug", "dumbbell", ["traps"], ["forearms"], "traps", "weight_reps", 1],

  // Arms
  ["Bicep Curl", "barbell", ["biceps"], ["forearms"], "biceps", "weight_reps", 1],
  ["Bicep Curl", "dumbbell", ["biceps"], ["forearms"], "biceps", "weight_reps", 1],
  ["Bicep Curl", "cable", ["biceps"], ["forearms"], "biceps", "weight_reps", 2],
  ["Bicep Curl", "band", ["biceps"], [], "biceps", "weight_reps", 4],
  ["Hammer Curl", "dumbbell", ["biceps", "forearms"], [], "biceps", "weight_reps", 2],
  ["Preacher Curl", "barbell", ["biceps"], [], "biceps", "weight_reps", 3],
  ["Preacher Curl", "machine", ["biceps"], [], "biceps", "weight_reps", 3],
  ["Incline Curl", "dumbbell", ["biceps"], [], "biceps", "weight_reps", 3],
  ["Concentration Curl", "dumbbell", ["biceps"], [], "biceps", "weight_reps", 5],
  ["Triceps Pushdown", "cable", ["triceps"], [], "triceps", "weight_reps", 1],
  ["Triceps Extension", "cable", ["triceps"], [], "triceps", "weight_reps", 2],
  ["Triceps Extension", "dumbbell", ["triceps"], [], "triceps", "weight_reps", 2],
  ["Triceps Pushdown", "band", ["triceps"], [], "triceps", "weight_reps", 4],
  ["Skullcrusher", "barbell", ["triceps"], [], "triceps", "weight_reps", 3],
  ["Close Grip Bench Press", "barbell", ["triceps", "chest"], ["front_delts"], "triceps", "weight_reps", 4],
  ["Triceps Dip", "bodyweight", ["triceps"], ["chest", "front_delts"], "triceps", "reps", 3],
  ["Bench Dip", "bodyweight", ["triceps"], [], "triceps", "reps", 5],
  ["Wrist Curl", "barbell", ["forearms"], [], "forearms", "weight_reps", 5],
  ["Wrist Curl", "dumbbell", ["forearms"], [], "forearms", "weight_reps", 5],

  // Legs
  ["Squat", "barbell", ["quads", "glutes"], ["adductors", "hamstrings", "lower_back"], "squat", "weight_reps", 1],
  ["Front Squat", "barbell", ["quads"], ["glutes", "abs"], "squat", "weight_reps", 3],
  ["Squat", "smith", ["quads", "glutes"], ["adductors"], "squat", "weight_reps", 4],
  ["Hack Squat", "machine", ["quads"], ["glutes"], "squat", "weight_reps", 2],
  ["Leg Press", "machine", ["quads", "glutes"], ["adductors", "hamstrings"], "squat", "weight_reps", 1],
  ["Goblet Squat", "dumbbell", ["quads", "glutes"], ["adductors", "abs"], "squat", "weight_reps", 2],
  ["Goblet Squat", "kettlebell", ["quads", "glutes"], ["adductors", "abs"], "squat", "weight_reps", 3],
  ["Squat", "bodyweight", ["quads", "glutes"], [], "squat", "reps", 5],
  ["Bulgarian Split Squat", "dumbbell", ["quads", "glutes"], ["adductors", "hamstrings"], "lunge", "weight_reps", 1],
  ["Lunge", "dumbbell", ["quads", "glutes"], ["hamstrings", "adductors"], "lunge", "weight_reps", 2],
  ["Lunge", "barbell", ["quads", "glutes"], ["hamstrings", "adductors"], "lunge", "weight_reps", 3],
  ["Walking Lunge", "dumbbell", ["quads", "glutes"], ["hamstrings"], "lunge", "weight_reps", 2],
  ["Lunge", "bodyweight", ["quads", "glutes"], ["hamstrings"], "lunge", "reps", 4],
  ["Step Up", "dumbbell", ["quads", "glutes"], [], "lunge", "weight_reps", 4],
  ["Leg Extension", "machine", ["quads"], [], "quad_iso", "weight_reps", 1],
  ["Lying Leg Curl", "machine", ["hamstrings"], [], "ham_iso", "weight_reps", 1],
  ["Seated Leg Curl", "machine", ["hamstrings"], [], "ham_iso", "weight_reps", 1],
  ["Nordic Hamstring Curl", "bodyweight", ["hamstrings"], [], "ham_iso", "reps", 4],
  ["Hip Thrust", "barbell", ["glutes"], ["hamstrings"], "glute_iso", "weight_reps", 1],
  ["Hip Thrust", "machine", ["glutes"], ["hamstrings"], "glute_iso", "weight_reps", 2],
  ["Glute Bridge", "bodyweight", ["glutes"], ["hamstrings"], "glute_iso", "reps", 3],
  ["Cable Pull Through", "cable", ["glutes", "hamstrings"], [], "glute_iso", "weight_reps", 3],
  ["Hip Adduction", "machine", ["adductors"], [], "glute_iso", "weight_reps", 6],
  ["Hip Abduction", "machine", ["glutes"], [], "glute_iso", "weight_reps", 5],
  ["Standing Calf Raise", "machine", ["calves"], [], "calves", "weight_reps", 1],
  ["Seated Calf Raise", "machine", ["calves"], [], "calves", "weight_reps", 1],
  ["Standing Calf Raise", "dumbbell", ["calves"], [], "calves", "weight_reps", 2],
  ["Standing Calf Raise", "bodyweight", ["calves"], [], "calves", "reps", 3],
  ["Kettlebell Swing", "kettlebell", ["glutes", "hamstrings"], ["lower_back", "abs"], "hinge", "weight_reps", 4],

  // Core
  ["Plank", "bodyweight", ["abs"], ["obliques"], "core", "time", 1],
  ["Side Plank", "bodyweight", ["obliques"], ["abs"], "core", "time", 3],
  ["Crunch", "bodyweight", ["abs"], [], "core", "reps", 3],
  ["Cable Crunch", "cable", ["abs"], [], "core", "weight_reps", 1],
  ["Hanging Leg Raise", "bodyweight", ["abs"], ["obliques"], "core", "reps", 1],
  ["Lying Leg Raise", "bodyweight", ["abs"], [], "core", "reps", 3],
  ["Ab Wheel", "other", ["abs"], ["lats"], "core", "reps", 2],
  ["Russian Twist", "bodyweight", ["obliques"], ["abs"], "core", "reps", 4],
  ["Dead Bug", "bodyweight", ["abs"], [], "core", "reps", 3],
  ["Pallof Press", "cable", ["obliques"], ["abs"], "core", "weight_reps", 3],
  ["Pallof Press", "band", ["obliques"], ["abs"], "core", "weight_reps", 4],

  // Full body / power / carries
  ["Farmers Walk", "dumbbell", ["forearms", "traps"], ["abs", "glutes"], "carry", "weight_reps", 1],
  ["Power Clean", "barbell", ["glutes", "hamstrings", "traps"], ["quads", "upper_back"], "power", "weight_reps", 1],
  ["Clean and Jerk", "barbell", ["glutes", "quads", "front_delts"], ["traps", "triceps"], "power", "weight_reps", 3],
  ["Snatch", "barbell", ["glutes", "hamstrings", "traps"], ["side_delts", "quads"], "power", "weight_reps", 3],
  ["Thruster", "barbell", ["quads", "front_delts"], ["glutes", "triceps"], "power", "weight_reps", 4],
  ["Box Jump", "bodyweight", ["quads", "glutes"], ["calves"], "power", "reps", 4],
  ["Burpee", "bodyweight", ["chest", "quads"], ["abs", "front_delts"], "conditioning", "reps", 3],
  ["Jump Rope", "other", ["calves"], [], "conditioning", "time", 2],
  ["Battle Ropes", "other", ["front_delts"], ["abs"], "conditioning", "time", 3],
  ["Sled Push", "other", ["quads", "glutes"], ["calves"], "conditioning", "weight_reps", 3],
];

// Cardio activity types (cardio blocks). has_distance = shows distance/pace.
export const ACTIVITY_SEED: [name: string, hasDistance: 0 | 1, icon: string][] = [
  ["Running", 1, "run"],
  ["Treadmill", 1, "run"],
  ["Walking", 1, "walk"],
  ["Hiking", 1, "walk"],
  ["Cycling", 1, "bike"],
  ["Stationary Bike", 1, "bike"],
  ["Rowing", 1, "row"],
  ["Swimming", 1, "swim"],
  ["Elliptical", 0, "other"],
  ["Stair Climber", 0, "other"],
  ["Assault Bike", 0, "bike"],
  ["HIIT", 0, "other"],
];

export function equipmentLabel(e: string | null | undefined) {
  return EQUIPMENT.find(x => x.id === e)?.label ?? "";
}

/** "Bench Press (Barbell)" — bodyweight/other shown without suffix, like Strong. */
export function exerciseDisplayName(name: string, equipment: string | null | undefined) {
  if (!equipment || equipment === "bodyweight" || equipment === "other" || name.includes("(")) return name;
  return `${name} (${equipmentLabel(equipment)})`;
}

const UPPER_PATTERNS = new Set<Pattern>(["h_push", "v_push", "h_pull", "v_pull", "chest_iso", "side_delt", "rear_delt", "biceps", "triceps", "traps", "forearms"]);
export function isUpperPattern(p: string | null | undefined) {
  return p ? UPPER_PATTERNS.has(p as Pattern) : true;
}
