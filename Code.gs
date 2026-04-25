var SPREADSHEET_ID  = '1VDC-DXFJED2ZGXXJLuXWHHctlUlpBTydk9x_ZP3yXWk';
var DRIVE_FOLDER_ID = '1cqSOIEvjHa7wOmpWvm4_lw0mnfSW-ZOr';
var TIMEZONE        = 'Asia/Seoul';
var ADMIN_PW        = '2130';

var SHEET_VIDEOS = '\uD83D\uDCF9 \uC601\uC0C1 \uBAA9\uB85D';
var SHEET_UPLOAD = '\uD83D\uDCCB \uC5C5\uB85C\uB4DC \uB85C\uADF8';
var SHEET_ERRORS = '\uD83D\uDEA8 \uC624\uB958 \uB85C\uADF8';

var COL_U_WEEK   = 1;
var COL_U_CLASS  = 2;
var COL_U_CHILD  = 3;
var COL_U_FILEID = 4;
var COL_U_MIME   = 5;
var COL_U_FNAME  = 6;

var COL_V_ID    = 0;
var COL_V_TITLE = 1;
var COL_V_DATE  = 2;

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  if (action === 'list')          { return handleList();           }
  if (action === 'getVideos')     { return handleGetVideos();      }
  if (action === 'getLogs')       { return handleGetLogs(e);       }
  if (action === 'getUploadLogs') { return handleGetUploadLogs(e); }
  if (action === 'scanFolder')    { return handleScanFolder(e);    }
  return jsonResponse({ success: false, error: 'unknown action' });
}

function doPost(e) {
  var raw;
  try { raw = JSON.parse(e.postData.contents); }
  catch (err) { return jsonResponse({ success: false, error: 'JSON parse error' }); }
  var action = raw.action || '';
  if (action === 'logError')         { return handleLogError(raw);         }
  if (action === 'deleteFile')       { return handleDeleteFile(raw);       }
  if (action === 'renameFile')       { return handleRenameFile(raw);       }
  if (action === 'addVideo')         { return handleAddVideo(raw);         }
  if (action === 'deleteVideoEntry') { return handleDeleteVideoEntry(raw); }
  if (action === 'registerFile')    { return handleRegisterFile(raw);    }
  return handleUpload(raw);
}

function handleList() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_UPLOAD);
  if (!sheet) { return jsonResponse({ success: true, data: [] }); }
  var rows = sheet.getDataRange().getValues();
  var map  = {};
  for (var i = 1; i < rows.length; i++) {
    var r      = rows[i];
    var week   = String(r[COL_U_WEEK]   || '');
    var cls    = String(r[COL_U_CLASS]  || '');
    var child  = String(r[COL_U_CHILD]  || '');
    var fileId = String(r[COL_U_FILEID] || '');
    var mime   = String(r[COL_U_MIME]   || '');
    if (!week || !cls || !child || !fileId) { continue; }
    var key = week + '||' + cls + '||' + child;
    if (!map[key]) {
      map[key] = { week: week, 'class': cls, child: child, files: [] };
    }
    var fname  = String(r[COL_U_FNAME]  || '');
    map[key].files.push({ id: fileId, mimeType: mime, fname: fname });
  }
  var data = [];
  for (var k in map) { data.push(map[k]); }
  return jsonResponse({ success: true, data: data });
}

function handleGetVideos() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_VIDEOS);
  if (!sheet) { return jsonResponse({ success: true, data: [] }); }
  var rows   = sheet.getDataRange().getValues();
  var videos = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[COL_V_ID]) { continue; }
    videos.push({
      id:    String(r[COL_V_ID]    || ''),
      title: String(r[COL_V_TITLE] || ''),
      date:  String(r[COL_V_DATE]  || '')
    });
  }
  return jsonResponse({ success: true, data: videos });
}

function handleGetLogs(e) {
  var pw = (e && e.parameter && e.parameter.pw) ? e.parameter.pw : '';
  if (pw !== ADMIN_PW) { return jsonResponse({ success: false, error: 'auth' }); }
  return jsonResponse({ success: true, logs: readSheet(SHEET_ERRORS) });
}

function handleGetUploadLogs(e) {
  var pw = (e && e.parameter && e.parameter.pw) ? e.parameter.pw : '';
  if (pw !== ADMIN_PW) { return jsonResponse({ success: false, error: 'auth' }); }
  return jsonResponse({ success: true, logs: readSheet(SHEET_UPLOAD) });
}

function handleUpload(raw) {
  var className = String(raw.className || '');
  var childName = String(raw.childName || '');
  var files     = raw.files;
  if (!files || files.length === 0) {
    return jsonResponse({ success: false, error: 'files empty' });
  }
  var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var week   = getWeekLabel();
  var saved  = [];
  for (var i = 0; i < files.length; i++) {
    var f     = files[i];
    var fname = String(f.name     || ('file' + i));
    var mime  = String(f.mimeType || 'application/octet-stream');
    var b64   = String(f.base64   || '');
    if (!b64) { continue; }
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, fname);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    saveUploadLog(week, className, childName, file.getId(), mime, fname);
    saved.push(file.getId());
  }
  return jsonResponse({ success: true, saved: saved });
}

function handleLogError(raw) {
  saveErrorLog(
    String(raw.error      || ''),
    String(raw.className  || ''),
    String(raw.childName  || ''),
    String(raw.step       || ''),
    String(raw.userAgent  || ''),
    String(raw.connection || ''),
    String(raw.extra      || '')
  );
  return jsonResponse({ success: true });
}

function handleDeleteFile(raw) {
  var pw     = String(raw.password || '');
  var fileId = String(raw.fileId   || '');
  if (pw !== ADMIN_PW) { return jsonResponse({ success: false, error: 'auth' }); }
  if (!fileId)         { return jsonResponse({ success: false, error: 'fileId missing' }); }
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    // 업로드 로그에서도 삭제
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_UPLOAD);
    if (sheet) {
      var rows = sheet.getDataRange().getValues();
      for (var i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][COL_U_FILEID]) === fileId) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    }
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function handleScanFolder(e) {
  var pw = (e && e.parameter && e.parameter.pw) ? e.parameter.pw : '';
  if (pw !== ADMIN_PW) { return jsonResponse({ success: false, error: 'auth' }); }

  // 업로드 로그에 있는 fileId 목록
  var ss      = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet   = ss.getSheetByName(SHEET_UPLOAD);
  var loggedIds = {};
  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var fid = String(rows[i][COL_U_FILEID] || '');
      if (fid) { loggedIds[fid] = true; }
    }
  }

  // 드라이브 폴더 스캔
  var folder  = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var files   = folder.getFiles();
  var missing = [];
  while (files.hasNext()) {
    var f = files.next();
    var id = f.getId();
    if (!loggedIds[id]) {
      missing.push({
        id:       id,
        name:     f.getName(),
        mime:     f.getMimeType(),
        created:  Utilities.formatDate(f.getDateCreated(), TIMEZONE, 'yyyy-MM-dd HH:mm')
      });
    }
  }
  // 최신순 정렬
  missing.sort(function(a, b) { return b.created > a.created ? 1 : -1; });
  return jsonResponse({ success: true, files: missing });
}

function handleRegisterFile(raw) {
  var pw        = String(raw.password  || '');
  var fileId    = String(raw.fileId    || '');
  var className = String(raw.className || '');
  var childName = String(raw.childName || '');
  var week      = String(raw.week      || '');
  if (pw !== ADMIN_PW) { return jsonResponse({ success: false, error: 'auth' }); }
  if (!fileId)         { return jsonResponse({ success: false, error: 'fileId missing' }); }
  try {
    var file = DriveApp.getFileById(fileId);
    var mime = file.getMimeType();
    var fname = file.getName();
    if (!week) { week = getWeekLabel(); }
    saveUploadLog(week, className, childName, fileId, mime, fname);
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function handleRenameFile(raw) {
  var pw      = String(raw.password || '');
  var fileId  = String(raw.fileId   || '');
  var newName = String(raw.newName  || '');
  if (pw !== ADMIN_PW) { return jsonResponse({ success: false, error: 'auth' }); }
  if (!fileId)         { return jsonResponse({ success: false, error: 'fileId missing' }); }
  try {
    DriveApp.getFileById(fileId).setName(newName);
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function handleAddVideo(raw) {
  var pw    = String(raw.password || '');
  var id    = String(raw.id       || '');
  var title = String(raw.title    || '');
  var date  = String(raw.date     || '');
  if (pw !== ADMIN_PW) { return jsonResponse({ success: false, error: 'auth' }); }
  if (!id)             { return jsonResponse({ success: false, error: 'id missing' }); }
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_VIDEOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_VIDEOS);
    sheet.appendRow(['ID', '\uC81C\uBAA9', '\uB0A0\uC9DC']);
  }
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL_V_ID]) === id) {
      return jsonResponse({ success: true, note: 'duplicate' });
    }
  }
  sheet.appendRow([id, title, date]);
  return jsonResponse({ success: true });
}

function handleDeleteVideoEntry(raw) {
  var pw = String(raw.password || '');
  var id = String(raw.id       || '');
  if (pw !== ADMIN_PW) { return jsonResponse({ success: false, error: 'auth' }); }
  if (!id)             { return jsonResponse({ success: false, error: 'id missing' }); }
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_VIDEOS);
  if (!sheet) { return jsonResponse({ success: false, error: 'sheet not found' }); }
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][COL_V_ID]) === id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'not found' });
}

function getWeekLabel() {
  var now      = new Date();
  var dow      = parseInt(Utilities.formatDate(now, TIMEZONE, 'u'), 10);
  var daysBack = (dow === 7) ? 0 : dow;
  var sunday   = new Date(now.getTime() - daysBack * 86400000);
  return Utilities.formatDate(sunday, TIMEZONE, 'yyyy-MM-dd') + '_\uC8FC';
}

function saveUploadLog(week, className, childName, fileId, mimeType, fname) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_UPLOAD);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_UPLOAD);
    sheet.appendRow(['\uC2DC\uAC04', '\uC8FC\uCC28', '\uBC18', '\uC774\uB984', '\uD30C\uC77C ID', '\uD615\uC2DD', '\uD30C\uC77C\uBA85']);
  }
  var time = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([time, week, className, childName, fileId, mimeType, fname || '']);
}

function saveErrorLog(error, className, childName, step, userAgent, connection, extra) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_ERRORS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ERRORS);
    sheet.appendRow(['\uC2DC\uAC04', '\uBC18', '\uC774\uB984', '\uB2E8\uACC4', '\uBA54\uC2DC\uC9C0', 'UserAgent', '\uC5F0\uACB0', '\uCD94\uAC00']);
  }
  var time = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([time, className, childName, step, error, userAgent, connection, extra]);
}

function readSheet(sheetName) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { return []; }
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) { return []; }
  var headers = data[0];
  var result  = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[String(headers[j])] = data[i][j];
    }
    result.push(row);
  }
  return result;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
