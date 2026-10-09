// Design tokens — partits. visual system
// All screens import from here; no hardcoded values in components.

export const lightTheme = {
  // ── Palette ──────────────────────────────────────────────────────
  bg:          '#FCFCFD',
  panel:       '#F4F5F8',
  panelDeep:   '#EDEFF3',
  ink:         '#1A3D77',   // gradient stop 2 / scoreboard base
  ink2:        '#1E4A8F',   // gradient stop 1 / scoreboard top
  text:        '#0F1318',
  textSub:     '#5A6273',
  textFaint:   '#9098A8',
  border:      '#E5E7EE',
  borderHard:  '#D6DAE3',

  orange:      '#FF6A2C',   // marca — naranja balón
  orangeDeep:  '#E04A0E',
  orangeSoft:  '#FFE9DC',

  pos:         '#10A452',   // verde en pista / victoria
  posSoft:     '#DDF4E5',
  posDark:     '#0B6F38',

  neg:         '#E54848',   // rojo derrota / error
  negSoft:     '#FCE0E0',

  blue:        '#4071FF',
  blueSoft:    '#E0E8FF',

  white:       '#FFFFFF',
  onDark:      '#FFFFFF',   // texto sobre fondos de gradiente oscuro (ink/ink2)

  // ── Typography — font family names (loaded via @expo-google-fonts) ─
  fontReg:   'Inter_400Regular',
  fontMed:   'Inter_500Medium',
  fontSemi:  'Inter_600SemiBold',
  fontBold:  'Inter_700Bold',
  fontBlack: 'Inter_800ExtraBold',
  mono:      'Outfit_500Medium',   // fechas, horas, dorsales, marcadores
  monoBold:  'Outfit_700Bold',

  // ── Radii ─────────────────────────────────────────────────────────
  rCard:    14,
  rCardLg:  16,
  rBtn:     10,
  rBtnLg:   14,
  rInput:   10,
  rPill:    999,
  rHeaderB: 22,  // solo border-bottom-radius del scoreboard header
  rTag:     4,

  // ── Shadows — presets DRY para elevation consistente ──────────────
  shadowSm: { shadowColor: '#0F1318', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius:  4, elevation:  1 },
  shadowMd: { shadowColor: '#0F1318', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 10, elevation:  3 },
  shadowLg: { shadowColor: '#0F1318', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.12, shadowRadius: 20, elevation:  6 },
  shadowXl: { shadowColor: '#0F1318', shadowOffset: { width: 0, height:12 }, shadowOpacity: 0.16, shadowRadius: 32, elevation: 10 },

  // ── Extended palette ──────────────────────────────────────────────
  amber:    '#C9A000',   // celdas prohibidas / advertencia
  amberSoft:'#FFF8E0',
  negDark:  '#B82E2E',
  insetTop: 'rgba(255,255,255,0.07)',  // highlight interior superior en superficies oscuras

  // ── Dark mode flag ────────────────────────────────────────────────
  isDark: false,
};

export const darkTheme = {
  // ── Palette ──────────────────────────────────────────────────────
  bg:          '#181E2A',   // gris-azul oscuro (no negro)
  panel:       '#1E2638',   // superficie de tarjetas/secciones
  panelDeep:   '#161D2C',   // secciones anidadas (más profundo que panel)
  ink:         '#132E62',   // navy más oscuro que light (#1A3D77) pero no negro
  ink2:        '#0E2255',
  text:        '#B8C5D6',   // blanco apagado — menos agresivo que #E8ECF2
  textSub:     '#6E7F96',
  textFaint:   '#3D4A5C',
  border:      '#252E3E',
  borderHard:  '#2E3A50',

  orange:      '#D4622A',   // naranja más oscuro/apagado (no neon)
  orangeDeep:  '#B8501C',
  orangeSoft:  '#2E1A0C',

  pos:         '#14A85C',   // verde ligeramente apagado
  posSoft:     '#0E2518',
  posDark:     '#0F7A42',

  neg:         '#D44444',   // rojo apagado (no coral brillante)
  negSoft:     '#2A0C0C',

  blue:        '#5078E8',   // azul ligeramente apagado
  blueSoft:    '#141E38',

  white:       '#242D42',   // superficies "blancas" → oscuras en dark mode
  onDark:      '#B8C5D6',   // texto sobre fondos de gradiente oscuro (ink/ink2)

  // ── Typography — idéntica en ambos modos ─────────────────────────
  fontReg:   'Inter_400Regular',
  fontMed:   'Inter_500Medium',
  fontSemi:  'Inter_600SemiBold',
  fontBold:  'Inter_700Bold',
  fontBlack: 'Inter_800ExtraBold',
  mono:      'Outfit_500Medium',
  monoBold:  'Outfit_700Bold',

  // ── Radii — idénticos ─────────────────────────────────────────────
  rCard:    14,
  rCardLg:  16,
  rBtn:     10,
  rBtnLg:   14,
  rInput:   10,
  rPill:    999,
  rHeaderB: 22,
  rTag:     4,

  // ── Shadows — más visibles sobre fondo oscuro ─────────────────────
  shadowSm: { shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius:  4, elevation:  1 },
  shadowMd: { shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 10, elevation:  3 },
  shadowLg: { shadowColor: '#000000', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.45, shadowRadius: 20, elevation:  6 },
  shadowXl: { shadowColor: '#000000', shadowOffset: { width: 0, height:12 }, shadowOpacity: 0.55, shadowRadius: 32, elevation: 10 },

  // ── Extended palette ──────────────────────────────────────────────
  amber:    '#C8A000',   // ámbar apagado
  amberSoft:'#28210A',
  negDark:  '#A83030',
  insetTop: 'rgba(255,255,255,0.05)',

  // ── Dark mode flag ────────────────────────────────────────────────
  isDark: true,
};

// Retrocompatibilidad: T sigue disponible como alias del tema claro
export const T = lightTheme;
