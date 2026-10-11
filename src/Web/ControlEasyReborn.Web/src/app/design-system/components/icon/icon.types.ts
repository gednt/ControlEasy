/** App-level icon names aligned with mockup/assets/icons.js and shell usage. */
export type LucideIconName =
  | 'dashboard'
  | 'users'
  | 'user'
  | 'user-check'
  | 'building'
  | 'calendar'
  | 'car'
  | 'briefcase'
  | 'package'
  | 'settings'
  | 'search'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'eye'
  | 'eye-off'
  | 'x'
  | 'x-circle'
  | 'plus'
  | 'refresh'
  | 'refresh-cw'
  | 'more-horizontal'
  | 'edit'
  | 'trash-2'
  | 'log-out'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'check'
  | 'check-circle'
  | 'info'
  | 'alert-triangle'
  | 'alert-circle'
  | 'home'
  | 'layout-grid'
  | 'camera'
  | 'upload'
  | 'image'
  | 'download'
  | 'file-text'
  // Phase 26 (DOOR-13 + DOOR-14) — device health page + sidebar nav
  | 'pulse'
  | 'activity';

const ICON_ALIASES: Partial<Record<LucideIconName, string>> = {
  dashboard: 'layout-dashboard',
  refresh: 'refresh-cw',
  edit: 'pencil',
  'more-horizontal': 'ellipsis',
  'alert-triangle': 'triangle-alert',
  'alert-circle': 'circle-alert',
  home: 'house',
  'x-circle': 'circle-x',
  'check-circle': 'circle-check',
  'user-check': 'user-check',
  package: 'package',
  download: 'download',
  'file-text': 'file-text',
  // Phase 26 - lucide-angular exposes `activity` as the alias for pulse-line icons.
  activity: 'activity',
  pulse: 'pulse',
};

export function resolveLucideIconName(name: LucideIconName): string {
  return ICON_ALIASES[name] ?? name;
}
