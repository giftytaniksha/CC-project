// Shared profile choices. The server validates saved values against these lists,
// and the UI renders them, so the two can never drift apart.
// Each entry is [stored value, plain-language label]. Stored values are kept
// stable so profiles saved earlier still validate.

export type Option = readonly [value: string, label: string];

export const SEX_OPTIONS: readonly Option[] = [
  ['female', 'Female'],
  ['male', 'Male'],
  ['other', 'Other / prefer not to say'],
];

export const ACTIVITY_OPTIONS: readonly Option[] = [
  ['sedentary', 'Mostly sitting: desk job, little exercise'],
  ['light', 'Lightly active: walks or exercise 1–3 days a week'],
  ['moderate', 'Moderately active: exercise 3–5 days a week'],
  ['active', 'Very active: hard exercise 6–7 days or a physical job'],
];

export const GOAL_OPTIONS: readonly Option[] = [
  ['Weight management', 'Lose weight gently'],
  ['Weight gain', 'Gain weight in a healthy way'],
  ['Muscle gain', 'Build muscle and strength'],
  ['Maintenance', 'Keep my current weight'],
  ['General wellness', 'Eat healthier overall'],
  ['More energy', 'Feel more energetic through the day'],
];

export const DIET_OPTIONS: readonly Option[] = [
  ['Vegetarian', 'Vegetarian: no meat, fish or eggs'],
  ['Eggetarian', 'Eggetarian: vegetarian, but eggs are fine'],
  ['Pescatarian', 'Pescatarian: fish and seafood, no other meat'],
  ['Non-vegetarian', 'Non-vegetarian: meat, fish and eggs'],
  ['Vegan', 'Vegan: no animal products at all'],
  ['Other', 'No specific diet'],
];

export const CUISINE_OPTIONS: readonly Option[] = [
  ['Indian', 'Indian, any region'],
  ['North Indian', 'North Indian'],
  ['South Indian', 'South Indian'],
  ['East Indian', 'East Indian (e.g. Bengali)'],
  ['West Indian', 'West Indian (e.g. Gujarati, Maharashtrian)'],
  ['Mediterranean', 'Mediterranean'],
  ['Italian', 'Italian'],
  ['Mexican', 'Mexican'],
  ['Chinese', 'Chinese'],
  ['Continental', 'Continental / Western'],
  ['Any', 'No preference, suggest anything'],
];

export const FREQUENCY_OPTIONS: readonly Option[] = [
  ['3', '3 meals a day'],
  ['4', '4 meals a day (includes a snack)'],
  ['5', '5 meals a day (smaller portions)'],
];

export const COOKING_OPTIONS: readonly Option[] = [
  ['No cooking', 'No cooking: ready-to-eat only'],
  ['Quick meals', 'Quick: about 15 minutes'],
  ['Under 30 minutes', 'Up to 30 minutes'],
  ['Up to 1 hour', 'Up to 1 hour'],
  ['Flexible', 'Flexible: I enjoy cooking, any time'],
];

export const BUDGET_OPTIONS: readonly Option[] = [
  ['Budget', 'Tight: everyday staples only'],
  ['Moderate', 'Moderate: a mix of staples and proteins'],
  ['Comfortable', 'Comfortable: better ingredients are fine'],
  ['Flexible', 'No specific limit'],
];

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const;
export const DAILY_MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const;

export const optionValues = (options: readonly Option[]) => options.map(([value]) => value) as [string, ...string[]];
export const optionLabel = (options: readonly Option[], value: unknown) =>
  options.find(([v]) => v === String(value))?.[1] ?? String(value ?? '');
