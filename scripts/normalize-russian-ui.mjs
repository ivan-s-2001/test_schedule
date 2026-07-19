import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const sourceRoots = [path.join(root, "src"), path.join(root, "messages")];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json"]);

const translations = {
  "Schichtplaner 2.0": "График смен",
  Schichtplaner: "График смен",
  Schichtplaene: "Графики смен",
  "Schichtpläne": "Графики смен",
  Schichtplan: "График смен",
  Zeiterfassung: "Учёт времени",
  Mitarbeiter: "Сотрудники",
  Arbeitsbereiche: "Подразделения",
  Arbeitsbereich: "Подразделение",
  Auswertung: "Отчёты",
  Einstellungen: "Настройки",
  "KI-Assistent": "ИИ-помощник",
  Navigation: "Навигация",
  Anmelden: "Войти",
  Abmelden: "Выйти",
  Registrieren: "Зарегистрироваться",
  Passwort: "Пароль",
  Vorname: "Имя",
  Nachname: "Фамилия",
  Firmenname: "Название компании",
  "E-Mail": "Электронная почта",
  Speichern: "Сохранить",
  Abbrechen: "Отмена",
  Loeschen: "Удалить",
  "Löschen": "Удалить",
  Bearbeiten: "Изменить",
  Erstellen: "Создать",
  Suchen: "Поиск",
  Suche: "Поиск",
  Filtern: "Фильтр",
  Exportieren: "Экспортировать",
  Export: "Экспорт",
  "Wird geladen...": "Загрузка...",
  "Laden...": "Загрузка...",
  "Keine Ergebnisse": "Ничего не найдено",
  Bestaetigen: "Подтвердить",
  "Bestätigen": "Подтвердить",
  Zurueck: "Назад",
  "Zurück": "Назад",
  Weiter: "Далее",
  Alle: "Все",
  Aktiv: "Активен",
  Inaktiv: "Неактивен",
  Oeffnen: "Открыть",
  "Öffnen": "Открыть",
  Schliessen: "Закрыть",
  "Schließen": "Закрыть",
  Hinzufuegen: "Добавить",
  "Hinzufügen": "Добавить",
  Entfernen: "Удалить",
  Aktualisieren: "Обновить",
  Uebernehmen: "Применить",
  "Übernehmen": "Применить",
  Ablehnen: "Отклонить",
  Beschreibung: "Описание",
  Titel: "Название",
  Farbe: "Цвет",
  Aktionen: "Действия",
  Aktion: "Действие",
  Status: "Статус",
  Rolle: "Роль",
  Datum: "Дата",
  Von: "С",
  Bis: "До",
  Heute: "Сегодня",
  Gestern: "Вчера",
  Morgen: "Завтра",
  Stunden: "Часы",
  Minuten: "Минуты",
  Stunde: "Час",
  Minute: "Минута",
  Kommentar: "Комментарий",
  Optional: "Необязательно",
  Pflichtfeld: "Обязательное поле",
  Auswaehlen: "Выбрать",
  "Auswählen": "Выбрать",
  "Keine Daten": "Нет данных",
  "Mehr anzeigen": "Показать ещё",
  "Weniger anzeigen": "Скрыть",
  Owner: "Владелец",
  Inhaber: "Владелец",
  Admin: "Администратор",
  Manager: "Руководитель",
  "Nicht freigeschaltet": "Не активирован",
  Genehmigt: "Одобрено",
  Ausstehend: "На рассмотрении",
  Abgelehnt: "Отклонено",
  Freigegeben: "Опубликовано",
  Veroeffentlicht: "Опубликовано",
  "Veröffentlicht": "Опубликовано",
  Unsichtbar: "Скрыт",
  Oeffentlich: "Открытый",
  "Öffentlich": "Открытый",
  Privat: "Закрытый",
  Abwesenheiten: "Отсутствия",
  Flexibel: "Гибкий вид",
  Klassisch: "Таблица",
  Monat: "Месяц",
  Woche: "Неделя",
  "Monatsuebersicht": "Обзор месяца",
  "Monatsübersicht": "Обзор месяца",
  Mitarbeiteransicht: "По сотрудникам",
  Schicht: "Смена",
  Schichten: "Смены",
  "Schicht erstellen": "Создать смену",
  "Neue Schicht erstellen": "Создать смену",
  "Schicht bearbeiten": "Изменить смену",
  "Schicht loeschen": "Удалить смену",
  "Schicht löschen": "Удалить смену",
  "Schicht erstellt": "Смена создана",
  "Schicht aktualisiert": "Смена обновлена",
  "Schicht geloescht": "Смена удалена",
  "Kein Arbeitsbereich": "Без подразделения",
  "Max. Mitarbeiter": "Максимум сотрудников",
  Pause: "Перерыв",
  "Pro Stunde": "На каждый час",
  "Pro Schicht": "На всю смену",
  "Tage wiederholen": "Повторить по дням",
  "Mitarbeiter eintragen": "Назначить сотрудника",
  "Mitarbeiter austragen": "Снять сотрудника со смены",
  "Alle Mitarbeiter": "Все сотрудники",
  Sichtbarkeit: "Видимость",
  Bereich: "Подразделение",
  "Bereich filtern": "Фильтр подразделений",
  Optionen: "Параметры",
  Anzeige: "Отображение",
  "Titel anzeigen": "Показывать название",
  "Pausen anzeigen": "Показывать перерывы",
  Briefing: "Информация на неделю",
  "Wochen-Briefing": "Информация на неделю",
  "KI-Briefing": "ИИ-сводка",
  "Frühschicht": "Утренняя смена",
  Fruehschicht: "Утренняя смена",
  "Spätschicht": "Вечерняя смена",
  Spaetschicht: "Вечерняя смена",
  Tagschicht: "Дневная смена",
  Samstagsschicht: "Субботняя смена",
  "Voll besetzt": "Мест нет",
  "Platz erstellen": "Добавить место",
  Platz: "Место",
  Frei: "Свободно",
  Eintragen: "Записаться",
  Abbuchen: "Снять со смены",
  Wunschplan: "Заявки на смены",
  Wunschplaene: "Заявки на смены",
  "Wunschpläne": "Заявки на смены",
  Wunsch: "Заявка",
  Wuensche: "Заявки",
  "Wünsche": "Заявки",
  "Wunsch senden": "Отправить заявку",
  "Wunsch offen": "На рассмотрении",
  Angenommen: "Одобрено",
  "Alle annehmen": "Одобрить все",
  Annehmen: "Одобрить",
  "Live-Modus": "Самостоятельная запись",
  "Live starten": "Открыть самозапись",
  "Live stoppen": "Закрыть самозапись",
  Offen: "Доступно",
  aktiv: "открыта",
  Aktivitaet: "Последние действия",
  "Noch keine Aktivitaet": "Действий пока не было",
  eingetragen: "записался на смену",
  ausgetragen: "отменил запись",
  Montag: "Понедельник",
  Dienstag: "Вторник",
  Mittwoch: "Среда",
  Donnerstag: "Четверг",
  Freitag: "Пятница",
  Samstag: "Суббота",
  Sonntag: "Воскресенье",
  Stoppuhr: "Секундомер",
  Erfassen: "Добавить запись",
  Manuell: "Вручную",
  Dauer: "Продолжительность",
  Kategorie: "Категория",
  "Keine Kategorie": "Без категории",
  Gesamtstunden: "Всего часов",
  Erfassungen: "Записи",
  "Laeuft seit": "Запущен с",
  "Speichern & Stop": "Остановить и сохранить",
  Normal: "Обычное время",
  "Überstunden": "Сверхурочные",
  Nachtarbeit: "Ночная работа",
  Abwesenheit: "Отсутствие",
  "Neue Abwesenheit": "Добавить отсутствие",
  "Abwesenheit bearbeiten": "Изменить отсутствие",
  Urlaub: "Отпуск",
  Krank: "Больничный",
  Fortbildung: "Обучение",
  Familienurlaub: "Семейный отпуск",
  Grund: "Причина",
  Bezahlt: "Оплачивается",
  "Neuer Ordner": "Новая папка",
  "Datei hochladen": "Загрузить файл",
  "Thema erstellen": "Создать обсуждение",
  "Neues Thema": "Новое обсуждение",
  Beitrag: "Сообщение",
  Senden: "Отправить",
  Berichte: "Отчёты",
  Monatsbericht: "Отчёт за месяц",
  "Soll / Ist": "План / факт",
  "Pro Woche": "По неделям",
  Account: "Учётная запись",
  Namensformat: "Формат имени",
  "KI-Vorschlag": "Предложение ИИ",
  Insights: "Аналитика",
  Anomalien: "Отклонения",
  Prognose: "Прогноз",
  Unauthorized: "Не авторизован",
  Forbidden: "Недостаточно прав",
  "Invalid JSON": "Некорректные данные",
  "Validation failed": "Ошибка проверки данных",
  "Internal server error": "Внутренняя ошибка сервера",
  Close: "Закрыть",
};

const phrases = {
  "Fehler beim Laden": "Ошибка загрузки",
  "Fehler beim Speichern": "Ошибка сохранения",
  "Fehler beim Erstellen": "Ошибка создания",
  "Fehler beim Loeschen": "Ошибка удаления",
  "Fehler beim Löschen": "Ошибка удаления",
  "Fehler beim Aktualisieren": "Ошибка обновления",
  "Fehler beim Generieren": "Ошибка формирования",
  "Fehler beim Senden": "Не удалось отправить",
  "Fehler beim Stornieren": "Не удалось отменить",
  "Fehler beim Stoppen": "Не удалось остановить",
  "Fehler beim Starten": "Не удалось запустить",
  "Fehler beim Aendern": "Не удалось изменить",
  "Bitte versuche es erneut.": "Повторите попытку.",
  "Keine Schichten in dieser Woche": "На этой неделе смен нет",
  "Keine Schichten": "Смен нет",
  "Schicht hinzufuegen": "Добавить смену",
  "Mitarbeiter gebucht": "Сотрудник назначен на смену",
  "Mitarbeiter abgebucht": "Сотрудник снят со смены",
  "Platz hinzugefuegt": "Свободное место добавлено",
  "wirklich aus der Schicht entfernen?": "снять с этой смены?",
  "wirklich stoppen?": "действительно остановить?",
  "Tage fuer Self-Booking": "Дни для самостоятельной записи",
  "Wunsch gesendet": "Заявка отправлена",
  "Wunsch storniert": "Заявка отозвана",
  "Wunsch wirklich stornieren?": "Отозвать заявку?",
  "Wunsch angenommen & Mitarbeiter gebucht": "Заявка одобрена, сотрудник назначен на смену",
  "Wunsch abgelehnt": "Заявка отклонена",
  "Bewertungen laden...": "Подбираем сотрудников…",
  "Stunden:": "Нагрузка:",
  "Verfuegbarkeit:": "Доступность:",
  "Bereich:": "Подразделение:",
  "Historie:": "Предыдущие смены:",
  "Failed to fetch divisions": "Не удалось загрузить подразделения",
  "Optionaler Kommentar...": "Комментарий — необязательно",
  "PDF (kommt bald)": "PDF (скоро)",
  "Excel (kommt bald)": "Excel (скоро)",
};

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  const stack = [directory];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", ".next", ".git"].includes(entry.name)) {
          stack.push(fullPath);
        }
      } else if (extensions.has(path.extname(entry.name))) {
        result.push(fullPath);
      }
    }
  }

  return result;
}

function replaceExactUiLiteral(content, source, target) {
  return content
    .split(`"${source}"`).join(`"${target}"`)
    .split(`'${source}'`).join(`'${target}'`)
    .split(`\`${source}\``).join(`\`${target}\``)
    .split(`>${source}<`).join(`>${target}<`)
    .split(`> ${source} <`).join(`> ${target} <`);
}

const files = sourceRoots.flatMap(walk);
const pairs = Object.entries(translations).sort((a, b) => b[0].length - a[0].length);
const phrasePairs = Object.entries(phrases).sort((a, b) => b[0].length - a[0].length);
const changed = [];

for (const filePath of files) {
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  for (const [source, target] of pairs) {
    content = replaceExactUiLiteral(content, source, target);
  }

  for (const [source, target] of phrasePairs) {
    content = content.split(source).join(target);
  }

  content = content
    .split('import { de } from "date-fns/locale";')
    .join('import { ru } from "date-fns/locale";')
    .split("import { de } from 'date-fns/locale';")
    .join("import { ru } from 'date-fns/locale';")
    .split("locale: de")
    .join("locale: ru")
    .split('"de-DE"')
    .join('"ru-RU"')
    .split("'de-DE'")
    .join("'ru-RU'");

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    changed.push(path.relative(root, filePath).split(path.sep).join("/"));
  }
}

console.log(`Изменено файлов: ${changed.length}`);
for (const file of changed) console.log(`- ${file}`);
