// After the page has been hydrated: the saved cart is only known in the browser, and loading it earlier would make the first render differ from the server HTML.
export default defineNuxtPlugin((nuxtApp) => { nuxtApp.hook("app:mounted", () => useCartStore().init()); });
