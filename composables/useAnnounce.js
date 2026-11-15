// Live regions (4.1.3): announce without moving focus. <LiveRegions /> in app.vue shows the two messages.
export const useAnnounceState = () => ({ polite: useState("announce-polite", () => ""), assertive: useState("announce-assertive", () => "") });

export function useAnnounce() {
  const { polite, assertive } = useAnnounceState();
  return (message, level = "polite") => {
    const target = level === "assertive" ? assertive : polite;
    target.value = ""; // clear first so repeating the same text is announced again
    setTimeout(() => { target.value = message; }, 50);
  };
}
