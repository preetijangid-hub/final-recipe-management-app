const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeList = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();

  return values
    .map((value) => normalizeText(value))
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    })
    .map((value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase()));
};

module.exports = { normalizeText, normalizeList };