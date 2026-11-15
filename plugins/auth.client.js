import { startAuth } from "~/composables/useAuth.js";

export default defineNuxtPlugin(() => { startAuth(); });
