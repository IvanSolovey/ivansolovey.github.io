// ============================================================
// EmailTemplates.gs — buildConfirmationEmail, buildPostEmail
// ============================================================

var EmailTemplates = (function () {

  function buildConfirmationEmail(token, webappUrl) {
    var blogUrl    = PropertiesService.getScriptProperties().getProperty('BLOG_URL')
      || 'https://ivansolovey.github.io';
    var confirmUrl = webappUrl + '?action=confirm&token=' + token;

    var html =
      '<!DOCTYPE html><html lang="uk">' +
      '<head><meta charset="UTF-8"></head>' +
      '<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333">' +
      '<h2 style="margin-bottom:8px">Підтвердіть підписку</h2>' +
      '<p>Привіт! Ви залишили свій email на ' +
        '<a href="' + blogUrl + '" style="color:#333">' + blogUrl.replace('https://', '') + '</a>.</p>' +
      '<p>Натисніть кнопку нижче, щоб підтвердити підписку і отримувати нові записи на пошту:</p>' +
      '<p style="margin:24px 0">' +
        '<a href="' + confirmUrl + '" ' +
          'style="display:inline-block;padding:12px 24px;background:#333;color:#fff;' +
          'text-decoration:none;border-radius:4px;font-size:15px">' +
          'Підтвердити підписку' +
        '</a>' +
      '</p>' +
      '<p style="color:#888;font-size:13px">Якщо це були не ви&nbsp;&mdash; просто проігноруйте цей лист.</p>' +
      '</body></html>';

    return { html: html };
  }

  function buildPostEmail(post, unsubToken, webappUrl) {
    var blogUrl   = PropertiesService.getScriptProperties().getProperty('BLOG_URL')
      || 'https://ivansolovey.github.io';
    var unsubUrl  = webappUrl + '?action=unsubscribe&token=' + unsubToken;
    var pubDate   = '';
    if (post.published) {
      try {
        pubDate = new Date(post.published).toLocaleDateString('uk-UA', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
      } catch (e) { pubDate = post.published; }
    }

    var html =
      '<!DOCTYPE html><html lang="uk">' +
      '<head><meta charset="UTF-8"></head>' +
      '<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333">' +
      '<h2 style="margin-bottom:4px">' + escapeHtml(post.title) + '</h2>' +
      (pubDate ? '<p style="color:#888;font-size:13px;margin-top:0">' + pubDate + '</p>' : '') +
      (post.summary ? '<p style="line-height:1.6">' + post.summary + '</p>' : '') +
      '<p style="margin:24px 0">' +
        '<a href="' + post.link + '" ' +
          'style="display:inline-block;padding:12px 24px;background:#333;color:#fff;' +
          'text-decoration:none;border-radius:4px;font-size:15px">' +
          'Читати далі \u2192' +
        '</a>' +
      '</p>' +
      '<hr style="border:none;border-top:1px solid #eee;margin:32px 0">' +
      '<p style="color:#aaa;font-size:12px">' +
        'Ви отримали цей лист, бо підписалися на ' +
        '<a href="' + blogUrl + '" style="color:#aaa">' + blogUrl.replace('https://', '') + '</a>. ' +
        '<a href="' + unsubUrl + '" style="color:#aaa">Відписатися</a>.' +
      '</p>' +
      '</body></html>';

    return { html: html };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    buildConfirmationEmail: buildConfirmationEmail,
    buildPostEmail:         buildPostEmail
  };

})();
