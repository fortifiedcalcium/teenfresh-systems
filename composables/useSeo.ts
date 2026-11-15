// Title, description, Open Graph / Twitter tags, the canonical address and optional JSON-LD for one page.
// Every value may be a ref or a getter, so a page can fill it in once its data has loaded.
type MaybeGetter<T> = T | Ref<T> | (() => T);
interface SeoInput {
  title: MaybeGetter<string>; description?: MaybeGetter<string | undefined>; image?: MaybeGetter<string | null | undefined>;
  path?: MaybeGetter<string | undefined>; type?: "website" | "article" | "product"; jsonLd?: MaybeGetter<Record<string, unknown> | null | undefined>; noindex?: boolean;
}

const SUFFIX = "Teenfresh Events";

export function useSeo(input: SeoInput) {
  const site = String(useRuntimeConfig().public.siteUrl || "").replace(/\/$/, "");
  const title = computed(() => toValue(input.title));
  const abs = (u?: string | null) => (u ? (/^https?:/i.test(u) ? u : `${site}${u.startsWith("/") ? "" : "/"}${u}`) : undefined);
  const url = computed(() => abs(toValue(input.path) ?? useRoute().path));
  useState("seo-title", () => "").value = String(toValue(input.title));   // tells the route announcer this page names itself
  const description = computed(() => toValue(input.description) || "Register for Teenfresh events and shop official merch.");
  const image = computed(() => abs(toValue(input.image)));
  useHead(() => ({
    title: title.value ? `${title.value} · ${SUFFIX}` : SUFFIX,
    link: url.value ? [{ rel: "canonical", href: url.value }] : [],
    script: toValue(input.jsonLd) ? [{ type: "application/ld+json", innerHTML: JSON.stringify(toValue(input.jsonLd)) }] : [],
    meta: input.noindex ? [{ name: "robots", content: "noindex" }] : [],
  }));
  useSeoMeta({
    description, ogTitle: title, ogDescription: description, ogType: input.type === "product" ? "website" : (input.type ?? "website"), ogUrl: url, ogImage: image, ogSiteName: SUFFIX,
    twitterCard: () => (image.value ? "summary_large_image" : "summary"), twitterTitle: title, twitterDescription: description, twitterImage: image,
  });
}
