// alerts.gs

function sendAlerts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const anomalyLogSheet = ss.getSheetByName('AnomalyLog');
  const dataRange = anomalyLogSheet.getDataRange();
  const data = dataRange.getValues();
  const headers = data.shift();
  
  const alertSentColIndex = headers.indexOf('AlertSent');
  if (alertSentColIndex === -1) {
    Logger.log('AlertSent column not found in AnomalyLog.');
    return;
  }

  const unalertedRows = [];
  const unalertedAnomalies = data.filter((row, index) => {
    if (!row[alertSentColIndex]) {
      unalertedRows.push(index + 2); // +2 because of 1-based index and header
      return true;
    }
    return false;
  });

  if (unalertedAnomalies.length === 0) {
    return; // No new anomalies to alert
  }

  const anomaliesByMachine = {};
  unalertedAnomalies.forEach(row => {
    const machine = row[1];
    if (!anomaliesByMachine[machine]) {
      anomaliesByMachine[machine] = [];
    }
    anomaliesByMachine[machine].push(row);
  });

  const alertEmail1 = getConfigValue('Alert_Email_1');
  const alertEmail2 = getConfigValue('Alert_Email_2');
  const recipients = [alertEmail1, alertEmail2].filter(e => e).join(',');
  
  if (!recipients) {
    Logger.log('No alert email recipients configured.');
    return;
  }

  for (const machine in anomaliesByMachine) {
    const anomalies = anomaliesByMachine[machine];
    const subject = `[AIM ALERT] ${machine} — ${anomalies.length} Anomaly Detected`;
    const htmlBody = buildAlertEmailHtml(machine, anomalies, headers, ss.getUrl());
    
    GmailApp.sendEmail(recipients, subject, '', { htmlBody: htmlBody });
  }

  // Mark alerts as sent
  const now = new Date();
  unalertedRows.forEach(rowIndex => {
    anomalyLogSheet.getRange(rowIndex, alertSentColIndex + 1).setValue(now.toISOString());
  });
}

function buildAlertEmailHtml(machine, anomalies, headers, spreadsheetUrl) {
  let tableRows = '';
  const sensorNameIdx = headers.indexOf('SensorName');
  const anomalyTypeIdx = headers.indexOf('AnomalyType');
  const valueIdx = headers.indexOf('Value');
  const thresholdIdx = headers.indexOf('Threshold');
  const riskScoreIdx = headers.indexOf('RiskScore');
  const timestampIdx = headers.indexOf('Timestamp');

  anomalies.forEach(anomaly => {
    const riskScore = anomaly[riskScoreIdx];
    let color = '#77dd77'; // green
    if (riskScore >= 0.8) {
      color = '#ff6961'; // red
    } else if (riskScore >= 0.5) {
      color = '#fdfd96'; // yellow
    }
    
    tableRows += `
      <tr>
        <td>${anomaly[sensorNameIdx]}</td>
        <td>${anomaly[anomalyTypeIdx]}</td>
        <td>${typeof anomaly[valueIdx] === 'number' ? anomaly[valueIdx].toFixed(3) : anomaly[valueIdx]}</td>
        <td>${anomaly[thresholdIdx]}</td>
        <td style="background-color: ${color};">${riskScore.toFixed(3)}</td>
        <td>${new Date(anomaly[timestampIdx]).toLocaleString()}</td>
      </tr>
    `;
  });

  return `
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h2>Anomaly Alert for ${machine}</h2>
        <p>The following anomalies were detected:</p>
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
          <thead>
            <tr>
              <th>Sensor/System</th>
              <th>Anomaly Type</th>
              <th>Value</th>
              <th>Threshold</th>
              <th>Risk Score</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <p>View full dashboard: <a href="${spreadsheetUrl}">${spreadsheetUrl}</a></p>
      </body>
    </html>
  `;
}

function sendDailyReport() {
      markFlowHandlerStart_('sendDailyReport');
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const machines = ['EM1', 'EM2', 'EM3', 'EM4'];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0));
    const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999));

    const downtimeLog = ss.getSheetByName('DowntimeLog').getDataRange().getValues().slice(1);
    const alarmLog = ss.getSheetByName('AlarmLog').getDataRange().getValues().slice(1);
    const anomalyLog = ss.getSheetByName('AnomalyLog').getDataRange().getValues().slice(1);
    const rawData = ss.getSheetByName('RawData').getDataRange().getValues().slice(1);
    const machineSummary = ss.getSheetByName('MachineSummary').getDataRange().getValues().slice(1);
    
    const summaryData = {};

    for (const machine of machines) {
        const filterByMachineAndDate = (row) => row[1] === machine && new Date(row[0]) >= yesterdayStart && new Date(row[0]) <= yesterdayEnd;
        
        const machineDowntime = downtimeLog.filter(filterByMachineAndDate);
        const totalDowntime = machineDowntime.reduce((sum, row) => sum + (row[4] || 0), 0);

        const machineAlarms = alarmLog.filter(filterByMachineAndDate);
        const totalAlarms = machineAlarms.length;

        const machineAnomalies = anomalyLog.filter(filterByMachineAndDate);
        const totalAnomalies = machineAnomalies.length;
        
        const machineRawData = rawData.filter(filterByMachineAndDate);
        const cycleTimes = machineRawData.map(r => r[3]).filter(t => t);
        const avgCycleTime = cycleTimes.length > 0 ? cycleTimes.reduce((sum, t) => sum + t, 0) / cycleTimes.length : 0;

        const summaryRow = machineSummary.find(r => r[0] === machine);
        const anomalyFlag = summaryRow ? summaryRow[8] : false;

        summaryData[machine] = {
            totalDowntime,
            totalAlarms,
            totalAnomalies,
            avgCycleTime,
            anomalyFlag
        };
    }

    const alertEmail1 = getConfigValue('Alert_Email_1');
    const alertEmail2 = getConfigValue('Alert_Email_2');
      const recipients = [alertEmail1, alertEmail2].filter(e => e).join(',');
      
      if (!recipients) {
          Logger.log('No daily report email recipients configured.');
          markFlowHandlerError_('sendDailyReport', new Error('No daily report email recipients configured.'));
          return;
      }

    const subject = `[AIM Daily Report] - ${yesterday.toLocaleDateString()}`;
    const htmlBody = buildDailyReportHtml(summaryData, yesterday.toLocaleDateString(), ss.getUrl());

      GmailApp.sendEmail(recipients, subject, '', { htmlBody });
      markFlowHandlerSuccess_('sendDailyReport', {
          recipients: recipients
      });
  }

function buildDailyReportHtml(summaryData, dateStr, spreadsheetUrl) {
    let tableHeaders = '';
    let downtimeRow = '<td>Total Downtime (min)</td>';
    let alarmsRow = '<td>Total Alarms</td>';
    let anomaliesRow = '<td>Total Anomalies</td>';
    let cycleTimeRow = '<td>Avg Cycle Time (sec)</td>';

    for (const machine in summaryData) {
        const data = summaryData[machine];
        const headerStyle = data.anomalyFlag ? 'style="background-color: #ff6961;"' : '';
        tableHeaders += `<th ${headerStyle}>${machine}</th>`;
        downtimeRow += `<td ${headerStyle}>${data.totalDowntime.toFixed(2)}</td>`;
        alarmsRow += `<td ${headerStyle}>${data.totalAlarms}</td>`;
        anomaliesRow += `<td ${headerStyle}>${data.totalAnomalies}</td>`;
        cycleTimeRow += `<td ${headerStyle}>${data.avgCycleTime.toFixed(2)}</td>`;
    }

    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Daily Machine Summary - ${dateStr}</h2>
          <p>Machines with an active anomaly flag are highlighted in red.</p>
          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; text-align: center;">
            <thead>
              <tr>
                <th>Metric</th>
                ${tableHeaders}
              </tr>
            </thead>
            <tbody>
              <tr>${downtimeRow}</tr>
              <tr>${alarmsRow}</tr>
              <tr>${anomaliesRow}</tr>
              <tr>${cycleTimeRow}</tr>
            </tbody>
          </table>
          <p>View full dashboard: <a href="${spreadsheetUrl}">${spreadsheetUrl}</a></p>
        </body>
      </html>
    `;
}

function setupDailyReportTrigger() {
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of existingTriggers) {
    if (trigger.getHandlerFunction() === 'sendDailyReport') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  const reportHour = getConfigValue('DailyReport_Hour') || 8;
  ScriptApp.newTrigger('sendDailyReport')
      .timeBased()
      .atHour(reportHour)
      .everyDays(1)
      .create();
  markFlowSetupRun_('setupDailyReportTrigger', 'sendDailyReport', {
    schedule: 'daily at ' + reportHour + ':00'
  });
  Logger.log(`Daily report trigger created to run every day at ${reportHour}:00.`);
}
