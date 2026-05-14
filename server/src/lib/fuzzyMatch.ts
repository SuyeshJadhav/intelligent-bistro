import type { MenuItem } from "../data/menu";

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + indicator
      );
    }
  }
  return matrix[a.length][b.length];
}

export function resolveMenuMatches(text: string, menuItems: MenuItem[]): string {
  let resolvedText = text;
  const sortedItems = [...menuItems].sort((a, b) => b.name.length - a.name.length);
  const words = text.split(/\s+/);
  const matchedIndices = new Set<number>();
  
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      let overlap = false;
      for (let k = i; k < i + n; k++) {
        if (matchedIndices.has(k)) overlap = true;
      }
      if (overlap) continue;
      
      const ngram = words.slice(i, i + n).join(" ");
      const normalizedNgram = ngram.toLowerCase().replace(/[^\w\s]/g, "");
      
      if (normalizedNgram.length < 3) continue;
      
      let bestMatch: MenuItem | null = null;
      let bestDistance = Infinity;
      
      for (const item of sortedItems) {
        const targetName = item.name.toLowerCase().replace(/[^\w\s]/g, "");
        const targetId = item.id.toLowerCase().replace(/-/g, " ");
        
        const distName = levenshteinDistance(normalizedNgram, targetName);
        const distId = levenshteinDistance(normalizedNgram, targetId);
        
        const minDist = Math.min(distName, distId);
        const threshold = Math.max(1, Math.floor(Math.max(targetName.length, targetId.length) * 0.3));
        
        if (minDist <= threshold && minDist < bestDistance) {
          if (minDist <= Math.floor(normalizedNgram.length * 0.5)) {
             bestDistance = minDist;
             bestMatch = item;
          }
        }
      }
      
      if (bestMatch) {
        const escapedNgram = ngram.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<![\\w])${escapedNgram}(?![\\w])`, "i");
        if (regex.test(resolvedText)) {
            resolvedText = resolvedText.replace(regex, bestMatch.id);
            for (let k = i; k < i + n; k++) matchedIndices.add(k);
        }
      }
    }
  }
  
  return resolvedText;
}
