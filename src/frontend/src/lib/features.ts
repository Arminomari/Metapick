/**
 * Feature flags. A visible broken feature is worse than none:
 * modules stay hidden until they actually deliver what they promise.
 */
export const FEATURES = {
  /** Hidden until the unique public creator link (vyrle.co/l/<handle>)
   *  is built — the current page only lists campaign deep links. */
  linkTree: false,
};
