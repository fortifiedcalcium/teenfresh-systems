// Toasts: the list lives in shared state, <ToastHost /> (in app.vue) draws it. Errors stay until dismissed (2.2.1).
export const useToastItems = () => useState("toasts", () => []);

export function useToast() {
  const items = useToastItems();
  const dismiss = (id) => { items.value = items.value.filter((t) => t.id !== id); };
  return (message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    items.value = [...items.value, { id, message, type }];
    if (type !== "error") setTimeout(() => dismiss(id), 8000);
  };
}
