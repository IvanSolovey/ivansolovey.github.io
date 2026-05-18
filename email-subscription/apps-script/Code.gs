// ============================================================
// Code.gs — main entry: doGet, doPost, processNewPosts
// ============================================================

function doPost(e) {
  try {
    var params = e.parameter;
    if (params.action === 'subscribe') {
      return handleSubscribe(params);
    }
    return jsonResponse({ ok: false, error: 'unknown_action' });
  } catch (err) {
    SubscriberRepo.log('doPost', 'error', err.message);
    return jsonResponse({ ok: false, error: 'server_error' });
  }
}

function doGet(e) {
  try {
    var params = e.parameter;
    if (params.action === 'confirm')     return handleConfirm(params.token);
    if (params.action === 'unsubscribe') return handleUnsubscribe(params.token);
    return HtmlService.createHtmlOutput('<p>Invalid request.</p>');
  } catch (err) {
    SubscriberRepo.log('doGet', 'error', err.message);
    return HtmlService.createHtmlOutput('<p>Помилка сервера.</p>');
  }
}

// ------------------------------------------------------------

function handleSubscribe(params) {
  var email = (params.email || '').trim().toLowerCase();

  // Honeypot: bots fill hidden "website" field, humans don't
  if (params.website) {
    return jsonResponse({ ok: true, message: 'check_email' });
  }

  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, error: 'invalid_email' });
  }

  // Rate limit: one request per email per 5 minutes
  var props = PropertiesService.getScriptProperties();
  var rlKey = 'rl_' + email.replace(/[^a-z0-9]/g, '_');
  var lastTs = props.getProperty(rlKey);
  var now = Date.now();
  if (lastTs && (now - parseInt(lastTs)) < 5 * 60 * 1000) {
    return jsonResponse({ ok: true, message: 'check_email' });
  }
  props.setProperty(rlKey, String(now));

  var existing = SubscriberRepo.findByEmail(email);

  if (existing) {
    if (existing.status === 'active') {
      // Do not reveal that email exists — same response
      return jsonResponse({ ok: true, message: 'check_email' });
    }
    // pending_confirmation or unsubscribed — re-subscribe
    var ct = Utilities.getUuid();
    var ut = Utilities.getUuid();
    SubscriberRepo.updateSubscriber(existing.row, {
      status: 'pending_confirmation',
      confirmToken: ct,
      unsubToken: ut,
      subscribedAt: new Date().toISOString()
    });
    sendConfirmationEmail(email, ct);
    return jsonResponse({ ok: true, message: 'check_email' });
  }

  // New subscriber
  var ct = Utilities.getUuid();
  var ut = Utilities.getUuid();
  SubscriberRepo.addSubscriber({
    email: email,
    status: 'pending_confirmation',
    subscribedAt: new Date().toISOString(),
    confirmedAt: '',
    confirmToken: ct,
    unsubToken: ut,
    source: 'homepage_form'
  });
  sendConfirmationEmail(email, ct);
  return jsonResponse({ ok: true, message: 'check_email' });
}

function handleConfirm(token) {
  if (!token) return htmlPage('Помилка', 'Невірне посилання.');

  var sub = SubscriberRepo.findByConfirmToken(token);
  if (!sub || sub.status === 'active') {
    return htmlPage('Підписка підтверджена', 'Ця підписка вже була підтверджена раніше. Дякуємо!');
  }

  SubscriberRepo.updateSubscriber(sub.row, {
    status: 'active',
    confirmedAt: new Date().toISOString()
  });
  SubscriberRepo.log('confirm', sub.email, 'ok');
  return htmlPage('Дякуємо!', 'Підписку підтверджено. Будемо на звʼязку!');
}

function handleUnsubscribe(token) {
  if (!token) return htmlPage('Помилка', 'Невірне посилання.');

  var sub = SubscriberRepo.findByUnsubToken(token);
  if (!sub) return htmlPage('Відписка', 'Підписку не знайдено.');

  SubscriberRepo.updateSubscriber(sub.row, { status: 'unsubscribed' });
  SubscriberRepo.log('unsubscribe', sub.email, 'ok');
  return htmlPage('Відписка', 'Ви відписалися. Шкода, але ми розуміємо.');
}

// ------------------------------------------------------------
// Cron: called by time-based trigger every hour

function processNewPosts() {
  var props = PropertiesService.getScriptProperties();
  var rssUrl   = props.getProperty('RSS_URL')   || 'https://ivansolovey.github.io/feed.xml';
  var lastGuid = props.getProperty('LAST_PROCESSED_GUID') || '';

  // Fetch feed
  var feedText;
  try {
    feedText = UrlFetchApp.fetch(rssUrl).getContentText();
  } catch (err) {
    SubscriberRepo.log('processNewPosts', 'fetch_error', err.message);
    return;
  }

  var feed = RssParser.parse(feedText);
  if (!feed || !feed.items || feed.items.length === 0) return;

  // Sort ascending by published date
  var items = feed.items.slice().sort(function (a, b) {
    return new Date(a.published) - new Date(b.published);
  });

  // First-ever run: just initialize the GUID, send nothing
  if (!lastGuid) {
    var latestGuid = items[items.length - 1].guid;
    props.setProperty('LAST_PROCESSED_GUID', latestGuid);
    SubscriberRepo.log('processNewPosts', 'init', 'initialized with: ' + latestGuid);
    return;
  }

  // Find items newer than lastGuid
  var newItems = [];
  var foundLast = false;
  for (var i = 0; i < items.length; i++) {
    if (items[i].guid === lastGuid) { foundLast = true; continue; }
    if (foundLast) newItems.push(items[i]);
  }
  // lastGuid rotated out of feed — safe fallback: send only the latest
  if (!foundLast) {
    newItems = [items[items.length - 1]];
  }

  if (newItems.length === 0) return;

  var subscribers = SubscriberRepo.getActiveSubscribers();
  if (subscribers.length === 0) return;

  var webappUrl = props.getProperty('WEBAPP_URL');
  var fromName  = props.getProperty('FROM_NAME') || 'Іван Соловйов | Блог';
  var lastSentGuid = lastGuid;

  for (var p = 0; p < newItems.length; p++) {
    var post = newItems[p];

    // Check quota before each post batch
    var quota = MailApp.getRemainingDailyQuota();
    if (quota < subscribers.length) {
      SubscriberRepo.log('processNewPosts', 'quota_exceeded',
        'need ' + subscribers.length + ', have ' + quota + ', post: ' + post.title);
      break;
    }

    var allSent = true;
    for (var s = 0; s < subscribers.length; s++) {
      var sub = subscribers[s];
      try {
        var emailContent = EmailTemplates.buildPostEmail(post, sub.unsubToken, webappUrl);
        MailApp.sendEmail({
          to: sub.email,
          subject: post.title,
          htmlBody: emailContent.html,
          name: fromName,
          headers: {
            'List-Unsubscribe': '<' + webappUrl + '?action=unsubscribe&token=' + sub.unsubToken + '>'
          }
        });
        SubscriberRepo.log('send_post', sub.email, 'ok: ' + post.title);
      } catch (err) {
        allSent = false;
        SubscriberRepo.log('send_post', sub.email, 'error: ' + err.message);
      }
    }

    if (allSent) {
      lastSentGuid = post.guid;
    } else {
      break; // Retry from this post on next run
    }
  }

  // Only advance GUID if at least one post was fully sent
  if (lastSentGuid !== lastGuid) {
    props.setProperty('LAST_PROCESSED_GUID', lastSentGuid);
  }
}

// ------------------------------------------------------------
// Helpers

function sendConfirmationEmail(email, token) {
  var props = PropertiesService.getScriptProperties();
  var webappUrl = props.getProperty('WEBAPP_URL');
  var fromName  = props.getProperty('FROM_NAME') || 'Іван Соловйов | Блог';
  var content = EmailTemplates.buildConfirmationEmail(token, webappUrl);
  MailApp.sendEmail({
    to: email,
    subject: 'Підтвердіть підписку на блог',
    htmlBody: content.html,
    name: fromName
  });
  SubscriberRepo.log('confirmation_sent', email, 'ok');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function htmlPage(title, body) {
  var blogUrl = PropertiesService.getScriptProperties().getProperty('BLOG_URL')
    || 'https://ivansolovey.github.io';
  var html = '<!DOCTYPE html><html lang="uk">' +
    '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title>' +
    '<style>body{font-family:sans-serif;max-width:500px;margin:60px auto;padding:0 20px;text-align:center;color:#333}' +
    'a{color:#333}</style></head>' +
    '<body><h2>' + title + '</h2><p>' + body + '</p>' +
    '<p><a href="' + blogUrl + '">\u2190 Повернутися до блогу</a></p>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html);
}
