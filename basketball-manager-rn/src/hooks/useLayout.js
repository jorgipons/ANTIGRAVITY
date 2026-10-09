// src/hooks/useLayout.js
import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 600;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const IS_TABLET = width > TABLET_BREAKPOINT;
  const IS_LANDSCAPE = width > height;
  const IS_TABLET_LANDSCAPE = IS_TABLET && IS_LANDSCAPE;
  return { IS_TABLET, IS_LANDSCAPE, IS_TABLET_LANDSCAPE, width, height };
}
