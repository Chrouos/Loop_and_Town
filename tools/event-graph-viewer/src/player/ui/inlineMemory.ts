export type InlineExcerpt = { id: string; text: string };
export type InlineAnchor = { id: string; start: number; end: number };

const punctuation = /[\s，。、：「」！？；（）()／/·…]/u;

function longestCommonSpan(line: string, excerpt: string): { start: number; end: number } | null {
  let bestStart = -1;
  let bestLength = 0;
  for (let i = 0; i < line.length; i++) {
    for (let j = 0; j < excerpt.length; j++) {
      let length = 0;
      while (i + length < line.length &&
             j + length < excerpt.length &&
             line[i + length] === excerpt[j + length] &&
             !punctuation.test(line[i + length])) length++;
      if (length > bestLength) { bestStart = i; bestLength = length; }
    }
  }
  return bestLength >= 4 ? { start: bestStart, end: bestStart + bestLength } : null;
}

// Map an authored excerpt to actually visible prose; never display invented or paraphrased words.
export function inlineAnchors(line: string, excerpts: InlineExcerpt[]): InlineAnchor[] {
  const candidates = excerpts.flatMap(excerpt => {
    const exact = line.indexOf(excerpt.text);
    const span = exact >= 0
      ? { start: exact, end: exact + excerpt.text.length }
      : longestCommonSpan(line, excerpt.text);
    return span ? [{ id: excerpt.id, ...span }] : [];
  });
  const anchors: InlineAnchor[] = [];
  for (const candidate of candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))) {
    if (anchors.every(other => other.end <= candidate.start || candidate.end <= other.start)) anchors.push(candidate);
  }
  return anchors;
}
