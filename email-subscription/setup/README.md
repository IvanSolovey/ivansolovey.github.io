# Розгортання email-підписки

## Що це

Google Apps Script Web App + Google Sheets як backend для форми підписки на блозі.
Розсилка через Gmail (`MailApp`). Безкоштовно, ліміт 100 листів/день.

---

## Крок 1. Створити Google Sheet

1. Відкрити [sheets.new](https://sheets.new) — відкриється нова таблиця.
2. Перейменувати назву таблиці (верхній лівий кут, де написано "Untitled spreadsheet") на щось зрозуміле, наприклад `Blog Subscribers`.
3. Унизу побачиш вкладку `Sheet1` — клікни правою кнопкою → **Rename** → ввести `subscribers`.
4. Додати заголовки в рядок 1 (клітинки A1–G1):

   | A | B | C | D | E | F | G |
   |---|---|---|---|---|---|---|
   | email | status | subscribed_at | confirmed_at | confirmation_token | unsubscribe_token | source |

5. Натиснути **+** (кнопка внизу ліворуч, поруч з вкладкою) → нова вкладка → перейменувати на `logs`.
6. Додати заголовки в `logs`, рядок 1 (A1–D1): `timestamp`, `action`, `email`, `result`.
7. Скопіювати **ID таблиці** з адресного рядка браузера:
   ```
   https://docs.google.com/spreadsheets/d/  →  ТУТ_ID  ←  /edit
   ```
   ID виглядає як `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms` — зберегти, знадобиться на кроці 3.

---

## Крок 2. Створити Apps Script проект

1. Відкрити [script.google.com](https://script.google.com).
2. Натиснути **New project** (кнопка зліва вгорі).
3. Перейменувати проект (клік на "Untitled project" вгорі) → `Blog Subscription`.

### Заповнити файли скрипту

Відкриються вкладки файлів зліва. За замовчуванням є один файл `Code.gs`.

**Code.gs** — основний файл:
- Клікнути на `Code.gs` у лівій панелі.
- Виділити весь дефолтний текст (`Cmd+A`) і видалити.
- Вставити весь вміст файлу `email-subscription/apps-script/Code.gs` з репозиторію.

**SubscriberRepo.gs** — новий файл:
- Натиснути **+** поруч з написом "Files" у лівій панелі → **Script**.
- Ввести назву `SubscriberRepo` (без `.gs` — редактор додасть сам).
- Вставити вміст файлу `email-subscription/apps-script/SubscriberRepo.gs`.

**EmailTemplates.gs** — новий файл:
- Ще раз **+** → **Script** → назва `EmailTemplates`.
- Вставити вміст `email-subscription/apps-script/EmailTemplates.gs`.

**RssParser.gs** — новий файл:
- Ще раз **+** → **Script** → назва `RssParser`.
- Вставити вміст `email-subscription/apps-script/RssParser.gs`.

**appsscript.json** — маніфест:
- Клікнути **Project Settings** (шестерня у лівій панелі).
- Увімкнути чекбокс **"Show 'appsscript.json' manifest file in editor"**.
- Повернутись у **Editor** (кнопка `<>` зліва).
- З'явиться файл `appsscript.json` у списку — клікнути на нього.
- Замінити весь вміст на вміст файлу `email-subscription/apps-script/appsscript.json`.

Зберегти все: `Cmd+S` або кнопка **Save project** (дискета).

---

## Крок 3. Налаштувати Script Properties

Script Properties — це захищені змінні середовища для скрипту (як `.env`). Не зберігаються в коді.

1. Клікнути **Project Settings** (шестерня зліва).
2. Прокрутити вниз до секції **Script Properties**.
3. Натиснути **Add script property** і додати по одній:

   | Property | Значення |
   |----------|----------|
   | `SHEET_ID` | ID таблиці з кроку 1 |
   | `BLOG_URL` | `https://ivansolovey.github.io` |
   | `RSS_URL` | `https://ivansolovey.github.io/feed.xml` |
   | `FROM_NAME` | `Іван Соловйов \| Блог` |
   | `WEBAPP_URL` | *(залишити порожнім — заповнити після кроку 4)* |

4. Натиснути **Save script properties**.

---

## Крок 4. Задеплоїти як Web App

> Web App — це публічний URL, на який форма блогу шле POST-запити.

1. Повернутись у **Editor** (`<>` зліва).
2. Натиснути кнопку **Deploy** (верхній правий кут) → **New deployment**.
3. Клікнути на іконку шестерні поруч з "Select type" → вибрати **Web app**.
4. Заповнити поля:
   - **Description**: `v1` (для власного розуміння версій)
   - **Execute as**: `Me (your@gmail.com)`
   - **Who has access**: `Anyone`
5. Натиснути **Deploy**.
6. Буде запит на авторизацію — натиснути **Authorize access** → вибрати свій Google акаунт → якщо з'явиться "Google hasn't verified this app" → клікнути **Advanced** → **Go to Blog Subscription (unsafe)** → **Allow**.
7. Скопіювати **Web App URL** — виглядає як:
   ```
   https://script.google.com/macros/s/AKfycbXXXXXXXXXXXXXXX/exec
   ```
   Зберегти цей URL.

### Після деплою: оновити WEBAPP_URL

1. Повернутись у **Project Settings** → **Script Properties**.
2. Знайти `WEBAPP_URL` → натиснути олівець → вставити скопійований URL → **Save**.

> **Важливо:** при кожному оновленні коду треба робити **New deployment** (не "Manage deployments" → Edit). Після кожного нового деплою URL змінюється — оновлювати `WEBAPP_URL` у Script Properties і в `_config.yml`.

---

## Крок 5. Налаштувати Time-based trigger

Trigger запускає `processNewPosts` щогодини — перевіряє RSS і шле листи при нових постах.

1. У лівій панелі редактора — клікнути **Triggers** (іконка годинника).
2. Натиснути **+ Add Trigger** (правий нижній кут).
3. Заповнити:
   - **Choose which function to run**: `processNewPosts`
   - **Choose which deployment should run**: `Head`
   - **Select event source**: `Time-driven`
   - **Select type of time based trigger**: `Hour timer`
   - **Select hour interval**: `Every hour`
4. Натиснути **Save**. Знову буде запит авторизації — підтвердити.

Після збереження тригер з'явиться у списку. Зелена галочка = активний.

---

## Крок 6. Додати URL у Jekyll і запушити

У файлі `_config.yml` блогу знайти рядок:
```yaml
subscribe_webapp_url: ""
```
Замінити на:
```yaml
subscribe_webapp_url: "https://script.google.com/macros/s/AKfycbXXXXXXXXXXXXXXX/exec"
```

Закомітити і запушити:
```bash
git add _config.yml
git commit -m "Add subscribe webapp URL"
git push
```

GitHub Pages перебілдиться за ~1 хвилину.

---

## Крок 7. Перевірити що авторизація є

1. У Apps Script: клікнути **Overview** (іконка `i` зліва).
2. У секції **Project OAuth Scopes** мають бути:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://mail.google.com/` або `https://www.googleapis.com/auth/script.send_mail`
   - `https://www.googleapis.com/auth/script.external_request`

Якщо секція порожня або scopes відсутні — у Editor вибрати функцію `processNewPosts` зі списку вгорі → натиснути **Run** → підтвердити авторизацію.

---

## Тестування

### 1. Підписка і confirmation

1. Запустити блог локально:
   ```bash
   /Users/user/.rbenv/versions/3.3.7/bin/bundle exec /Users/user/.rbenv/versions/3.3.7/bin/jekyll serve
   ```
2. Відкрити `http://localhost:4000` → ввести свій тестовий email у форму → натиснути "Підписатися".
3. Кнопка стане неактивною, потім з'явиться "Перевір пошту і підтверди підписку."
4. Перевірити Sheet `subscribers` — має з'явитись рядок зі статусом `pending_confirmation`.
5. Перевірити пошту — має прийти лист "Підтвердіть підписку на блог".

### 2. Підтвердження

1. Клікнути кнопку "Підтвердити підписку" у листі.
2. Відкриється сторінка "Дякуємо!" від Apps Script.
3. У Sheet статус рядка має змінитись на `active`, заповниться `confirmed_at`.
4. У Sheet `logs` — новий рядок `confirm | your@email | ok`.

### 3. Перший запуск processNewPosts

1. У Apps Script Editor → у списку функцій вгорі вибрати `processNewPosts` → натиснути **Run**.
2. У Sheet `logs` має з'явитись рядок: `processNewPosts | init | initialized with: <guid>`.
3. Листів не буде — це нормально. Перший запуск тільки запам'ятовує останній пост.

### 4. Тест реальної розсилки

Щоб протестувати відправку листа без публікації нового поста:
1. Відкрити Sheet, знайти рядок з `LAST_PROCESSED_GUID` — ні, це в Script Properties.
2. У Apps Script → **Project Settings** → **Script Properties** → знайти `LAST_PROCESSED_GUID`.
3. Змінити його на GUID передостаннього поста з RSS (відкрити `https://ivansolovey.github.io/feed.xml`, знайти другий `<id>` або `<guid>`).
4. Запустити `processNewPosts` вручну — має надіслати лист про останній пост.

### 5. Відписка

1. Клікнути посилання "Відписатися" у нижній частині листа про пост.
2. Відкриється сторінка "Ви відписалися."
3. У Sheet статус → `unsubscribed`.

### 6. Повторна підписка

1. Ввести той самий email у форму.
2. Форма надішле новий лист підтвердження.
3. У Sheet токени оновляться, статус знову `pending_confirmation`.

---

## Можливі проблеми

**Форма каже "Форма тимчасово недоступна"**
→ `subscribe_webapp_url` порожній у `_config.yml`. Переконайся що `jekyll build` пройшов після змін.

**Лист не приходить**
→ Перевір папку Spam. Gmail іноді фільтрує перші листи від нових скриптів.

**Apps Script повертає HTML замість JSON**
→ Можливо запит іде на URL без `/exec` або з неправильним методом. Перевір WEBAPP_URL у Script Properties.

**"Exception: You do not have permission to call MailApp.sendEmail"**
→ Не пройдена авторизація. Запусти `processNewPosts` або `handleSubscribe` вручну з Editor → підтвердь авторизацію.

**Після оновлення коду форма не працює**
→ Зробив "Edit" існуючого deployment замість "New deployment". Потрібно робити **Deploy → New deployment** кожен раз і оновлювати WEBAPP_URL.

---

## Ліміти Gmail (безкоштовний акаунт)

| Ресурс | Ліміт |
|--------|-------|
| Листів/день через MailApp | 100 |
| Час виконання тригерів/день | 90 хв сумарно |
| URL Fetch запитів/день | 20 000 |
| Розмір Sheet | 10 млн комірок |

З Google Workspace акаунтом ліміт листів зростає до 1500/день.

При перевищенні ліміту скрипт логує `quota_exceeded` і не оновлює `LAST_PROCESSED_GUID` — наступний запуск тригера автоматично дошле.
