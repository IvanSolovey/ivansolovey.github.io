// ============================================================
// SubscriberRepo.gs — all Google Sheets read/write operations
// ============================================================

var SubscriberRepo = (function () {

  // Column indices (1-based)
  var C = {
    EMAIL:           1,
    STATUS:          2,
    SUBSCRIBED_AT:   3,
    CONFIRMED_AT:    4,
    CONFIRM_TOKEN:   5,
    UNSUB_TOKEN:     6,
    SOURCE:          7
  };

  function getSpreadsheet() {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    return SpreadsheetApp.openById(id);
  }

  function getSubscribersSheet() {
    return getSpreadsheet().getSheetByName('subscribers');
  }

  function getLogsSheet() {
    return getSpreadsheet().getSheetByName('logs');
  }

  // Returns all data rows (skips header row 1)
  function getAllRows() {
    var sheet = getSubscribersSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    return sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  }

  function rowToObj(row, rowNum) {
    return {
      row:          rowNum,
      email:        row[C.EMAIL - 1],
      status:       row[C.STATUS - 1],
      subscribedAt: row[C.SUBSCRIBED_AT - 1],
      confirmedAt:  row[C.CONFIRMED_AT - 1],
      confirmToken: row[C.CONFIRM_TOKEN - 1],
      unsubToken:   row[C.UNSUB_TOKEN - 1],
      source:       row[C.SOURCE - 1]
    };
  }

  function findByEmail(email) {
    var rows = getAllRows();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][C.EMAIL - 1] === email) return rowToObj(rows[i], i + 2);
    }
    return null;
  }

  function findByConfirmToken(token) {
    var rows = getAllRows();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][C.CONFIRM_TOKEN - 1] === token) return rowToObj(rows[i], i + 2);
    }
    return null;
  }

  function findByUnsubToken(token) {
    var rows = getAllRows();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][C.UNSUB_TOKEN - 1] === token) return rowToObj(rows[i], i + 2);
    }
    return null;
  }

  function addSubscriber(data) {
    getSubscribersSheet().appendRow([
      data.email,
      data.status,
      data.subscribedAt,
      data.confirmedAt || '',
      data.confirmToken,
      data.unsubToken,
      data.source || 'homepage_form'
    ]);
  }

  function updateSubscriber(rowNum, updates) {
    var sheet = getSubscribersSheet();
    if (updates.status       !== undefined) sheet.getRange(rowNum, C.STATUS).setValue(updates.status);
    if (updates.confirmedAt  !== undefined) sheet.getRange(rowNum, C.CONFIRMED_AT).setValue(updates.confirmedAt);
    if (updates.confirmToken !== undefined) sheet.getRange(rowNum, C.CONFIRM_TOKEN).setValue(updates.confirmToken);
    if (updates.unsubToken   !== undefined) sheet.getRange(rowNum, C.UNSUB_TOKEN).setValue(updates.unsubToken);
    if (updates.subscribedAt !== undefined) sheet.getRange(rowNum, C.SUBSCRIBED_AT).setValue(updates.subscribedAt);
  }

  function getActiveSubscribers() {
    var rows = getAllRows();
    return rows
      .map(function (row, i) { return rowToObj(row, i + 2); })
      .filter(function (sub) { return sub.status === 'active'; });
  }

  function log(action, email, result) {
    getLogsSheet().appendRow([new Date().toISOString(), action, email, result]);
  }

  return {
    findByEmail:          findByEmail,
    findByConfirmToken:   findByConfirmToken,
    findByUnsubToken:     findByUnsubToken,
    addSubscriber:        addSubscriber,
    updateSubscriber:     updateSubscriber,
    getActiveSubscribers: getActiveSubscribers,
    log:                  log
  };

})();
