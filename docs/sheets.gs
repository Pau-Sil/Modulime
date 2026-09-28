function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("Error: JSON inválido");
  }

  var action = data.action || "create";

  if (action === "setConfig") {
    return setConfig(data);
  }
  if (action === "create") {
    if (typeof data.hours !== 'number' || data.hours <= 0) {
      return ContentService.createTextOutput("Error: horas inválidas");
    }
    return createEntry(data);
  }
  if (action === "edit") {
    return editEntry(data);
  }
  if (action === "delete") {
    return deleteEntry(data);
  }

  return ContentService.createTextOutput("Error: acción inválida");
}

function fechaHoy() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function fechaMes(fecha) {
  var parts = String(fecha || "").split("/");
  if (parts.length === 3) {
    return parts[1] + "/" + parts[2];
  }
  return null;
}

function getRegistrosSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Registros");
  if (!sheet) {
    sheet = ss.insertSheet("Registros");
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Fecha", "Horas", "Descripción", "Proyecto", "ID"]);
  }
  return sheet;
}

function getResumenSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Resumen");
  if (!sheet) {
    sheet = ss.insertSheet("Resumen");
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Mes", "Horas totales", "A cobrar"]);
  }
  return sheet;
}

function getConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Config");
  if (!sheet) {
    sheet = ss.insertSheet("Config");
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["clave", "valor"]);
  }
  return sheet;
}

function findRowById(sheet, id) {
  if (!id) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) {
      return i + 2;
    }
  }
  return -1;
}

function getConfigValue(sheet, key) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === key) {
      return rows[i][1];
    }
  }
  return null;
}

function setConfigValue(sheet, key, value) {
  var lastRow = sheet.getLastRow();
  var found = -1;
  if (lastRow >= 2) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === key) {
        found = i + 2;
        break;
      }
    }
  }
  if (found > 0) {
    sheet.getRange(found, 2).setValue(value);
  } else {
    sheet.appendRow([key, value]);
  }
}

function getHourlyRate() {
  var rate = parseFloat(getConfigValue(getConfigSheet(), "hourlyRate"));
  return isNaN(rate) ? 0 : rate;
}

function recalcularMes(fecha) {
  var mes = fechaMes(fecha);
  if (!mes) return;

  var registros = getRegistrosSheet();
  var resumen = getResumenSheet();

  var total = 0;
  var lastRow = registros.getLastRow();
  if (lastRow >= 2) {
    var rows = registros.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (fechaMes(String(rows[i][0] || "")) === mes) {
        total += Number(rows[i][1]) || 0;
      }
    }
  }

  var hourlyRate = getHourlyRate();
  var aCobrar = total * hourlyRate;

  var resumenLastRow = resumen.getLastRow();
  var found = -1;
  if (resumenLastRow >= 2) {
    var meses = resumen.getRange(2, 1, resumenLastRow - 1, 1).getValues();
    for (var j = 0; j < meses.length; j++) {
      if (String(meses[j][0]) === mes) {
        found = j + 2;
        break;
      }
    }
  }

  if (found > 0) {
    resumen.getRange(found, 2).setValue(total);
    resumen.getRange(found, 3).setValue(aCobrar);
  } else {
    resumen.appendRow([mes, total, aCobrar]);
  }
}

function createEntry(data) {
  var sheet = getRegistrosSheet();
  var fechaStr = data.date || fechaHoy();

  if (data.id && findRowById(sheet, data.id) > 0) {
    return ContentService.createTextOutput("Duplicado ignorado");
  }

  sheet.appendRow([fechaStr, data.hours, data.description || "", data.project || "", data.id || ""]);
  recalcularMes(fechaStr);
  return ContentService.createTextOutput("Created");
}

function editEntry(data) {
  var sheet = getRegistrosSheet();
  var row = findRowById(sheet, data.id);
  if (row <= 0) {
    return ContentService.createTextOutput("No encontrado");
  }

  var oldDate = String(sheet.getRange(row, 1).getValue() || "");

  if (data.date !== undefined) sheet.getRange(row, 1).setValue(data.date);
  if (data.hours !== undefined) sheet.getRange(row, 2).setValue(data.hours);
  if (data.description !== undefined) sheet.getRange(row, 3).setValue(data.description);
  if (data.project !== undefined) sheet.getRange(row, 4).setValue(data.project);

  var newDate = data.date !== undefined ? data.date : oldDate;
  recalcularMes(oldDate);
  if (newDate !== oldDate) recalcularMes(newDate);

  return ContentService.createTextOutput("Updated");
}

function deleteEntry(data) {
  var sheet = getRegistrosSheet();
  var row = findRowById(sheet, data.id);
  if (row <= 0) {
    return ContentService.createTextOutput("No encontrado");
  }

  var oldDate = String(sheet.getRange(row, 1).getValue() || "");
  sheet.deleteRow(row);
  recalcularMes(oldDate);
  return ContentService.createTextOutput("Deleted");
}

function setConfig(data) {
  var sheet = getConfigSheet();
  if (data.hourlyRate !== undefined) {
    setConfigValue(sheet, "hourlyRate", data.hourlyRate);
  }
  if (data.minuteBank !== undefined) {
    setConfigValue(sheet, "minuteBank", data.minuteBank);
  }
  return ContentService.createTextOutput("Config actualizada");
}
