// Roles definition - migrated from index.html
export const ROLES = {
  base: {
    label: 'Base',
    color: '#1d4ed8',
    bg: '#dbeafe',
    order: 1,
  },
  escolta: {
    label: 'Escolta',
    color: '#7c3aed',
    bg: '#ede9fe',
    order: 2,
  },
  alero: {
    label: 'Alero',
    color: '#0369a1',
    bg: '#e0f2fe',
    order: 3,
  },
  alapivot: {
    label: 'Ala-Pívot',
    color: '#065f46',
    bg: '#d1fae5',
    order: 4,
  },
  pivot: {
    label: 'Pívot',
    color: '#92400e',
    bg: '#fef3c7',
    order: 5,
  },
  receptor: {
    label: 'Receptor',
    color: '#374151',
    bg: '#f3f4f6',
    order: 6,
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

// Helper to convert PWA saved Tailwind color classes (e.g. 'text-blue-600') to Hex codes
import { COLORS } from './colors';

export const getRoleConfig = (team, roleKey) => {
  if (!roleKey) return ROLES['receptor'];
  
  // Custom roles from PWA?
  if (team?.roles && team.roles[roleKey]) {
    const customRole = team.roles[roleKey];
    
    // Parse tailwind text color -> hex
    let colorHex = ROLES[roleKey]?.color || COLORS.slate600;
    if (typeof customRole.color === 'string' && customRole.color.startsWith('text-')) {
      const parts = customRole.color.split('-');
      if (parts.length >= 3) {
        // e.g., 'blue', '600'
        const colorName = parts[1];
        if (colorName === 'blue') colorHex = COLORS.primary;
        else if (colorName === 'red') colorHex = COLORS.danger;
        else if (colorName === 'green') colorHex = COLORS.success;
        else if (colorName === 'yellow' || colorName === 'orange') colorHex = COLORS.warning;
        else if (colorName === 'slate') colorHex = COLORS.slate600;
        else colorHex = COLORS.primaryDark; // fallback
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
        else bgHex = COLORS.slate200; // fallback
      }
    } else if (customRole.bg && customRole.bg.startsWith('#')) {
      bgHex = customRole.bg;
    }

    return {
      label: customRole.label || ROLES[roleKey]?.label || roleKey,
      color: colorHex,
      bg: bgHex,
      order: customRole.order || ROLES[roleKey]?.order || 99
    };
  }
  
  // Fallback to RN defaults
  return ROLES[roleKey] || ROLES['receptor'];
};

// Helper for UI Color Selection
export const ROLE_COLORS_PALETTE = [
  { id: 'blue', color: COLORS.primary, bg: COLORS.primaryLight },
  { id: 'green', color: COLORS.success, bg: COLORS.successLight },
  { id: 'slate', color: COLORS.slate600, bg: COLORS.slate100 },
  { id: 'red', color: COLORS.danger, bg: COLORS.dangerLight },
  { id: 'orange', color: COLORS.warning, bg: COLORS.warningLight },
  { id: 'purple', color: '#7c3aed', bg: '#ede9fe' },
];

// Helper to get available role keys
export const getAvailableRoleKeys = (team) => {
  if (team?.roles && Object.keys(team.roles).length > 0) {
    return Object.keys(team.roles).sort((a, b) => (team.roles[a].order || 99) - (team.roles[b].order || 99));
  }
  return ROLE_KEYS; // ['base', 'escolta', 'alero', 'alapivot', 'pivot', 'receptor']
};
