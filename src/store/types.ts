// Data model for NEXUS. Everything the app saves is described here.
export type WeightUnit = 'kg' | 'lb'
export type LengthUnit = 'cm' | 'in'
export type Goal = 'gain' | 'lose' | 'maintain'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Activity = 'low' | 'moderate' | 'high'
export type Equipment = 'bodyweight' | 'dumbbells' | 'barbell' | 'bench' | 'pullupbar' | 'bands' | 'machines'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Profile {
  onboarded: boolean
  name: string
  age: number
  sex: 'male' | 'female'
  heightCm: number
  weightKg: number
  targetKg: number
  goal: Goal
  experience: Experience
  daysPerWeek: number
  activity: Activity
  equipment: Equipment[]
  foodPrefs: string
  restrictions: string
  units: { weight: WeightUnit; length: LengthUnit }
}
export interface Targets { calories: number; protein: number; carbs: number; fat: number; waterMl: number; sleepH: number; custom: boolean }

export interface WeightEntry { id: string; date: string; kg: number; note?: string }
export interface Measurement { id: string; date: string; chest?: number; waist?: number; arm?: number; thigh?: number; hip?: number; calf?: number; note?: string } // all in cm
export interface PhotoMeta { id: string; date: string; note?: string }

export interface PlanExercise { exerciseId: string; sets: number; reps: string; restSec: number }
export interface PlanDay { id: string; name: string; weekday: number | null; exercises: PlanExercise[] }
export type PlanStyle = 'fullbody' | 'upperlower' | 'ppl' | 'custom'
export interface WorkoutPlan { id: string; name: string; style: PlanStyle; days: PlanDay[] }
export interface LoggedSet { weight: number; reps: number; done: boolean }
export interface SessionExercise { exerciseId: string; sets: LoggedSet[]; restSec: number }
export interface WorkoutSession { id: string; date: string; planId?: string; dayName: string; startedAt: number; endedAt: number; exercises: SessionExercise[]; notes?: string }

export interface Food { id: string; name: string; kcal: number; protein: number; carbs: number; fat: number; group: string; state?: 'cooked' | 'raw' | 'prepared'; servings?: { label: string; grams: number }[]; source: 'reference' | 'custom'; note?: string }
export interface FoodEntry { id: string; date: string; meal: MealType; foodId: string; name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number; ts: number }
export interface MealTemplate { id: string; name: string; meal: MealType; items: { foodId: string; grams: number }[] }

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export interface CalEvent { id: string; title: string; date: string; start: string; end: string; description?: string; kind: 'event' | 'workout' | 'meal' | 'reminder'; recurrence: Recurrence; until?: string; remindMin: number | null; doneDates: string[] }
export interface Task { id: string; title: string; done: boolean; priority: 'low' | 'medium' | 'high'; due?: string; notes?: string; createdAt: number }
export interface Habit { id: string; name: string; perWeek: number }
export interface HabitLog { habitId: string; date: string }
export interface WaterEntry { id: string; date: string; ml: number; ts: number }
export interface SleepEntry { id: string; date: string; hours: number; quality: number }

export type ActionPayload =
  | { type: 'log_weight'; kg: number; date?: string }
  | { type: 'log_water'; ml: number }
  | { type: 'add_task'; title: string; priority?: 'low' | 'medium' | 'high'; due?: string }
  | { type: 'add_event'; title: string; date: string; start: string; end?: string; kind?: CalEvent['kind'] }
  | { type: 'log_meal'; foodId: string; grams: number; meal: MealType; date?: string }
  | { type: 'log_meal_items'; items: { foodId: string; grams: number }[]; meal: MealType; label: string }
  | { type: 'create_plan'; style: PlanStyle }
  | { type: 'set_targets'; calories?: number; protein?: number; carbs?: number; fat?: number }
export interface Proposal { id: string; action: ActionPayload; summary: string; status: 'pending' | 'approved' | 'cancelled' | 'failed'; note?: string }
export interface Suggestion { kind: 'workout' | 'meal' | 'generic'; title: string; detail?: string; items?: { foodId: string; grams: number }[]; meal?: MealType }
export interface JarvisMemory { topic?: string; suggestion?: Suggestion; awaiting?: { type: 'weight' | 'event_time' | 'task_title' | 'water'; payload?: Record<string, string | number> } }
export interface ChatMsg { id: string; role: 'user' | 'jarvis'; text: string; ts: number; source?: 'live' | 'demo'; proposals?: Proposal[]; error?: boolean }
export interface Conversation { id: string; title: string; createdAt: number; messages: ChatMsg[]; memory: JarvisMemory }

export interface Settings { jarvisShareData: boolean; notifications: boolean; busyMode: boolean; remindersEnabled: boolean; accessCode: string }

export interface AppData {
  version: number
  profile: Profile
  targets: Targets
  weights: WeightEntry[]
  measurements: Measurement[]
  photos: PhotoMeta[]
  plans: WorkoutPlan[]
  activePlanId: string | null
  sessions: WorkoutSession[]
  foodLog: FoodEntry[]
  customFoods: Food[]
  mealTemplates: MealTemplate[]
  events: CalEvent[]
  tasks: Task[]
  habits: Habit[]
  habitLogs: HabitLog[]
  water: WaterEntry[]
  sleep: SleepEntry[]
  conversations: Conversation[]
  settings: Settings
  snoozed: Record<string, number> // reminder key -> epoch ms until which it is snoozed
  dismissed: Record<string, true>
}
