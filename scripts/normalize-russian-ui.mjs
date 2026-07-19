import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dictionaries = {
  ru: JSON.parse(
    fs.readFileSync(path.join(root, "messages", "ru.json"), "utf8")
  ),
  en: JSON.parse(
    fs.readFileSync(path.join(root, "messages", "en.json"), "utf8")
  ),
};

function collectKeys(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? collectKeys(child, fullKey)
      : [fullKey];
  });
}

const ruKeys = new Set(collectKeys(dictionaries.ru));
const enKeys = new Set(collectKeys(dictionaries.en));
const missingInEnglish = [...ruKeys].filter((key) => !enKeys.has(key));
const missingInRussian = [...enKeys].filter((key) => !ruKeys.has(key));

if (missingInEnglish.length || missingInRussian.length) {
  console.error("Словари интерфейса не синхронизированы.");

  for (const key of missingInEnglish) {
    console.error(`Нет в en.json: ${key}`);
  }
  for (const key of missingInRussian) {
    console.error(`Нет в ru.json: ${key}`);
  }

  process.exitCode = 1;
} else {
  console.log(`Словари ru/en синхронизированы: ${ruKeys.size} ключей.`);
}
