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
echo Проверка приватных файлов импорта...
if not exist "scripts\migration\care-schedule-2026-01-07.json" (
  echo ОШИБКА: не найден scripts\migration\care-schedule-2026-01-07.json
  goto :fail
)
if not exist "scripts\migration\care-day-notes-2026.json" (
  echo ОШИБКА: не найден scripts\migration\care-day-notes-2026.json
  goto :fail
)
if not exist "scripts\migration\care-cell-statuses-2026.json" (
  echo ОШИБКА: не найден scripts\migration\care-cell-statuses-2026.json
  echo Без этого файла отпуска, больничные и выходные не будут восстановлены.
  goto :fail
)

echo.
echo [1/12] Переключение на develop...
git switch develop
if errorlevel 1 goto :fail

echo.
echo [2/12] Получение изменений...
git pull --ff-only origin develop
if errorlevel 1 goto :fail

echo.
echo [3/12] Установка зависимостей...
call npm install
if errorlevel 1 goto :fail

echo.
echo [4/12] Полное удаление данных и повтор всех миграций...
call npx prisma migrate reset --force
if errorlevel 1 goto :fail

echo.
echo [5/12] Обновление Prisma Client...
call npx prisma generate
if errorlevel 1 goto :fail

echo.
echo [6/12] Первоначальное заполнение базы...
call npx prisma db seed
if errorlevel 1 goto :fail

echo.
echo [7/12] Повторный импорт графика службы заботы...
call npx tsx --env-file=.env scripts/migration/import-care-schedule.ts --apply
if errorlevel 1 goto :fail

echo.
echo [8/12] Импорт пометок и статусов из Excel...
call npx tsx --env-file=.env scripts/migration/import-care-day-notes.ts --apply
if errorlevel 1 goto :fail

echo.
echo [9/12] Импорт состояний ячеек и синхронизация пула смен...
call npx tsx --env-file=.env scripts/migration/import-care-cell-statuses.ts --apply --force
if errorlevel 1 goto :fail
call npx tsx --env-file=.env scripts/migration/sync-shift-pool-snapshots.ts
if errorlevel 1 goto :fail

echo.
echo [10/12] Остановка предыдущего сервера на порту %APP_PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$connections = @(Get-NetTCPConnection -LocalPort %APP_PORT% -State Listen -ErrorAction SilentlyContinue); foreach ($connection in $connections) { try { Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop } catch { Write-Host ('Не удалось остановить PID ' + $connection.OwningProcess + ': ' + $_.Exception.Message) } }; exit 0"

set "PORT_FREE=0"
for /L %%I in (1,1,15) do (
  powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %APP_PORT% -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" >nul 2>&1
  if not errorlevel 1 (
    set "PORT_FREE=1"
    goto :port_free
  )
  timeout /t 1 /nobreak >nul
)

:port_free
if not "%PORT_FREE%"=="1" (
  echo Порт %APP_PORT% не освободился.
  powershell -NoProfile -Command "$connections = @(Get-NetTCPConnection -LocalPort %APP_PORT% -State Listen -ErrorAction SilentlyContinue); foreach ($connection in $connections) { Write-Host ('Порт занят процессом PID ' + $connection.OwningProcess) }"
  goto :fail
)

echo.
echo [11/12] Пересборка приложения на порту %APP_PORT%...
call npm run build
if errorlevel 1 goto :fail

echo.
echo [12/12] Запуск собранного приложения...
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
echo ПОЛНОЕ ОБНОВЛЕНИЕ ЗАВЕРШЕНО.
echo БАЗА ПЕРЕСОЗДАНА, ВСЕ МИГРАЦИИ ВЫПОЛНЕНЫ.
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
echo ОШИБКА ПОЛНОГО ОБНОВЛЕНИЯ. КОД: %EXIT_CODE%
echo ============================================================
pause
exit /b %EXIT_CODE%
