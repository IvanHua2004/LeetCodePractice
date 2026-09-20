export const colors = {
  page: '#0A0A0C',
  surface: '#100F13',
  surfaceRaised: '#17171C',
  line: '#22222A',
  lineSoft: '#1A1A20',

  text: '#EDEDEF',
  textBright: '#F7F7F9',
  textMuted: '#8B8B96',
  textDim: '#6A6A74',
  textFaint: '#55555E',

  lime: '#C9F75A',
  limeSoft: '#D9F581',
  limeDeep: '#A9CE56',

  teal: '#5EEAD4',
  tealSoft: '#7FE8D6',
  tealDeep: '#63DDC4',

  amber: '#EFC14B',
} as const;

export const fonts = {
  sans: "'Space Grotesk', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const syntax = {
  keyword: '#A9B4F7',
  builtin: '#63DDC4',
  number: '#7FDCA8',
  string: '#C3E88D',
  operator: '#7E7E88',
  plain: '#D4D4DA',
} as const;

export const label = {
  fontFamily: fonts.mono,
  fontSize: 10,
  letterSpacing: '0.22em',
  color: colors.textMuted,
} as const;
