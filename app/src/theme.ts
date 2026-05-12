// Design tokens accessible to JS (chart colors, gradient stops, etc.)
// CSS counterparts live in src/styles.css as :root variables.

export const tokens = {
  color: {
    blue:        '#1E3A5F',
    blueDeep:    '#0F2138',
    blueLight:   '#3A6CA8',
    orange:      '#EB9939',
    orangeLight: '#F2B86C',
    orangeDeep:  '#C77820',
    cream:       '#FAF6F0',
    paper:       '#FFFFFF',
    ink:         '#1A1F2C',
    inkSoft:     '#3A4150',
    muted:       '#6B7280',
    mutedSoft:   '#9CA3AF',
    border:      '#E8E1D4',
    borderSoft:  '#F0EAE0',
    positive:    '#2E9E5C',
    positiveSoft:'#D8EFE2',
    negative:    '#C84545',
    negativeSoft:'#F6DCDC',
    warning:     '#D08C2A',
  },
  font: {
    display: '"Fraunces", Georgia, "Times New Roman", serif',
    body:    '"DM Sans", "Helvetica Neue", system-ui, -apple-system, sans-serif',
    mono:    '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
  },
} as const;

export type ColorToken = keyof typeof tokens.color;
