import { strFromU8, unzipSync } from 'fflate';

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const drawingNamespace = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const maxXmlSize = 20 * 1024 * 1024;
const relevantPart = /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/;

export async function readDocxTags(file: File): Promise<string[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let totalSize = 0;
  let parts: Record<string, Uint8Array>;
  try {
    parts = unzipSync(bytes, { filter: entry => {
      if (!relevantPart.test(entry.name)) return false;
      totalSize += entry.originalSize;
      if (totalSize > maxXmlSize) throw new Error('Les parties XML du document dépassent 20 Mo.');
      return true;
    } });
  } catch (cause) {
    throw new Error(`Impossible de lire le document Word : ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!parts['word/document.xml']) throw new Error('Le fichier ne contient pas de document Word valide.');
  const tags: string[] = [];
  for (const [name, content] of Object.entries(parts)) {
    const xml = new DOMParser().parseFromString(strFromU8(content), 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error(`La partie ${name} du document est illisible.`);
    const elements = Array.from(xml.getElementsByTagName('*'));
    for (const paragraph of elements.filter(element => element.localName === 'p' &&
      (element.namespaceURI === wordNamespace || element.namespaceURI === drawingNamespace))) {
      const text = Array.from(paragraph.getElementsByTagName('*')).filter(element => {
        if (element.localName !== 't' || (element.namespaceURI !== wordNamespace && element.namespaceURI !== drawingNamespace)) return false;
        let parent = element.parentElement;
        while (parent && !(parent.localName === 'p' && (parent.namespaceURI === wordNamespace || parent.namespaceURI === drawingNamespace))) parent = parent.parentElement;
        return parent === paragraph;
      }).map(element => element.textContent ?? '').join('');
      for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
        const tag = match[1].trim();
        if (tag) tags.push(tag);
      }
    }
  }
  return tags;
}
