/** Minuscules sans accents, pour comparer des saisies. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Vrai si chaque mot de la recherche apparaît dans le texte (ordre libre, accents ignorés). */
export function matchesSearch(text: string, search: string): boolean {
  const haystack = normalizeText(text)
  return normalizeText(search)
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}
