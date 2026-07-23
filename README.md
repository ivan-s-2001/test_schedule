# Workforce Portal

Единый self-hosted портал для сотрудников, рабочих графиков, отпусков и внутренней документации.

## Состав

- **Frappe Framework 16** — пользователи, роли, API, уведомления и аудит.
- **ERPNext 16** — обязательная зависимость Frappe HR.
- **Frappe HR 16** — сотрудники, подразделения, типы смен, отпуска и табель.
- **Frappe Wiki 3** — внутренняя документация и история изменений.
- **Workforce Portal** — месячный редактор графиков и запросы сотрудников на изменения.
- **MariaDB 11.8** и **Redis 7.4**.

## Что реализовано

- месячный график по компании и подразделению;
- закреплённая колонка сотрудников и колонки дней месяца;
- назначение типов смен и ручного времени;
- отображение утверждённых отпусков из Frappe HR поверх графика;
- состояния графика: черновик, опубликован, заблокирован;
- запросы на замену, перенос, задержку, сверхурочную работу и отсутствие;
- роли Workforce Manager и Workforce Supervisor;
- раздельные права руководителя и сотрудника;
- API для дальнейшего мобильного интерфейса и интеграций;
- воспроизводимая Docker-сборка полного стека;
- CI-проверка Python, JSON, JavaScript, Docker Compose, сборки образа и установки приложений.

## Быстрый запуск в Windows

Требуются Git и Docker Desktop с включённым BuildKit.

```powershell
git clone https://github.com/ivan-s-2001/test_schedule.git
cd test_schedule
git switch agent/frappe-workforce-portal

Copy-Item deploy/.env.example deploy/.env
notepad deploy/.env

.\deploy\build.ps1
.\deploy\start.ps1
```

Перед запуском замените в `deploy/.env` значения:

```dotenv
DB_ROOT_PASSWORD=change-this-db-password
ADMIN_PASSWORD=change-this-admin-password
```

После создания сайта откройте:

```text
http://localhost:8080
```

Вход:

```text
Логин: Administrator
Пароль: значение ADMIN_PASSWORD из deploy/.env
```

## Основные разделы

Месячный график:

```text
/app/workforce-schedule
```

HR и отпуска доступны через стандартные рабочие пространства Frappe HR. Документация создаётся в Frappe Wiki.

## Собственные DocType

```text
Workforce Schedule
Workforce Schedule Entry
Workforce Change Request
```

## Управление контейнерами

Остановить сервисы:

```powershell
.\deploy\stop.ps1
```

Посмотреть состояние:

```powershell
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
```

Посмотреть журналы:

```powershell
docker compose --env-file deploy/.env -f deploy/compose.yaml logs -f
```

## Ветки

- `main` — сохранённое исходное состояние репозитория;
- `agent/frappe-workforce-portal` — новая реализация портала.
