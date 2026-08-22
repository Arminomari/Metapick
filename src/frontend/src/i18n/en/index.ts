import { common } from './common';

/**
 * Merged Swedish→English dictionary. One namespace file per page/area —
 * add new namespaces as separate files and spread them here so parallel
 * work never touches the same file.
 */
export const EN: Record<string, string> = {
  ...common,
};
