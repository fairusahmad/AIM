const AIM_SPREADSHEET_ID = '1RkvO_w75qAGwLZsjNnXKCvPsXWPLVpRuBLxGJheNRxw';

/**
 * Main entry point for the web app. This function is called when a user visits the web app URL.
 * It serves the dashboard HTML file or data, depending on the request parameters.
 * @param {Object} e - The event parameter for a GET request, containing parameters.
 * @returns {HtmlOutput|ContentService.TextOutput} The appropriate response.
 */
function doGet(e) {
  const page = e && e.parameter ? e.parameter.page : '';
  const debugMode = e && e.parameter ? e.parameter.debug : '';
  Logger.log('doGet invoked. page=%s, hasEvent=%s', page || '(html)', !!e);
  if (debugMode) {
    Logger.log('Serving plain HTML debug page.');
    return HtmlService.createHtmlOutput(buildDashboardDebugPage_())
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }
  if (page) {
    // If a 'page' parameter is present, it's a data request from the dashboard.
    return handleDataRequest(page);
  } else {
    // If no page is specified, serve the main dashboard HTML file.
    // This allows the dashboard to be hosted directly from Apps Script.
    // Ensure you have a 'dashboard_.html' file in your Apps Script project.
    Logger.log('Serving dashboard_ HTML file.');
    return HtmlService.createHtmlOutputFromFile('dashboard_')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }
}

/**
 * Handles data requests from the frontend dashboard.
 * @param {string} page - The specific data page being requested (e.g., 'overview', 'sensors').
 * @returns {ContentService.TextOutput} The requested data as a JSON string.
 */
function handleDataRequest(page) {
  let data;
  try {
    Logger.log('handleDataRequest start. page=%s', page);
    switch (page) {
      case 'ping':
        data = getDashboardPing_();
        break;
      case 'debug':
        data = getDashboardDebug_();
        break;
      case 'overview':
        data = getSheetDataAsJson_('MachineSummary');
        break;
      case 'meta':
        data = getDashboardMeta_();
        break;
      case 'sensors':
        // Return the last 300 sensor readings for performance, converting Date objects to ISO strings.
        data = getSheetDataAsJson_('SensorData', 300);
        break;
      case 'anomalies':
        data = getSheetDataAsJson_('AnomalyLog', 200); // Most recent 200 anomalies
        break;
      case 'downtime':
        data = getSheetDataAsJson_('DowntimeLog', 200); // Most recent 200 downtime entries
        break;
      case 'alarms':
        data = getSheetDataAsJson_('AlarmLog', 200); // Most recent 200 alarm entries
        break;
      case 'cycletime':
        // Return the last 300 cycle time readings, specifically selecting relevant columns.
        data = getSheetDataAsJson_('RawData', 300, ['Timestamp', 'Machine', 'CycleTime_sec']);
        break;
      default:
        data = { error: 'Invalid page parameter.' };
        break;
    }
    Logger.log('handleDataRequest success. page=%s, payloadType=%s', page, Array.isArray(data) ? 'array' : typeof data);
  } catch (e) {
    Logger.log(`Error in handleDataRequest for page ${page}: ${e.message}`);
    data = { error: `An error occurred while fetching data for ${page}: ${e.message}` };
  }
  
  // Return the data as a JSON string with the appropriate MIME type.
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Generic helper function to retrieve data from a specified Google Sheet tab
 * and convert it into an array of JavaScript objects, where each object represents a row.
 * Headers are taken from the first row of the sheet.
 * @param {string} sheetName The name of the sheet to retrieve data from (e.g., 'MachineSummary').
 * @param {number=} maxRows Optional. The maximum number of recent data rows to retrieve.
 *                          If the sheet has more rows, only the latest 'maxRows' will be returned.
 * @param {Array<string>=} specificHeaders Optional. An array of specific header names to include.
 *                                         If provided, only these columns will be returned in the objects.
 * @returns {Array<Object>} An array of objects, each representing a row of data.
 *                          Returns an object with an 'error' property if the sheet is not found or headers are missing.
 */
function getSheetDataAsJson_(sheetName, maxRows, specificHeaders) {
  try {
    Logger.log('getSheetDataAsJson_ start. sheetName=%s, maxRows=%s, specificHeaders=%s', sheetName, maxRows || '', specificHeaders ? specificHeaders.join(',') : '');
    const ss = getAIMSpreadsheet_();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`Error: Sheet "${sheetName}" not found.`);
      return [{error: `Sheet "${sheetName}" not found.`}];
    }
    
    const dataRange = sheet.getDataRange();
    const allValues = dataRange.getValues();
    
    if (allValues.length < 1) {
      // Sheet is completely empty
      return []; 
    }
    
    const allSheetHeaders = allValues[0];
    let dataRows = allValues.slice(1); // All rows excluding the header row
    
    // Determine which headers to use and their indices
    let headersToUse = specificHeaders || allSheetHeaders;
    let headerIndices = headersToUse.map(h => allSheetHeaders.indexOf(h));
    
    // Check if all requested specificHeaders exist in the sheet
    if (specificHeaders) {
      const missingHeaders = specificHeaders.filter(h => allSheetHeaders.indexOf(h) === -1);
      if (missingHeaders.length > 0) {
        Logger.log(`Error: Missing headers in sheet "${sheetName}": ${missingHeaders.join(', ')}`);
        return [{error: `Missing headers in sheet "${sheetName}": ${missingHeaders.join(', ')}`}];
      }
    }
    
    // If maxRows is specified, get only the most recent rows
    if (maxRows && dataRows.length > maxRows) {
        dataRows = dataRows.slice(dataRows.length - maxRows);
    }
    
    // Map data rows to objects
    const result = dataRows.map(row => {
      let obj = {};
      headerIndices.forEach((colIndex, i) => {
          const header = headersToUse[i];
          let value = row[colIndex];
          // Convert Date objects to ISO string format for consistent client-side parsing
          if (value instanceof Date) {
            obj[header] = value.toISOString();
          } else {
            obj[header] = value;
          }
      });
      return obj;
    });

    // For log-type data, it's often useful to show the most recent first.
    // This applies to AnomalyLog, DowntimeLog, AlarmLog.
    if (['AnomalyLog', 'DowntimeLog', 'AlarmLog'].includes(sheetName)) {
        Logger.log('getSheetDataAsJson_ done. sheetName=%s, rowsReturned=%s, reversed=true', sheetName, result.length);
        return result.reverse();
    }
    
    Logger.log('getSheetDataAsJson_ done. sheetName=%s, rowsReturned=%s', sheetName, result.length);
    return result;

  } catch (e) {
    Logger.log(`Error in getSheetDataAsJson_ for sheet "${sheetName}": ${e.message}, Stack: ${e.stack}`);
    return [{error: `Failed to retrieve data from "${sheetName}": ${e.message}`}];
  }
}

function getDashboardMeta_() {
  const ss = getAIMSpreadsheet_();
  Logger.log('getDashboardMeta_ success. spreadsheetName=%s', ss.getName());
  return {
    spreadsheetUrl: ss.getUrl(),
    spreadsheetName: ss.getName(),
    generatedAt: new Date().toISOString()
  };
}

function getDashboardPing_() {
  Logger.log('getDashboardPing_ success.');
  return {
    status: 'ok',
    message: 'Dashboard web app is reachable.',
    generatedAt: new Date().toISOString()
  };
}

function getDashboardDebug_() {
  Logger.log('getDashboardDebug_ start.');
  const debug = {
    timestamp: new Date().toISOString(),
    spreadsheetId: AIM_SPREADSHEET_ID,
    deploymentReachable: true,
    spreadsheetOpened: false,
    spreadsheetName: null,
    spreadsheetUrl: null,
    sheets: [],
    htmlFileAccessible: false,
    errors: []
  };

  try {
    const ss = getAIMSpreadsheet_();
    debug.spreadsheetOpened = true;
    debug.spreadsheetName = ss.getName();
    debug.spreadsheetUrl = ss.getUrl();
    debug.sheets = ss.getSheets().map(function(sheet) {
      return {
        name: sheet.getName(),
        rows: sheet.getLastRow(),
        columns: sheet.getLastColumn()
      };
    });
  } catch (err) {
    Logger.log('getDashboardDebug_ spreadsheet error: %s', err.message);
    debug.errors.push('Spreadsheet error: ' + err.message);
  }

  try {
    const html = HtmlService.createHtmlOutputFromFile('dashboard_').getContent();
    debug.htmlFileAccessible = true;
    debug.htmlLength = html.length;
  } catch (err) {
    Logger.log('getDashboardDebug_ HTML error: %s', err.message);
    debug.errors.push('HTML error: ' + err.message);
  }

  Logger.log('getDashboardDebug_ result: %s', JSON.stringify(debug));
  return debug;
}

function getAIMSpreadsheet_() {
  Logger.log('Opening spreadsheet by ID: %s', AIM_SPREADSHEET_ID);
  return SpreadsheetApp.openById(AIM_SPREADSHEET_ID);
}

function debugDashboardExecutionLog() {
  Logger.log('debugDashboardExecutionLog start');
  const ping = getDashboardPing_();
  Logger.log('Ping: %s', JSON.stringify(ping));
  const meta = getDashboardMeta_();
  Logger.log('Meta: %s', JSON.stringify(meta));
  const debug = getDashboardDebug_();
  Logger.log('Debug: %s', JSON.stringify(debug));
  const overview = getSheetDataAsJson_('MachineSummary');
  Logger.log('Overview rows: %s', Array.isArray(overview) ? overview.length : 'n/a');
  Logger.log('debugDashboardExecutionLog end');
}

function debugDashboardFullRender() {
  Logger.log('debugDashboardFullRender start');

  const htmlOutput = doGet();
  const htmlContent = htmlOutput.getContent();
  Logger.log('HTML length: %s', htmlContent.length);
  Logger.log('HTML preview: %s', htmlContent.substring(0, 500));

  const metaResponse = handleDataRequest('meta').getContent();
  Logger.log('Meta response: %s', metaResponse);

  const debugResponse = handleDataRequest('debug').getContent();
  Logger.log('Debug response: %s', debugResponse);

  const overviewResponse = handleDataRequest('overview').getContent();
  Logger.log('Overview response preview: %s', overviewResponse.substring(0, 500));

  Logger.log('debugDashboardFullRender end');
}

function buildDashboardDebugPage_() {
  const debug = getDashboardDebug_();
  const meta = getDashboardMeta_();
  const overview = getSheetDataAsJson_('MachineSummary');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Debug</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; background: #f7f9fc; color: #1f2937; }
    h1 { margin-bottom: 8px; }
    .card { background: white; border: 1px solid #dbe3ec; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    pre { white-space: pre-wrap; word-break: break-word; background: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow: auto; }
    .ok { color: #15803d; }
    .warn { color: #b45309; }
    .bad { color: #b91c1c; }
  </style>
</head>
<body>
  <h1>Dashboard Deployment Debug</h1>
  <p>Use this page to confirm the deployed web app is serving the latest code.</p>

  <div class="card">
    <h2>Meta</h2>
    <p><strong>Spreadsheet:</strong> ${escapeHtmlForDebug_(meta.spreadsheetName)}</p>
    <p><strong>Generated:</strong> ${escapeHtmlForDebug_(meta.generatedAt)}</p>
    <p><strong>Spreadsheet URL:</strong> <a href="${escapeHtmlForDebug_(meta.spreadsheetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtmlForDebug_(meta.spreadsheetUrl)}</a></p>
  </div>

  <div class="card">
    <h2>Checks</h2>
    <p class="${debug.spreadsheetOpened ? 'ok' : 'bad'}"><strong>Spreadsheet Opened:</strong> ${debug.spreadsheetOpened}</p>
    <p class="${debug.htmlFileAccessible ? 'ok' : 'bad'}"><strong>HTML File Accessible:</strong> ${debug.htmlFileAccessible}</p>
    <p><strong>HTML Length:</strong> ${debug.htmlLength || 0}</p>
    <p><strong>Sheet Count:</strong> ${debug.sheets.length}</p>
  </div>

  <div class="card">
    <h2>MachineSummary Preview</h2>
    <pre>${escapeHtmlForDebug_(JSON.stringify(overview, null, 2))}</pre>
  </div>

  <div class="card">
    <h2>Full Debug JSON</h2>
    <pre>${escapeHtmlForDebug_(JSON.stringify(debug, null, 2))}</pre>
  </div>
</body>
</html>`;
}

function escapeHtmlForDebug_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
