import { useMediaQuery } from "@mui/material";
export const breakpoints = Object.freeze({ smallTablet: 768, tablet: 1024, desktop: 1280 });
export const useBreakpoint = () => ({
  isSmallTablet: useMediaQuery(`(min-width:${breakpoints.smallTablet}px)`),
  isTablet: useMediaQuery(`(min-width:${breakpoints.tablet}px)`),
  isDesktop: useMediaQuery(`(min-width:${breakpoints.desktop}px)`),
});
