import PizZip from 'pizzip';

export interface ExtractedPlaceholders {
  placeholders: string[];
  detectedDelimiters: { start: string; end: string };
  rawText: string;
}

export function extractPlaceholdersFromDocx(arrayBuffer: ArrayBuffer): ExtractedPlaceholders {
  const zip = new PizZip(arrayBuffer);
  
  // Combine all XML text from word/ folder (document, headers, footers)
  let fullXmlText = '';
  Object.keys(zip.files).forEach((filename) => {
    if (filename.startsWith('word/') && filename.endsWith('.xml')) {
      fullXmlText += zip.files[filename].asText() + '\n';
    }
  });

  // Strip all XML tags to reconstruct split placeholders
  const cleanText = fullXmlText.replace(/<[^>]+>/g, '');

  // Define regexes for the three major placeholder styles
  const dblCurlyRegex = /\{\{([^}]+)\}\}/g;
  const dblAngleRegex = /<<([^>]+)>>/g;
  const sglCurlyRegex = /\{([^{}]+)\}/g;

  const dblCurlyMatches: string[] = [];
  const dblAngleMatches: string[] = [];
  const sglCurlyMatches: string[] = [];

  let match;
  
  // 1. Search for double curly braces: {{placeholder}}
  dblCurlyRegex.lastIndex = 0;
  while ((match = dblCurlyRegex.exec(cleanText)) !== null) {
    const key = match[1].trim();
    // Exclude basic docxtemplater sections/commands like {#section}, {/section}, {^section}, etc.
    if (!key.startsWith('#') && !key.startsWith('/') && !key.startsWith('^') && !key.startsWith('$') && !key.startsWith('>')) {
      dblCurlyMatches.push(key);
    }
  }

  // 2. Search for double angle brackets: <<placeholder>>
  dblAngleRegex.lastIndex = 0;
  while ((match = dblAngleRegex.exec(cleanText)) !== null) {
    const key = match[1].trim();
    if (!key.startsWith('#') && !key.startsWith('/') && !key.startsWith('^') && !key.startsWith('$') && !key.startsWith('>')) {
      dblAngleMatches.push(key);
    }
  }

  // 3. Search for single curly braces: {placeholder}
  sglCurlyRegex.lastIndex = 0;
  while ((match = sglCurlyRegex.exec(cleanText)) !== null) {
    const key = match[1].trim();
    // Exclude things that are likely JSON, CSS, XML namespaces or other code
    if (
      !key.startsWith('#') && 
      !key.startsWith('/') && 
      !key.startsWith('^') && 
      !key.startsWith('$') && 
      !key.startsWith('>') && 
      key.length < 50 && 
      !key.includes(':') && 
      !key.includes('"') && 
      !key.includes('=') && 
      !key.includes('/') && 
      !/^[a-zA-Z0-9_\-\s]+$/.test(key) === false
    ) {
      sglCurlyMatches.push(key);
    }
  }

  // Determine the most common style
  const dblCurlyCount = dblCurlyMatches.length;
  const dblAngleCount = dblAngleMatches.length;
  // For single curly, we subtract double curly count because single curly regex will match double curly too!
  const sglCurlyCount = Math.max(0, sglCurlyMatches.length - dblCurlyCount * 2);

  let detectedDelimiters = { start: '<<', end: '>>' }; // default
  let placeholders: string[] = [];

  if (dblCurlyCount >= dblAngleCount && dblCurlyCount >= sglCurlyCount && dblCurlyCount > 0) {
    detectedDelimiters = { start: '{{', end: '}}' };
    placeholders = Array.from(new Set(dblCurlyMatches));
  } else if (dblAngleCount >= dblCurlyCount && dblAngleCount >= sglCurlyCount && dblAngleCount > 0) {
    detectedDelimiters = { start: '<<', end: '>>' };
    placeholders = Array.from(new Set(dblAngleMatches));
  } else if (sglCurlyCount > 0) {
    detectedDelimiters = { start: '{', end: '}' };
    // Filter out double curly matches from single curly list
    const filteredSgl = sglCurlyMatches.filter(m => !dblCurlyMatches.some(dm => dm.includes(m)));
    placeholders = Array.from(new Set(filteredSgl));
  } else {
    // Fallback: search for any of them, prefer << >>
    placeholders = Array.from(new Set([...dblAngleMatches, ...dblCurlyMatches]));
  }

  return {
    placeholders: placeholders.sort(),
    detectedDelimiters,
    rawText: cleanText
  };
}
