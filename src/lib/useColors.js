import useStore from '../store/useStore';
import { getColors } from './theme';

/** Returns the current color palette based on dark/light mode preference. */
export default function useColors() {
  const darkMode = useStore(s => s.darkMode);
  return getColors(darkMode);
}
