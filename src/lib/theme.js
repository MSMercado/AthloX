export const lightColors = {
  bg:        '#f2f1ef',
  surface:   '#ffffff',
  primary:   '#0d0d0d',
  accent:    '#ff4d00',
  accentDim: '#fff0eb',
  green:     '#10b981',
  blue:      '#3b82f6',
  red:       '#ef4444',
  text:      '#0d0d0d',
  text2:     '#6b7280',
  text3:     '#a3a3a3',
  border:    '#e8e8e8',
};

export const darkColors = {
  bg:        '#111111',
  surface:   '#1c1c1e',
  primary:   '#f2f2f2',
  accent:    '#ff4d00',
  accentDim: '#2a1510',
  green:     '#10b981',
  blue:      '#3b82f6',
  red:       '#ef4444',
  text:      '#f2f2f2',
  text2:     '#9ca3af',
  text3:     '#6b7280',
  border:    '#2d2d2f',
};

// Keep default export for any code that hasn't migrated yet
export const colors = lightColors;

export const getColors = (dark) => dark ? darkColors : lightColors;

export const fonts = {
  sans:    'DMSans',
  mono:    'DMMono',
  heading: 'BarlowCondensed',
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
};
