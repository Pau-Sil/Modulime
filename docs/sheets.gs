function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("Error: JSON inválido");
  }

  if (typeof data.hours !== 'number' || data.hours <= 0) {
    return ContentService.createTextOutput("Error: horas inválidas");
  }

  var fechaHoy = new Date();
  var zonaHoraria = Session.getScriptTimeZone();
  var fechaStr = Utilities.formatDate(fechaHoy, zonaHoraria, "dd/MM/yyyy");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Registros");

  if (!sheet) {
    sheet = ss.insertSheet("Registros");
    sheet.appendRow(["Fecha", "Horas", "Descripción", "Proyecto", "ID"]);
  }

  // Si la hoja está vacía (sin encabezados), agregarlos
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(["Fecha", "Horas", "Descripción", "Proyecto", "ID"]);
    lastRow = 1;
  }

  // --- VERIFICAR SI EL ID YA FUE PROCESADO (idempotencia) ---
  if (data.id && lastRow >= 2) {
    var ids = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
    for (var j = 0; j < ids.length; j++) {
      if (ids[j][0] === data.id) {
        return ContentService.createTextOutput("Duplicado ignorado");
      }
    }
  }

  // --- BUSCAR FILA DE HOY (recorre todas las filas desde la 2) ---
  var foundRow = -1;
  if (lastRow >= 2) {
    var numRows = lastRow - 1;
    var dates = sheet.getRange(2, 1, numRows, 1).getDisplayValues();
    for (var i = 0; i < dates.length; i++) {
      if (dates[i][0] === fechaStr) {
        foundRow = i + 2;
        break;
      }
    }
  }

  var desc = data.description || "";
  var project = data.project || "";

  if (foundRow > 0) {
    // --- ACTUALIZAR FILA EXISTENTE ---
    var currentHours = sheet.getRange(foundRow, 2).getValue();
    if (typeof currentHours !== 'number') currentHours = 0;
    sheet.getRange(foundRow, 2).setValue(currentHours + data.hours);

    // Concatenar descripción si es nueva (no repetir)
    var currentDesc = sheet.getRange(foundRow, 3).getValue() || "";
    if (desc && currentDesc.indexOf(desc) === -1) {
      var newDesc = currentDesc ? currentDesc + "\n" + desc : desc;
      sheet.getRange(foundRow, 3).setValue(newDesc);
    }

    // Concatenar proyecto si es nuevo
    var currentProject = sheet.getRange(foundRow, 4).getValue() || "";
    if (project && currentProject.indexOf(project) === -1) {
      var newProject = currentProject ? currentProject + "\n" + project : project;
      sheet.getRange(foundRow, 4).setValue(newProject);
    }

    // Guardar el ID para futura deduplicación
    if (data.id) {
      sheet.getRange(foundRow, 5).setValue(data.id);
    }

    return ContentService.createTextOutput("Updated");

  } else {
    // --- CREAR NUEVA FILA ---
    sheet.appendRow([fechaStr, data.hours, desc, project, data.id || ""]);
    return ContentService.createTextOutput("Created");
  }
}
