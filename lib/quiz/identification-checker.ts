export function normalizeIdentificationAnswer(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[right.length];
}

export function checkIdentificationAnswer(answer: string, acceptedAnswers: string[]) {
  const normalized = normalizeIdentificationAnswer(answer);
  if (!normalized || normalized.length < 2) return false;

  return acceptedAnswers.some((accepted) => {
    const expected = normalizeIdentificationAnswer(accepted);
    if (!expected) return false;
    if (normalized === expected) return true;
    // Forgive one small typo only for substantive answer phrases, never short labels.
    if (expected.length < 8 || normalized.length < 8) return false;
    return editDistance(normalized, expected) <= Math.min(2, Math.floor(expected.length * 0.12));
  });
}
