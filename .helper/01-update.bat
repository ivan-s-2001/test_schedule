@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0.."
if errorlevel 1 goto :fail

echo.
echo [1/7] Переключение на develop...
git switch develop
if errorlevel 1 goto :fail

echo.
echo [2/7] Получение изменений...
git pull --ff-only origin develop
if errorlevel 1 goto :fail

echo.
echo [3/7] Установка новых зависимостей...
call npm install
if errorlevel 1 goto :fail

echo.
echo [4/7] Обновление Prisma Client...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [5/7] Применение только невыполненных миграций...
call npx prisma migrate deploy
if errorlevel 1 goto :fail

echo.
echo [6/7] Пересборка приложения...
call npm run build
if errorlevel 1 goto :fail

echo.
echo [7/7] Запуск собранного приложения...
start "Schichtplaner" cmd /k "set NODE_ENV=production&& npx tsx --env-file=.env server.ts"
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo ОБНОВЛЕНИЕ ЗАВЕРШЕНО. ДАННЫЕ БАЗЫ СОХРАНЕНЫ.
echo ПРИЛОЖЕНИЕ ЗАПУЩЕНО В ОТДЕЛЬНОМ ОКНЕ.
echo ============================================================
pause
exit /b 0

:fail
echo.
echo ============================================================
echo ОШИБКА ОБНОВЛЕНИЯ. КОД: %ERRORLEVEL%
echo ============================================================
pause
exit /b %ERRORLEVEL%
