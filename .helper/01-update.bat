@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0.."
if errorlevel 1 goto :fail

set "APP_PORT=41873"
set "PORT=%APP_PORT%"
set "APP_URL=http://localhost:%APP_PORT%"
set "HEALTH_URL=http://127.0.0.1:%APP_PORT%"
set "NEXTAUTH_URL=%APP_URL%"
set "ADMIN_EMAIL=admin@qksr.ru"
set "OPEN_URL=%APP_URL%/?email=admin%%40qksr.ru"

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
echo [6/7] Пересборка приложения на порту %APP_PORT%...
call npm run build
if errorlevel 1 goto :fail

echo.
echo [7/7] Запуск собранного приложения...
start "Schichtplaner" cmd /k "set NODE_ENV=production&& set PORT=%APP_PORT%&& set APP_URL=%APP_URL%&& set NEXTAUTH_URL=%NEXTAUTH_URL%&& npx tsx --env-file=.env server.ts"
if errorlevel 1 goto :fail

echo Ожидание запуска сервера на порту %APP_PORT%...
set "SERVER_READY=0"
for /L %%I in (1,1,90) do (
  powershell -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%HEALTH_URL%' -TimeoutSec 2; exit 0 } catch { if ($_.Exception.Response) { exit 0 } else { exit 1 } }" >nul 2>&1
  if not errorlevel 1 (
    set "SERVER_READY=1"
    goto :server_ready
  )
  timeout /t 1 /nobreak >nul
)

:server_ready
if not "%SERVER_READY%"=="1" (
  echo.
  echo Сервер не ответил на порту %APP_PORT% за 90 секунд.
  echo Проверьте отдельное окно Schichtplaner: там находится точная ошибка запуска.
  goto :fail
)

start "" "%OPEN_URL%"

echo.
echo ============================================================
echo ОБНОВЛЕНИЕ ЗАВЕРШЕНО. ДАННЫЕ БАЗЫ СОХРАНЕНЫ.
echo ПРИЛОЖЕНИЕ ЗАПУЩЕНО: %APP_URL%
echo АВТОВХОД: %ADMIN_EMAIL%
echo ============================================================
pause
exit /b 0

:fail
set "EXIT_CODE=%ERRORLEVEL%"
if "%EXIT_CODE%"=="0" set "EXIT_CODE=1"
echo.
echo ============================================================
echo ОШИБКА ОБНОВЛЕНИЯ. КОД: %EXIT_CODE%
echo ============================================================
pause
exit /b %EXIT_CODE%
