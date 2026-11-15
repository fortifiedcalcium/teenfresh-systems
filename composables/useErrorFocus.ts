/** [signal, bump]: call bump() from a form's "invalid submit" handler so the summary takes focus. */
export function useErrorFocus(): [Ref<number>, () => void] {
  const signal = ref(0);
  return [signal, () => { signal.value += 1; }];
}
