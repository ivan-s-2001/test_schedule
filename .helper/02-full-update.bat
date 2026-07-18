@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0.."
if errorlevel 1 goto :fail

echo.
echo ВНИМАНИЕ: БАЗА ДАННЫХ БУДЕТ ПОЛНОСТЬЮ ОЧИЩЕНА.
echo Все локальные изменения графика, пометок и сотрудников будут удалены.
echo.
set /p CONFIRM=Для продолжения введите DELETE: 
if /I not "%CONFIRM%"=="DELETE" (
  echo Операция отменена.
  pause
  exit /b 0
)

echo.
echo [1/9] Переключение на develop...
git switch develop
if errorlevel 1 goto :fail

echo.
echo [2/9] Получение изменений...
git pull --ff-only origin develop
if errorlevel 1 goto :fail

echo.
echo [3/9] Установка зависимостей...
call npm install
if errorlevel 1 goto :fail

echo.
echo [4/9] Полное удаление данных и повтор всех миграций...
call npx prisma migrate reset --force
if errorlevel 1 goto :fail

echo.
echo [5/9] Обновление Prisma Client...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [6/9] Первоначальное заполнение базы...
call npx prisma db seed
if errorlevel 1 goto :fail

echo.
echo [7/9] Повторный импорт графика службы заботы...
if exist "scripts\migration\care-schedule-2026-01-07.json" (
  call npx tsx --env-file=.env scripts/migration/import-care-schedule.ts --apply
  if errorlevel 1 goto :fail
) else (
  echo Файл scripts\migration\care-schedule-2026-01-07.json не найден.
  echo Миграции и seed выполнены, но график службы заботы не импортирован.
)

echo.
echo [8/9] Пересборка приложения...
call npm run build
if errorlevel 1 goto :fail

echo.
echo [9/9] Запуск собранного приложения...
start "Schichtplaner" cmd /k "set NODE_ENV=production&& npx tsx --env-file=.env server.ts"
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo ПОЛНОЕ ОБНОВЛЕНИЕ ЗАВЕРШЕНО.
echo БАЗА ПЕРЕСОЗДАНА, ВСЕ МИГРАЦИИ ВЫПОЛНЕНЫ.
echo ПРИЛОЖЕНИЕ СОБРАНО И ЗАПУЩЕНО В ОТДЕЛЬНОМ ОКНЕ.
echo ============================================================
pause
exit /b 0

:fail
echo.
echo ============================================================
echo ОШИБКА ПОЛНОГО ОБНОВЛЕНИЯ. КОД: %ERRORLEVEL%
echo ============================================================
pause
exit /b %ERRORLEVEL%
