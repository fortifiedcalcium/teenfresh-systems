/** Which tab of a combined admin page is open, kept in the address (?tab=shop) so a refresh or a link keeps it. The first tab is the default.
 *  Returns [active (a ref), select(key)]. */
export function useHubTab(tabs) {
  const route = useRoute();
  const router = useRouter();
  const active = computed(() => tabs.find((t) => t.key === route.query.tab)?.key || tabs[0].key);
  const select = (key) => router.replace({ path: route.path, query: key === tabs[0].key ? {} : { tab: key } });
  return [active, select];
}
