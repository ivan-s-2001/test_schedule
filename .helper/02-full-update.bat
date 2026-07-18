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
echo [1/7] Переключение на develop...
git switch develop
if errorlevel 1 goto :fail

echo.
echo [2/7] Получение изменений...
git pull --ff-only origin develop
if errorlevel 1 goto :fail

echo.
echo [3/7] Установка зависимостей...
call npm install
if errorlevel 1 goto :fail

echo.
echo [4/7] Полное удаление данных и повтор всех миграций...
call npx prisma migrate reset --force
if errorlevel 1 goto :fail

echo.
echo [5/7] Обновление Prisma Client...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [6/7] Первоначальное заполнение базы...
call npx prisma db seed
if errorlevel 1 goto :fail

echo.
echo [7/7] Повторный импорт графика службы заботы...
if exist "scripts\migration\care-schedule-2026-01-07.json" (
  call npx tsx scripts/migration/import-care-schedule.ts --apply
  if errorlevel 1 goto :fail
) else (
  echo Файл scripts\migration\care-schedule-2026-01-07.json не найден.
  echo Миграции и seed выполнены, но график службы заботы не импортирован.
)

echo.
echo ============================================================
echo ПОЛНОЕ ОБНОВЛЕНИЕ ЗАВЕРШЕНО.
echo БАЗА ПЕРЕСОЗДАНА, ВСЕ МИГРАЦИИ ВЫПОЛНЕНЫ.
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
