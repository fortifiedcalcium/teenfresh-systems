/** The line a cart item is: the same product in two versions is two lines. */
export const lineKey = (i) => (i.vid ? `${i.id}:${i.vid}` : i.id);
