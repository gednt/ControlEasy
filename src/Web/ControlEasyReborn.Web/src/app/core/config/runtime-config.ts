declare global {
  interface Window {
    __CE_RUNTIME_CONFIG__?: {
      timeZone?: string;
    };
  }
}

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export function getRuntimeTimeZone(): string {
  const configured = window.__CE_RUNTIME_CONFIG__?.timeZone?.trim();
  if (!configured) {
    return DEFAULT_TIME_ZONE;
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: configured });
    return configured;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function formatRuntimeDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: getRuntimeTimeZone(),
  }).format(new Date(value));
}
