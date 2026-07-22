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
  const ss = getAIMSpreadsheet_();
  const sheet = ss.getSheetByName('SensorData');
  if (!sheet) {
    return [{ error: 'Sheet "SensorData" not found.' }];
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const timestampIndex = headers.indexOf('Timestamp');
  if (timestampIndex === -1) {
    return [{ error: 'Missing "Timestamp" header in sheet "SensorData".' }];
  }

  const rangeMinutes = rangeMinutesMap[selectedRange];
  const fullHistoryRequested = selectedRange === 'all' || !rangeMinutes;
  const recentRows = fullHistoryRequested
    ? getRecentSensorSheetRows_(sheet, headers, null, timestampIndex, 5000)
    : getRecentSensorSheetRows_(sheet, headers, rangeMinutes, timestampIndex);

  return sampleSensorRows_(recentRows, fullHistoryRequested ? 180 : 120);
}

function getRecentSensorSheetRows_(sheet, headers, rangeMinutes, timestampIndex, maxRowsToRead) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const dataRowCount = lastRow - 1;
  if (dataRowCount <= 0) {
    return [];
  }

  const chunkSize = 500;
  const rows = [];
  let latestTimestamp = null;
  let rowsRead = 0;

  for (let endRow = lastRow; endRow >= 2; endRow -= chunkSize) {
    const startRow = Math.max(2, endRow - chunkSize + 1);
    const rowCount = endRow - startRow + 1;
    const values = sheet.getRange(startRow, 1, rowCount, lastColumn).getValues();

    for (let i = values.length - 1; i >= 0; i -= 1) {
      const row = values[i];
      const timestampValue = row[timestampIndex];
      const rowTimestamp = timestampValue instanceof Date
        ? timestampValue.getTime()
        : new Date(timestampValue).getTime();

      if (!isNaN(rowTimestamp) && latestTimestamp === null) {
        latestTimestamp = rowTimestamp;
      }

      if (
        latestTimestamp !== null &&
        rangeMinutes &&
        !isNaN(rowTimestamp) &&
        rowTimestamp < (latestTimestamp - (rangeMinutes * 60 * 1000))
      ) {
        return rows.reverse();
      }

      rows.push(mapSheetRowToObject_(headers, row));
      rowsRead += 1;

      if (maxRowsToRead && rowsRead >= maxRowsToRead) {
        return rows.reverse();
      }
    }
  }

  return rows.reverse();
}

function mapSheetRowToObject_(headers, row) {
  return headers.reduce(function(item, header, index) {
    const value = row[index];
    item[header] = value instanceof Date ? value.toISOString() : value;
    return item;
  }, {});
}

function sampleSensorRows_(rows, maxPointsPerSensor) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const groupedRows = rows.reduce(function(acc, row) {
    const sensorId = row.SensorID || 'UNKNOWN_SENSOR';
    if (!acc[sensorId]) {
      acc[sensorId] = [];
    }
    acc[sensorId].push(row);
    return acc;
  }, {});

  const sampledRows = [];
  Object.keys(groupedRows).forEach(function(sensorId) {
    const sensorRows = groupedRows[sensorId];
    if (sensorRows.length <= maxPointsPerSensor) {
      sampledRows.push.apply(sampledRows, sensorRows);
      return;
    }

    const step = Math.ceil(sensorRows.length / maxPointsPerSensor);
    for (let index = 0; index < sensorRows.length; index += step) {
      sampledRows.push(sensorRows[index]);
    }

    const lastRow = sensorRows[sensorRows.length - 1];
    if (sampledRows[sampledRows.length - 1] !== lastRow) {
      sampledRows.push(lastRow);
    }
  });

  return sampledRows.sort(function(left, right) {
    return new Date(left.Timestamp).getTime() - new Date(right.Timestamp).getTime();
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
