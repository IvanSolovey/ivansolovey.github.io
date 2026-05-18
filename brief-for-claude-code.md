# Brief для Claude Code: Email subscription для Jekyll-блогу через Google Apps Script + Sheets

## Що будуємо і навіщо

У мене є особистий блог на Jekyll + GitHub Pages. На головній сторінці вже наверстана форма підписки. Треба зробити робочу систему підписки на новини блогу.

Обмеження:
- Безкоштовно. Жодних платних тарифів.
- Без власного сервера для email (PHP-сервер є, але не використовуємо для розсилки).
- Sender — мій Gmail.
- Розсилка автоматична: коли в RSS-фіді з'являється новий пост — підписники отримують лист.

Стек:
- Frontend: vanilla JS у Jekyll-шаблонах.
- Backend: Google Apps Script (V8 runtime).
- Storage: Google Sheets.
- Email: `MailApp.sendEmail()` (ліміт 100/день free, 1500/день з Workspace).

## Перш ніж писати код — спитай у мене

Це обов'язково. Не вигадуй значення, спитай.

1. URL мого блогу (наприклад `https://ivansoloviov.com`).
2. Шлях до RSS-фіду (зазвичай `/feed.xml` у стандартному Jekyll).
3. Який репозиторій GitHub Pages — щоб я знав куди commitити фронтенд-частину.
4. Існуюча HTML-розмітка форми підписки — скинь файл або шлях до нього, я хочу зрозуміти що вже наверстано, щоб не ламати верстку.
5. Мова листа — українська чи англійська. Дефолт — українська.
6. Чи потрібен double opt-in (підтвердження email через лист)? Рекомендую так, для відсіювання сміття.
7. Назва відправника у From: (наприклад "Іван Соловйов | Blog").

Чекай на відповіді перед тим як писати код.

## Архітектура

```
[Jekyll site] --POST email--> [Apps Script Web App] --write--> [Google Sheet]
                                                            \
                                                             --send confirmation--> [Subscriber Gmail]

[Time trigger щогодини] --> [Apps Script] --fetch--> [RSS feed]
                                                  |
                                       parse, compare with last_processed_guid
                                                  |
                                       для кожного нового поста:
                                       MailApp.sendEmail() по всіх active підписниках
                                                  |
                                       update last_processed_guid у Script Properties
```

## Структура Google Sheet

Один Sheet, назва `subscribers`. Колонки:

| col | name | type | приклад |
|-----|------|------|---------|
| A | email | string | `user@example.com` |
| B | status | enum | `pending_confirmation` / `active` / `unsubscribed` |
| C | subscribed_at | ISO date | `2026-05-18T10:30:00Z` |
| D | confirmed_at | ISO date | `2026-05-18T10:35:00Z` |
| E | confirmation_token | random hex | `a3f9c2...` |
| F | unsubscribe_token | random hex | `b7e1d8...` |
| G | source | string | `homepage_form` |

Окремий sheet `logs` для аудиту (timestamp, action, email, result).

`Script Properties`:
- `LAST_PROCESSED_GUID` — guid останнього розісланого поста з RSS.
- `SHEET_ID` — id таблиці.

## Apps Script: endpoints

Один `doGet(e)` і один `doPost(e)`, які роутять за параметром `action`.

### POST `?action=subscribe`

Тіло (form-encoded або JSON): `email`.

Логіка:
1. Валідувати формат email регуляркою.
2. Перевірити чи email вже є в таблиці. Якщо `active` — повернути `{ok: true, message: "already_subscribed"}`. Якщо `unsubscribed` — перевести в `pending_confirmation`, скинути токени, надіслати confirmation заново.
3. Якщо email новий — згенерувати `confirmation_token` та `unsubscribe_token` (`Utilities.getUuid()` ОК).
4. Додати рядок зі status=`pending_confirmation`.
5. Надіслати confirmation email з посиланням `WEBAPP_URL?action=confirm&token=XXX`.
6. Повернути `{ok: true, message: "check_email"}`.

CORS: повертати з `setMimeType(ContentService.MimeType.JSON)`. Apps Script не пускає custom CORS-хедери — використовуй на фронті `fetch` з `Content-Type: application/x-www-form-urlencoded`, тоді preflight не потрібен.

### GET `?action=confirm&token=XXX`

1. Знайти рядок за `confirmation_token`.
2. Якщо не знайшов або status вже `active` — показати HTML-сторінку "Підписка вже підтверджена".
3. Якщо знайшов — змінити status на `active`, записати `confirmed_at`.
4. Повернути HTML-сторінку "Готово, дякую за підписку".

### GET `?action=unsubscribe&token=XXX`

1. Знайти за `unsubscribe_token`.
2. Поставити status = `unsubscribed`.
3. Показати HTML "Ви відписалися. Шкода."

## Cron-логіка розсилки нових постів

Time-based trigger: щогодини викликає функцію `processNewPosts()`.

Логіка:
1. `UrlFetchApp.fetch(RSS_URL)` — отримати XML.
2. Розпарсити через `XmlService.parse()`.
3. Витягнути всі `<item>`, для Atom — `<entry>`. Підтримати обидва формати (Jekyll дефолтно генерує Atom через `jekyll-feed`).
4. Прочитати `LAST_PROCESSED_GUID` зі Script Properties.
5. Знайти всі пости новіші за нього (порядок у feed зазвичай від нового до старого, але не покладайся — сортуй за `published`/`pubDate`).
6. Для кожного нового поста (від старшого до новішого):
   - Витягнути title, link, summary/description, published_date.
   - Зібрати список всіх `active` підписників із Sheet.
   - Розіслати лист через `MailApp.sendEmail()` пакетом. **Унікальний unsubscribe-лінк у кожному листі** — це означає або окремі sendEmail для кожного, або підстановка токена у footer.
   - Логувати кожну успішну/невдалу відправку у sheet `logs`.
7. Оновити `LAST_PROCESSED_GUID` тільки після того, як всі листи відправились.

Захист від щоденного ліміту Gmail: перед відправкою перевіряй `MailApp.getRemainingDailyQuota()`. Якщо менше ніж потрібно — стопай, лог "quota_exceeded", не оновлюй `LAST_PROCESSED_GUID`, щоб наступний запуск дослав.

## Email-шаблони

### Confirmation email

Subject: `Підтвердіть підписку на блог`

HTML простий, без важких стилів. Має містити:
- Привітання.
- Кнопка/лінк "Підтвердити підписку" → `WEBAPP_URL?action=confirm&token=XXX`.
- Текст про те що якщо це не ти — просто проігноруй.

### Лист про новий пост

Subject: назва поста.

HTML містить:
- Заголовок поста.
- Дата.
- Excerpt/summary з RSS.
- Кнопка "Читати далі" → лінк на пост.
- Footer: "Ви отримали цей лист бо підписалися на ivansoloviov.com. [Відписатися](unsubscribe_link)."

Templates винеси в окремі функції `buildConfirmationEmail(token)` та `buildPostEmail(post, unsubscribeToken)`. Не плутай у коді з логікою.

## Frontend: інтеграція з формою

JS-сніпет який треба вставити в Jekyll-шаблон форми:

```javascript
document.getElementById('subscribe-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const formData = new URLSearchParams({ action: 'subscribe', email });
  
  const res = await fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData
  });
  
  const data = await res.json();
  // UI feedback: success/error message
});
```

`WEBAPP_URL` винеси у Jekyll `_config.yml` як змінну, не хардкодь.

UI feedback: інлайнове повідомлення під формою, не alert(). Стани: loading, success ("Перевір пошту і підтверди"), error ("Щось пішло не так").

## Захист від спам-атак

Apps Script Web App доступний всім — будь-хто може заспамити форму. Прості міри:

1. Rate limit: одна підписка з email на 5 хвилин. Зберігай у Script Properties timestamp останнього запиту з email.
2. Honeypot field у формі — приховане поле, яке боти заповнюють, а люди ні. Якщо заповнене — мовчки повертай ok без створення.
3. Опційно: hCaptcha або Cloudflare Turnstile (безкоштовний). Поверни до цього якщо реально полізе спам.

## Структура файлів проекту

Створи у репозиторії папку `email-subscription/`:

```
email-subscription/
  apps-script/
    Code.gs          # main, doGet/doPost, processNewPosts
    SubscriberRepo.gs # робота з Sheet (CRUD)
    EmailTemplates.gs # buildConfirmationEmail, buildPostEmail
    RssParser.gs      # parseRss, parseAtom
    appsscript.json   # маніфест
  frontend/
    subscribe.js      # обробник форми
    subscribe.css     # стилі feedback-повідомлень (опційно)
  setup/
    README.md         # покрокова інструкція як розгорнути
```

## Setup README

Окремий файл з покроковими інструкціями:

1. Створити Google Sheet, скопіювати ID.
2. Створити Apps Script project, прив'язати до Sheet.
3. Залити .gs файли.
4. У Script Properties додати `SHEET_ID`, `BLOG_URL`, `RSS_URL`, `FROM_NAME`.
5. Deploy as Web App, "Execute as: me", "Who has access: Anyone".
6. Скопіювати Web App URL.
7. Додати Time-based trigger на `processNewPosts` — кожну годину.
8. Покласти URL у Jekyll `_config.yml`.
9. Закомітити `subscribe.js` у Jekyll.
10. Перевірити що в Apps Script є дозвіл `MailApp.sendEmail`, `UrlFetchApp.fetch`, `SpreadsheetApp.openById`.

## Тестування

Перед фінальним deploy:

1. Локально (`bundle exec jekyll serve`) — підписатись зі свого тестового email. Перевірити що рядок у Sheet з'явився, лист confirmation прийшов.
2. Клікнути на confirmation — статус має зміниться на active.
3. Запустити `processNewPosts()` вручну з Apps Script editor. Має знайти найсвіжіший пост і надіслати тестовий лист.
4. Клікнути unsubscribe — статус має змінитися.
5. Спробувати підписатись з того самого email повторно — поведінка має бути "already_subscribed" або re-subscribe.

## Що НЕ робити

- Не використовувати сторонні бібліотеки. Apps Script має всі потрібні API.
- Не зберігати API ключі у коді. Тільки через Script Properties.
- Не робити доставку синхронно з POST-запитом на subscribe — лист підтвердження синхронно ОК, але масова розсилка по RSS — тільки з тригера.
- Не оновлювати `LAST_PROCESSED_GUID` до того як всі листи фактично відправились.
- Не показувати у відповіді API чи email вже існує в базі — це leak інформації. Завжди показуй "check_email".

## Деліверабельність

Оскільки шлемо через `MailApp` — листи йдуть з твого Gmail. SPF/DKIM Gmail-у вже валідні. Але:

- Не пиши "САЛО!!! ЗАРАЗ КУПУЙ!!!" у Subject.
- Тримай HTML-листи легкими, без зайвого JS/CSS.
- Footer з unsubscribe — обов'язково.
- List-Unsubscribe header — додай через `MailApp.sendEmail` options: `{ "name": "Іван", "htmlBody": ..., "headers": { "List-Unsubscribe": "<unsubscribe_url>" } }`. Це дає Gmail розуміти і показує кнопку "Unsubscribe" біля заголовка листа.

## Готовність

Коли все готово — продемонструй мені:
1. Скрін Sheet з тестовим записом.
2. Скрін листа confirmation у моїй пошті.
3. Лог `processNewPosts` з тестового запуску.
4. Pull request у блог-репозиторій з frontend-частиною.

---

Якщо щось у цьому брифі неясно — спитай. Краще питання зараз, ніж переробка потім.
