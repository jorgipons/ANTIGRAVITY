// Roles definition - migrated from index.html
export const ROLES = {
  base: {
    label: 'Base',
    color:     '#3B82F6', // blue-500
    bg:        '#EFF6FF', // blue-50
    colorDark: '#5B8FD4', // blue apagado para dark mode
    bgDark:    '#172038', // fondo azul oscuro
    order: 1,
    position: 1,
  },
  escolta: {
    label: 'Escolta',
    color:     '#8B5CF6', // violet-500
    bg:        '#F5F3FF', // violet-50
    colorDark: '#8A6ECC', // violeta apagado
    bgDark:    '#1E1838', // fondo violeta oscuro
    order: 2,
    position: 2,
  },
  alero: {
    label: 'Alero',
    color:     '#0EA5E9', // sky-500
    bg:        '#F0F9FF', // sky-50
    colorDark: '#4A9EC4', // sky apagado
    bgDark:    '#141E2E', // fondo sky oscuro
    order: 3,
    position: 3,
  },
  alapivot: {
    label: 'Ala-Pívot',
    color:     '#10B981', // emerald-500
    bg:        '#ECFDF5', // emerald-50
    colorDark: '#2EA870', // emerald apagado
    bgDark:    '#102618', // fondo emerald oscuro
    order: 4,
    position: 4,
  },
  pivot: {
    label: 'Pívot',
    color:     '#F59E0B', // amber-500
    bg:        '#FFFBEB', // amber-50
    colorDark: '#C0880A', // amber apagado
    bgDark:    '#261E08', // fondo amber oscuro
    order: 5,
    position: 5,
  },
  receptor: {
    label: 'Receptor',
    color:     '#64748B', // slate-500
    bg:        '#F8FAFB', // slate-50
    colorDark: '#5A6E84', // slate apagado
    bgDark:    '#1A2030', // fondo slate oscuro
    order: 6,
    position: null,
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

// Helper to convert PWA saved Tailwind color classes (e.g. 'text-blue-600') to Hex codes
import { COLORS } from './colors';

export const getRoleConfig = (team, roleKey, isDark = false) => {
  if (!roleKey) return _maybeDark(ROLES['receptor'], isDark);

  // Custom roles from PWA?
  if (team?.roles && team.roles[roleKey]) {
    const customRole = team.roles[roleKey];

    // Parse tailwind text color -> hex
    let colorHex = ROLES[roleKey]?.color || COLORS.slate600;
    if (typeof customRole.color === 'string' && customRole.color.startsWith('text-')) {
      const parts = customRole.color.split('-');
      if (parts.length >= 3) {
        const colorName = parts[1];
        if (colorName === 'blue') colorHex = COLORS.primary;
        else if (colorName === 'red') colorHex = COLORS.danger;
        else if (colorName === 'green') colorHex = COLORS.success;
        else if (colorName === 'yellow' || colorName === 'orange') colorHex = COLORS.warning;
        else if (colorName === 'slate') colorHex = COLORS.slate600;
        else colorHex = COLORS.primaryDark;
      }
    } else if (customRole.color && customRole.color.startsWith('#')) {
      colorHex = customRole.color;
    }

    // Parse tailwind bg color -> hex
    let bgHex = ROLES[roleKey]?.bg || COLORS.slate100;
    if (typeof customRole.bg === 'string' && customRole.bg.startsWith('bg-')) {
      const parts = customRole.bg.split('-');
      if (parts.length >= 3) {
        const colorName = parts[1];
        if (colorName === 'blue') bgHex = COLORS.primaryLight;
        else if (colorName === 'red') bgHex = COLORS.dangerLight;
        else if (colorName === 'green') bgHex = COLORS.successLight;
        else if (colorName === 'yellow' || colorName === 'orange') bgHex = COLORS.warningLight;
        else if (colorName === 'slate') bgHex = COLORS.slate100;
        else bgHex = COLORS.slate200;
      }
    } else if (customRole.bg && customRole.bg.startsWith('#')) {
      bgHex = customRole.bg;
    }

    const result = {
      label: customRole.label || ROLES[roleKey]?.label || roleKey,
      color: colorHex,
      bg: bgHex,
      order: customRole.order || ROLES[roleKey]?.order || 99,
      position: customRole.position ?? ROLES[roleKey]?.position ?? null,
    };
    return isDark ? _rgbaDark(result) : result;
  }

  // Fallback to RN defaults — dark mode variant if requested
  return _maybeDark(ROLES[roleKey] || ROLES['receptor'], isDark);
};

// Genera bg/color oscuros a partir del hex principal (funciona con roles custom y default)
function _rgbaDark(role) {
  const hex = role.color;
  if (hex && hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return {
      ...role,
      color: `rgba(${r},${g},${b},0.72)`,   // color apagado
      bg:    `rgba(${r},${g},${b},0.14)`,   // fondo muy tenue
    };
  }
  return role;
}

function _maybeDark(role, isDark) {
  return isDark ? _rgbaDark(role) : role;
}

// Helper for UI Color Selection
export const ROLE_COLORS_PALETTE = [
  { id: 'blue',   color: COLORS.primary,     bg: COLORS.primaryLight  },
  { id: 'green',  color: COLORS.success,     bg: COLORS.successLight  },
  { id: 'slate',  color: COLORS.slate600,    bg: COLORS.slate100      },
  { id: 'red',    color: COLORS.danger,      bg: COLORS.dangerLight   },
  { id: 'orange', color: COLORS.warning,     bg: COLORS.warningLight  },
  { id: 'purple', color: '#7c3aed',          bg: '#ede9fe'            },
];

// Helper to get available role keys
export const getAvailableRoleKeys = (team) => {
  if (team?.roles && Object.keys(team.roles).length > 0) {
    return Object.keys(team.roles).sort((a, b) => (team.roles[a].order || 99) - (team.roles[b].order || 99));
  }
  return ROLE_KEYS;
};
