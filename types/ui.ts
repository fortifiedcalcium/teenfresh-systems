export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "new" | "popular" | "low";
export type ButtonVariant = "primary" | "secondary" | "accent" | "danger" | "ghost";
export interface NavLink { label: string; to: string; badge?: number }
export interface CartStubLine { key: string; title: string; subtitle?: string; qty: number; price: string }
