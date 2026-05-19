const AIM_SPREADSHEET_ID = '1RkvO_w75qAGwLZsjNnXKCvPsXWPLVpRuBLxGJheNRxw';

function doGet(e) {
  const page = e && e.parameter ? e.parameter.page : '';
  const callback = e && e.parameter ? e.parameter.callback : '';
  if (page) {
    return handleDataRequest(page, callback, e.parameter || {});
  }

  return HtmlService.createHtmlOutputFromFile('dashboard_')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function handleDataRequest(page, callback, params) {
  let data;
  params = params || {};

  try {
    switch (page) {
      case 'ping':
        data = {
          status: 'ok',
          message: 'Dashboard web app is reachable.',
          generatedAt: new Date().toISOString()
        };
        break;
      case 'meta':
        data = getDashboardMeta_();
        break;
      case 'overview':
        data = getSheetDataAsJson_('MachineSummary');
        break;
      case 'sensors':
        data = getSensorDataForRange_(params.range);
        break;
      case 'sensorconfig':
        data = getSheetDataAsJson_('SensorConfig', 500, ['SensorID', 'Machine', 'SensorName', 'SensorType', 'Unit', 'WarnThreshold', 'CriticalThreshold', 'Direction', 'Active']);
        break;
      case 'anomalies':
        data = getSheetDataAsJson_('AnomalyLog', 200);
        break;
      case 'downtime':
        data = getSheetDataAsJson_('DowntimeLog', 200);
        break;
      case 'alarms':
        data = getSheetDataAsJson_('AlarmLog', 200);
        break;
      case 'cycletime':
        data = getSheetDataAsJson_('RawData', 300, ['Timestamp', 'Machine', 'CycleTime_sec']);
        break;
      default:
        data = { error: 'Invalid page parameter.' };
        break;
    }
  } catch (err) {
    data = { error: `An error occurred while fetching data for ${page}: ${err.message}` };
  }

  if (callback) {
    return ContentService.createTextOutput(`${callback}(${JSON.stringify(data)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetDataAsJson_(sheetName, maxRows, specificHeaders) {
  const ss = getAIMSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return [{ error: `Sheet "${sheetName}" not found.` }];
  }

  const allValues = sheet.getDataRange().getValues();
  if (allValues.length < 1) {
    return [];
  }

  const allSheetHeaders = allValues[0];
  let dataRows = allValues.slice(1);
  const headersToUse = specificHeaders || allSheetHeaders;
  const headerIndices = headersToUse.map(function(header) {
    return allSheetHeaders.indexOf(header);
  });

  if (specificHeaders) {
    const missingHeaders = specificHeaders.filter(function(header) {
      return allSheetHeaders.indexOf(header) === -1;
    });
    if (missingHeaders.length > 0) {
      return [{ error: `Missing headers in sheet "${sheetName}": ${missingHeaders.join(', ')}` }];
    }
  }

  if (maxRows && dataRows.length > maxRows) {
    dataRows = dataRows.slice(dataRows.length - maxRows);
  }

  const result = dataRows.map(function(row) {
    const item = {};
    headerIndices.forEach(function(colIndex, index) {
      const header = headersToUse[index];
      const value = row[colIndex];
      item[header] = value instanceof Date ? value.toISOString() : value;
    });
    return item;
  });

  if (['AnomalyLog', 'DowntimeLog', 'AlarmLog'].indexOf(sheetName) !== -1) {
    return result.reverse();
  }

  return result;
}

function getSensorDataForRange_(rangeKey) {
  const rangeMinutesMap = {
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '24h': 1440
  };

  const selectedRange = rangeKey || '1h';
  const sensorData = getSheetDataAsJson_('SensorData');
  if (!Array.isArray(sensorData) || selectedRange === 'all') {
    return sensorData;
  }

  const rangeMinutes = rangeMinutesMap[selectedRange];
  if (!rangeMinutes) {
    return sensorData;
  }

  const timestamps = sensorData
    .map(function(row) {
      return new Date(row.Timestamp).getTime();
    })
    .filter(function(value) {
      return !isNaN(value);
    });

  if (timestamps.length === 0) {
    return sensorData;
  }

  const latestTimestamp = Math.max.apply(null, timestamps);
  const rangeStart = latestTimestamp - (rangeMinutes * 60 * 1000);

  return sensorData.filter(function(row) {
    const itemTimestamp = new Date(row.Timestamp).getTime();
    return isNaN(itemTimestamp) || itemTimestamp >= rangeStart;
  });
}

function getDashboardMeta_() {
  const ss = getAIMSpreadsheet_();
  return {
    spreadsheetUrl: ss.getUrl(),
    spreadsheetName: ss.getName(),
    generatedAt: new Date().toISOString()
  };
}

function getAIMSpreadsheet_() {
  return SpreadsheetApp.openById(AIM_SPREADSHEET_ID);
}
