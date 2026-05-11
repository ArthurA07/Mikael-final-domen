# Operations Checklist

Короткая памятка для регулярной работы без потери контекста.

## Каноничная схема

- Источник правды по коду: локальный репозиторий в ветке `main`
- Основной удаленный репозиторий: `github-new` (`ArthurA07/Mikael-final-domen`)
- Сервер: `root@81.31.247.70:/opt/mikael`
- Поток доставки: `local -> github-new/main -> rsync -> server`

## Ежедневный цикл

1. Внести изменения локально и проверить.
2. Коммит в `main`.
3. Запустить проверку синхронизации:
   ```bash
   npm run sync:check
   ```
4. Отправить в GitHub и синхронизировать сервер:
   ```bash
   npm run sync:apply
   ```

## Обязательные правила

- Не деплоить вручную отдельные файлы в обход `sync:apply`.
- Не использовать `git pull` на сервере в `/opt/mikael` (там rsync-поток).
- Не коммитить `server/.env`, `_data`, локальные кэши и `node_modules`.
- Перед релизом ветка должна быть `main`, а рабочее дерево — без tracked-изменений.

## Быстрая диагностика

- Проверить локальную синхронизацию:
  ```bash
  npm run sync:check
  ```
- Проверить сервер:
  ```bash
  curl -k -s -o /dev/null -w "site:%{http_code}\n" https://swift-mind.ru/
  curl -k -s -o /dev/null -w "api:%{http_code}\n" https://swift-mind.ru/api/health
  ```
- Если на сервере старый фронт после sync:
  - выполнить серверный деплой (сборка + restart):
    ```bash
    ssh -i "$HOME/.ssh/cursor_deploy_ed25519" root@81.31.247.70 "cd /opt/mikael && ./scripts/deploy_on_server.sh"
    ```

## ЮKassa (боевой режим)

Минимальные переменные в `server/.env`:

```env
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_TAX_SYSTEM_CODE=2
YOOKASSA_VAT_CODE=1
PUBLIC_APP_URL=https://swift-mind.ru
```

Webhook в кабинете ЮKassa:

- URL: `https://swift-mind.ru/api/payments/yookassa/webhook`
- События: `payment.succeeded`, `payment.canceled`

## Частые проблемы и решения

- `ENOTEMPTY` в `client/node_modules/.cache/babel-loader` на сервере:
  - удалить кэш и повторить `deploy_on_server.sh`.
- На локалке висит `localhost:3000`:
  - остановить старые `react-scripts` процессы;
  - использовать Node 20 (`nvm use`);
  - переустановить `client` зависимости (`npm ci`).
