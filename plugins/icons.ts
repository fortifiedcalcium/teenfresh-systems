import * as icons from "~/lib/icons";

// Every icon (<IconCalendar />, <FacebookIcon /> ...) is available in every template without an import.
export default defineNuxtPlugin((nuxtApp) => {
  for (const [name, component] of Object.entries(icons)) nuxtApp.vueApp.component(name, component);
});
