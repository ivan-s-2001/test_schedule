@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0.."
if errorlevel 1 goto :fail

echo.
echo [1/5] Переключение на develop...
git switch develop
if errorlevel 1 goto :fail

echo.
echo [2/5] Получение изменений...
git pull --ff-only origin develop
if errorlevel 1 goto :fail

echo.
echo [3/5] Установка новых зависимостей...
call npm install
if errorlevel 1 goto :fail

echo.
echo [4/5] Обновление Prisma Client...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [5/5] Применение только невыполненных миграций...
call npx prisma migrate deploy
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo ОБНОВЛЕНИЕ ЗАВЕРШЕНО. ДАННЫЕ БАЗЫ СОХРАНЕНЫ.
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
