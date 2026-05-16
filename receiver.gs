// receiver.gs

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rawDataSheet = ss.getSheetByName('RawData');
    const sensorDataSheet = ss.getSheetByName('SensorData');
    const sensorConfigSheet = ss.getSheetByName('SensorConfig');
    const alarmLogSheet = ss.getSheetByName('AlarmLog');
    const machineSummarySheet = ss.getSheetByName('MachineSummary');

    const postData = JSON.parse(e.postData.contents);
    const timestamp = postData.timestamp ? new Date(postData.timestamp) : new Date();

    // 3. Appends one row to RawData with machine-level fields
    rawDataSheet.appendRow([
      timestamp,
      postData.machine,
      postData.status,
      postData.cycle_time,
      postData.alarm_code || null,
      postData.alarm_message || null,
      postData.reject_count || 0,
      postData.notes || null
    ]);

    // 4. For each sensor in the sensors array
    if (postData.sensors && Array.isArray(postData.sensors)) {
      const sensorConfigData = sensorConfigSheet.getDataRange().getValues();
      sensorConfigData.shift(); // remove headers
      const sensorConfigMap = new Map(sensorConfigData.map(row => [row[0], row])); // Map by SensorID

      for (const sensor of postData.sensors) {
        const config = sensorConfigMap.get(sensor.sensor_id);
        if (config) {
          // Looks up SensorConfig
          const [sensorId, machine, sensorName, sensorType, unit, warnThreshold, criticalThreshold, direction, active] = config;
          
          if(active){
            let status = 'normal';
            const value = sensor.value;
            // Calculates Status
            if (direction === 'above') {
              if (value >= criticalThreshold) {
                status = 'critical';
              } else if (value >= warnThreshold) {
                status = 'warning';
              }
            } else if (direction === 'below') {
              if (value <= criticalThreshold) {
                status = 'critical';
              } else if (value <= warnThreshold) {
                status = 'warning';
              }
            }
            // Appends one row to SensorData
            sensorDataSheet.appendRow([timestamp, postData.machine, sensor.sensor_id, sensorName, sensorType, value, unit, status]);
          }
        }
      }
    }

    // 5. If alarm_code is not empty, appends one row to AlarmLog
    if (postData.alarm_code) {
      alarmLogSheet.appendRow([timestamp, postData.machine, postData.alarm_code, postData.alarm_message]);
    }

    // 6. Updates the matching machine row in MachineSummary
    const summaryRange = machineSummarySheet.getRange("A2:H" + machineSummarySheet.getLastRow());
    const summaryData = summaryRange.getValues();
    const machineCol = 0; // 'Machine' is column A
    
    for (let i = 0; i < summaryData.length; i++) {
        if (summaryData[i][machineCol] === postData.machine) {
            const row = i + 2;
            // with: LastUpdated, Status, CycleTime_sec, LastAlarm, TodayRejectCount
            machineSummarySheet.getRange(row, 2).setValue(timestamp); // LastUpdated
            machineSummarySheet.getRange(row, 3).setValue(postData.status); // Status
            machineSummarySheet.getRange(row, 4).setValue(postData.cycle_time); // CycleTime_sec
            if(postData.alarm_code){
                machineSummarySheet.getRange(row, 5).setValue(postData.alarm_code); // LastAlarm
            }
            
            // Handle TodayRejectCount: Assuming payload's reject_count is an increment for the day.
            const lastUpdatedCol = 1;
            const todayRejectCountCol = 6;
            const lastUpdatedDate = summaryData[i][lastUpdatedCol] ? new Date(summaryData[i][lastUpdatedCol]) : null;
            const today = new Date();
            const isSameDay = lastUpdatedDate &&
                lastUpdatedDate.getFullYear() === today.getFullYear() &&
                lastUpdatedDate.getMonth() === today.getMonth() &&
                lastUpdatedDate.getDate() === today.getDate();

            let newRejectCount = postData.reject_count || 0;
            if (isSameDay) {
                const currentRejectCount = summaryData[i][todayRejectCountCol] || 0;
                newRejectCount += currentRejectCount;
            }
            machineSummarySheet.getRange(row, 7).setValue(newRejectCount);
            
            break;
        }
    }

    // 7. Returns JSON response {"status": "ok"} on success
    return ContentService.createTextOutput(JSON.stringify({ status: "ok" })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // 8. Returns JSON response {"status": "error", "message": "..."} on failure
    Logger.log('doPost Error: ' + err.stack);
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Also write a helper function getConfigValue(param) that reads a value from the Config tab by parameter name.
function getConfigValue(param) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet) return null;
  const data = configSheet.getRange("A2:B" + configSheet.getLastRow()).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === param && data[i][0] !== '') {
      return data[i][1];
    }
  }
  return null;
}
