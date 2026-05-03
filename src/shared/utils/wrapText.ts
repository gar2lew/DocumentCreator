export interface WrappedLine {
  text: string;
  y: number;
}

/**
 * Wraps text into lines that fit within maxWidth at given fontSize.
 * Returns array of {text, y} for rendering.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  lineHeight = 1.2,
  startY = 0
): WrappedLine[] {
  const avgCharWidth = fontSize * 0.55;
  const charsPerLine = Math.max(1, Math.floor(maxWidth / avgCharWidth));
  const lines: WrappedLine[] = [];
  const paragraphs = text.split('\n');

  let y = startY;
  for (const para of paragraphs) {
    if (para.trim() === '') {
      y += fontSize * lineHeight;
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (test.length > charsPerLine && currentLine) {
        lines.push({ text: currentLine, y });
        y += fontSize * lineHeight;
        currentLine = word;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) {
      lines.push({ text: currentLine, y });
      y += fontSize * lineHeight;
    }
  }

  return lines;
}

/**
 * Measures approximate text width in points.
 */
export function measureTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}
