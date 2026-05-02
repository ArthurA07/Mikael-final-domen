# Локальный Runbook (источник правды)

Этот файл — быстрый и актуальный чеклист:
- как стабильно запускать проект локально;
- как проверять синхронизацию `локалка <-> GitHub <-> сервер`;
- что делать при типовых сбоях портов/запуска.

Коротко:
- основная ветка: `main`;
- основной удалённый репозиторий: `github-new`;
- сервер синхронизируется `rsync` в `/opt/mikael` (не через `git pull`).
- рекомендуемая версия Node.js: `20.x` (см. `.nvmrc`).

## 1) Рекомендуемый локальный запуск (стабильный)

Режим: один процесс, один порт (`3000`), фронтенд и API отдаются через Express.

```bash
cd "/Users/arturartinov/Desktop/Mikael-final 777"
npm run build
NODE_ENV=production USE_IN_MEMORY_DB=true PORT=3000 node server/index.js
```

Проверка:

```bash
curl -s -o /dev/null -w "site:%{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "api:%{http_code}\n" http://127.0.0.1:3000/api/health
```

Ожидается `200` и для сайта, и для API.

## 2) Dev-режим (два процесса, hot reload)

Режим: фронтенд `3000`, backend `5000` (по умолчанию проекта).

Перед запуском (желательно):

```bash
cd "/Users/arturartinov/Desktop/Mikael-final 777"
nvm use
```

```bash
cd "/Users/arturartinov/Desktop/Mikael-final 777"
npm run dev:mem
```

Если `5000` занят системным процессом на macOS:

```bash
lsof -nP -iTCP:5000 -sTCP:LISTEN
```

Или освобождаем порт, или запускаем backend на другом порту и настраиваем `client/package.json` (`proxy`) под этот порт.

## 3) Проверка синхронизации локалки и GitHub

Быстро (автоматически):

```bash
cd "/Users/arturartinov/Desktop/Mikael-final 777"
npm run sync:check
```

```bash
cd "/Users/arturartinov/Desktop/Mikael-final 777"
git fetch github-new
git rev-parse HEAD
git rev-parse github-new/main
git status --short --branch
```

Критерий:
- `HEAD == github-new/main`;
- в `git status` нет изменений в отслеживаемых файлах (допустимы только локальные служебные файлы вроде `_data/`, `server/.env`).

## 4) Проверка синхронизации с сервером (dry-run, без изменений)

```bash
cd "/Users/arturartinov/Desktop/Mikael-final 777"
SSH_KEY="$HOME/.ssh/cursor_deploy_ed25519"
rsync -azn --delete --itemize-changes \
  --exclude '.git/' \
  --exclude '.DS_Store' \
  --exclude '**/.DS_Store' \
  --exclude 'node_modules/' \
  --exclude 'client/node_modules/' \
  --exclude 'server/node_modules/' \
  --exclude 'client/build/' \
  --exclude '_data/' \
  --exclude '*.log' \
  --exclude 'ACCESS.local.md' \
  --exclude 'server/.env' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
  "/Users/arturartinov/Desktop/Mikael-final 777/" \
  "root@81.31.247.70:/opt/mikael/"
```

Если вывод пустой/минимальный (`.d..t.... ./`), сервер и локалка синхронны.

## 5) Применение синхронизации на сервер

Каноничный сценарий в 1 команду (main -> github-new -> server):

```bash
cd "/Users/arturartinov/Desktop/Mikael-final 777"
npm run sync:apply
```

Ручной вариант:

```bash
cd "/Users/arturartinov/Desktop/Mikael-final 777"
SERVER_IP=81.31.247.70 ./scripts/sync_to_server.sh "/Users/arturartinov/Desktop/Mikael-final 777"
```

Важно:
- `/opt/mikael` на сервере синхронизируется через `rsync`, а не через `git pull`;
- `server/.env` на сервере не перезатирается (исключён в скрипте).

## 6) Типовые проблемы и быстрые решения

- Порт `3000/5000` занят:
  - `lsof -nP -iTCP:<PORT> -sTCP:LISTEN`
  - остановить конфликтующий процесс или сменить порт.
- Локалка "грязная" перед сверкой с Git:
  - проверить `git status`;
  - очищать только осознанно, не трогая `server/.env` и `_data/`.
- После деплоя на сервере есть "лишние" файлы:
  - повторить `rsync` с `--delete` через `scripts/sync_to_server.sh`.

---

Если нужно быстро проверить «всё ли ок», используйте порядок:
1) запуск локально (раздел 1),
2) сверка с GitHub (раздел 3),
3) dry-run сверка с сервером (раздел 4).
