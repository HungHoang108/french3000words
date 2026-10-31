const STORAGE_KEY = "french3000-imported-v1";

export function loadImportedWords(words, showToast) {
  let imported;
  try {
    imported = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    console.error("Could not load imported vocabulary.", error);
    showToast("Could not load imported words from browser storage.");
    return;
  }

  if (!Array.isArray(imported)) {
    const error = new Error("Imported vocabulary must be an array.");
    console.error("Could not load imported vocabulary.", error);
    showToast("Could not load imported words from browser storage.");
    return;
  }

  const seen = new Set(words.map((word) => wordKey(word.fr)));
  imported.forEach((word) => {
    if (typeof word?.fr !== "string") return;
    const key = wordKey(word.fr);
    if (key && !seen.has(key)) {
      seen.add(key);
      words.push({ ...word, id: words.length + 1, status: "new" });
    }
  });
}

export function mountFrequencyImport(words, { onImport, showToast }) {
  const toolbar = document.querySelector("#main .toolbar");
  if (!toolbar || document.getElementById("frequencyImport")) return;

  const notice = document.createElement("div");
  notice.id = "frequencyImport";
  notice.className = "notice";
  notice.innerHTML =
    'Add a downloaded frequency list. <a href="https://noosflashcards.com/resources/frequency-lists/french" target="_blank" rel="noopener noreferrer">Open the Noos French frequency list</a>, download its CSV, then select it here. Existing headwords are skipped.';

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,text/csv";
  input.className = "field";
  input.setAttribute("aria-label", "Import French frequency CSV");
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      mergeFrequencyCSV(await file.text(), words, onImport, showToast);
    } catch (error) {
      console.error("Could not import frequency-list CSV.", error);
      showToast("Could not import CSV. Use the Noos CSV with word and meaning columns.");
    }
  };

  notice.appendChild(document.createElement("br"));
  notice.appendChild(input);
  toolbar.parentNode.insertBefore(notice, toolbar);
}

function mergeFrequencyCSV(text, words, onImport, showToast) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("No vocabulary rows found.");

  const columns = getColumns(rows[0]);
  if (columns.word < 0 || columns.meaning < 0) {
    throw new Error("Expected Noos CSV columns: word and meaning.");
  }

  const existing = new Set(words.map((word) => wordKey(word.fr)));
  const added = rows.slice(1).flatMap((row) => {
    const lemma = columns.lemma >= 0 ? row[columns.lemma]?.trim() : "";
    const fr = (lemma || row[columns.word] || "").trim();
    const en = (row[columns.meaning] || "").trim();
    const key = wordKey(fr);

    if (!fr || !en || !key || existing.has(key)) return [];
    existing.add(key);

    const tags = columns.tags >= 0 ? row[columns.tags] || "" : "";
    const exampleColumn = columns.translation >= 0 ? columns.translation : columns.example;
    return [
      {
        fr,
        en,
        pos: getPartOfSpeech(columns.type >= 0 ? row[columns.type] || "" : ""),
        level: getLevel(tags),
        cat: "Frequency list",
        example: exampleColumn >= 0 ? (row[exampleColumn] || "").trim() : "",
        status: "new",
      },
    ];
  });

  const prior = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!Array.isArray(prior)) throw new Error("Saved imported vocabulary must be an array.");

  const priorKeys = new Set(prior.map((word) => wordKey(word.fr)));
  const fresh = added.filter((word) => !priorKeys.has(wordKey(word.fr)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...prior, ...fresh]));
  fresh.forEach((word) => words.push({ ...word, id: words.length + 1 }));

  showToast(`Added ${fresh.length} unique words; ${added.length - fresh.length} duplicates skipped.`);
  onImport();
}

function getColumns(headerRow) {
  const header = headerRow.map((value) => value.trim().toLowerCase());
  return {
    word: header.indexOf("word"),
    meaning: header.indexOf("meaning"),
    type: header.indexOf("type"),
    example: header.indexOf("example"),
    translation: header.indexOf("translation"),
    lemma: header.indexOf("lemma"),
    tags: header.indexOf("tags"),
  };
}

function getPartOfSpeech(type) {
  const normalizedType = type.toLowerCase();
  if (/verb/.test(normalizedType)) return "verb";
  if (/adjective/.test(normalizedType)) return "adjective";
  if (/adverb/.test(normalizedType)) return "adverb";
  if (/preposition/.test(normalizedType)) return "preposition";
  if (/noun/.test(normalizedType)) return "noun";
  return "expression";
}

function getLevel(tags) {
  if (/a1/i.test(tags)) return "A1";
  if (/a2/i.test(tags)) return "A2";
  return "B1";
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function wordKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/^(le|la|les|un|une|des|l|d)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
