/**
 * @OnlyCurrentDoc
 *
 * The doGet function is the entry point for the web app.
 * It serves data from the spreadsheet as JSON, based on the 'page' parameter.
 */
function doGet(e) {
  const page = e.parameter.page || 'overview';
  let data;

  try {
    switch (page) {
      case 'overview':
        data = getOverviewData();
        break;
      case 'sensors':
        data = getSensorData();
        break;
      case 'anomalies':
        data = getTableData('AnomalyLog', 100);
        break;
      case 'downtime':
        data = getTableData('DowntimeLog', 100);
        break;
      case 'alarms':
        data = getTableData('AlarmLog', 100);
        break;
      case 'cycletime':
        data = getCycleTimeData();
        break;
      default:
        data = { error: 'Invalid page parameter.' };
    }
  } catch (error) {
    data = { error: 'An error occurred while fetching data: ' + error.message, stack: error.stack };
  }

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Retrieves data from the MachineSummary sheet.
 */
function getOverviewData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MachineSummary');
  if (!sheet) return { error: 'MachineSummary sheet not found.' };
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = range.getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const data = values.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  
  return data;
}

/**
 * Retrieves the last 200 rows from the SensorData sheet.
 */
function getSensorData() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SensorData');
    if (!sheet) return { error: 'SensorData sheet not found.' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return []; // FIX: Handle empty sheet

    const rowCount = 200;
    const startRow = Math.max(2, lastRow - rowCount + 1);
    const numRows = lastRow - startRow + 1;

    const range = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn());
    const values = range.getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const data = values.map(row => {
        let obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i];
        });
        return obj;
    });

    return data;
}


/**
 * Retrieves the last 100 rows from the RawData sheet for cycle time analysis.
 */
function getCycleTimeData() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RawData');
    if (!sheet) return { error: 'RawData sheet not found.' };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return []; // FIX: Handle empty sheet

    const rowCount = 100;
    const startRow = Math.max(2, lastRow - rowCount + 1);
    const numRows = lastRow - startRow + 1;
    
    const range = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn());
    const values = range.getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const data = values.map(row => {
        let obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i];
        });
        return obj;
    });

    return data;
}


/**
 * A generic function to retrieve data from any given log sheet.
 * @param {string} sheetName The name of the sheet to get data from.
 * @param {number} rowCount The number of recent rows to retrieve.
 */
function getTableData(sheetName, rowCount = 100) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { error: `${sheetName} sheet not found.` };
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; // No data rows
  
  const startRow = Math.max(2, lastRow - rowCount + 1);
  const numRows = lastRow - startRow + 1;
  
  const range = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn());
  const values = range.getValues();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const data = values.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      // Handle Date objects
      if (row[i] instanceof Date) {
        obj[header] = row[i].toISOString();
      } else {
        obj[header] = row[i];
      }
    });
    return obj;
  }).reverse(); // Show most recent first
  
  return data;
}
