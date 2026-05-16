/**
 * Main entry point for the web app. This function is called when a user visits the web app URL.
 * It serves the dashboard HTML file or data, depending on the request parameters.
 * @param {Object} e - The event parameter for a GET request, containing parameters.
 * @returns {HtmlOutput|ContentService.TextOutput} The appropriate response.
 */
function doGet(e) {
  const page = e && e.parameter ? e.parameter.page : '';
  if (page) {
    // If a 'page' parameter is present, it's a data request from the dashboard.
    return handleDataRequest(page);
  } else {
    // If no page is specified, serve the main dashboard HTML file.
    // This allows the dashboard to be hosted directly from Apps Script.
    // Ensure you have a 'dashboard_.html' file in your Apps Script project.
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
    switch (page) {
      case 'overview':
        data = getSheetDataAsJson_('MachineSummary');
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
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
        return result.reverse();
    }
    
    return result;

  } catch (e) {
    Logger.log(`Error in getSheetDataAsJson_ for sheet "${sheetName}": ${e.message}, Stack: ${e.stack}`);
    return [{error: `Failed to retrieve data from "${sheetName}": ${e.message}`}];
  }
}
