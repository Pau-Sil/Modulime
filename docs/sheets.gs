function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var fechaHoy = new Date();
  var zonaHoraria = Session.getScriptTimeZone();
  var fechaStr = Utilities.formatDate(fechaHoy, zonaHoraria, "dd/MM/yyyy");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Registros");
  var lastRow = sheet.getLastRow();

  // --- BUSCAR FILA DE HOY ---
  var foundRow = -1;
  var startSearch = Math.max(2, lastRow - 30);
  var numRows = (lastRow - startSearch) + 1;

  if (numRows > 0) {
    var dates = sheet.getRange(startSearch, 1, numRows, 1).getDisplayValues();
    for (var i = 0; i < dates.length; i++) {
      if (dates[i][0] == fechaStr) {
        foundRow = startSearch + i;
        break;
      }
    }
  }

  // --- ACTUALIZAR O INSERTAR ---
  if (foundRow > 0) {
    // >> ACTUALIZAR FILA EXISTENTE
    var cellHours = sheet.getRange(foundRow, 2);
    var currentHours = cellHours.getValue();
    if (typeof currentHours !== 'number') currentHours = 0;
    cellHours.setValue(currentHours + data.hours);

    if (data.description) {
      sheet.getRange(foundRow, 3).setValue(data.description);
    }
    if (data.project) {
      sheet.getRange(foundRow, 4).setValue(data.project);
    }
    return ContentService.createTextOutput("Updated");

  } else {
    // >> CREAR NUEVA FILA (Columna 1: Fecha, Columna 2: Horas, Columna 3: Desc, Columna 4: Proyecto)
    sheet.appendRow([fechaStr, data.hours, data.description, data.project || ""]);
    return ContentService.createTextOutput("Created");
  }
}
