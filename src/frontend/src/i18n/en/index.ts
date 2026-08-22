import { common } from './common';
import { auth } from './auth';
import { landing } from './landing';
import { creator } from './creator';
import { brand } from './brand';
import { components } from './components';
import { admin } from './admin';

/**
 * Merged Swedish→English dictionary. One namespace file per page/area —
 * add new namespaces as separate files and spread them here so parallel
 * work never touches the same file.
 */
export const EN: Record<string, string> = {
  ...common,
  ...auth,
  ...landing,
  ...creator,
  ...brand,
  ...components,
  ...admin,
};
