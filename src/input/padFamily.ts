import type { PadFamily } from './inputActions.ts';

/** Produttori noti (USB vendor id): Microsoft, Sony, Nintendo. */
const VENDOR_FAMILY: Record<string, PadFamily> = { '045e': 'xbox', '054c': 'playstation', '057e': 'switch' };

/**
 * Da `pad.id` alla famiglia di icone. FUNZIONE PURA. Riconosce l'identificatore di Chrome
 * («Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)») e quello di Firefox («054c-09cc-Wireless Controller»),
 * prima dal produttore e poi dal nome. Un pad che non si riconosce è `generic` (si mostrano le icone Xbox).
 */
export function padFamily(id: string): PadFamily {
  const text = id.toLowerCase();
  const vendor = /vendor:\s*([0-9a-f]{4})/.exec(text)?.[1] ?? /^([0-9a-f]{4})-[0-9a-f]{4}-/.exec(text)?.[1];
  if (vendor && VENDOR_FAMILY[vendor]) return VENDOR_FAMILY[vendor];
  if (/dualsense|dualshock|playstation|\bps[345]\b|sony/.test(text)) return 'playstation';
  if (/pro controller|joy-?con|nintendo|switch/.test(text)) return 'switch';
  if (/xbox|xinput|microsoft|x-box/.test(text)) return 'xbox';
  // «Wireless Controller» da solo è il nome che Chrome dà al DualShock 4/DualSense quando non mostra il produttore.
  if (/^wireless controller\b/.test(text)) return 'playstation';
  return 'generic';
}

/** Le icone da mostrare per una famiglia: `generic` usa quelle Xbox. */
export function glyphFamily(family: PadFamily): Exclude<PadFamily, 'generic'> {
  return family === 'generic' ? 'xbox' : family;
}
