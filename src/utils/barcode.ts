// Standard Code 128B encoding table (patterns of bar/space widths summing to 11 modules; Stop = 13 modules)
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export interface BarcodeBars {
  bars: Array<{ x: number; width: number }>;
  totalWidth: number;
}

export function encodeCode128B(rawText: string): BarcodeBars {
  const sanitized = rawText
    .replace(/[^\x20-\x7e]/g, '')
    .slice(0, 32) || 'ITM000000';

  const codes: number[] = [104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < sanitized.length; i++) {
    const code = sanitized.charCodeAt(i) - 32;
    codes.push(code);
    checksum += (i + 1) * code;
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop pattern

  const bars: Array<{ x: number; width: number }> = [];
  let cursor = 10; // Quiet zone left

  for (const symbol of codes) {
    const pattern = CODE128_PATTERNS[symbol] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]);
      if (i % 2 === 0) {
        bars.push({ x: cursor, width: w });
      }
      cursor += w;
    }
  }

  return {
    bars,
    totalWidth: cursor + 10, // Quiet zone right
  };
}

export function extractBarcodePrefix(
  itemName: string,
  mode: 'letters' | 'words' = 'letters'
): string {
  const cleanWords = itemName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (cleanWords.length === 0) {
    return 'ITM';
  }

  if (mode === 'words' && cleanWords.length >= 2) {
    const initials = cleanWords
      .slice(0, 3)
      .map((w) => w[0])
      .join('');
    if (initials.length === 3) {
      return initials;
    }
    const joined = cleanWords.join('');
    return (initials + joined.slice(initials.length)).slice(0, 3).padEnd(3, 'X');
  }

  const joined = cleanWords.join('');
  return joined.slice(0, 3).padEnd(3, 'X');
}

export function generateItemBarcode(
  itemName: string,
  mode: 'letters' | 'words' = 'letters'
): string {
  const prefix = extractBarcodePrefix(itemName, mode);
  const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
  return `${prefix}${randomDigits}`;
}
