const AIM_REQUIRED_SHEETS = {
  RawData: ['Timestamp', 'Machine', 'Status', 'CycleTime_sec', 'AlarmCode', 'AlarmMessage', 'RejectCount', 'Notes'],
  SensorData: ['Timestamp', 'Machine', 'SensorID', 'SensorName', 'SensorType', 'Value', 'Unit', 'Status'],
  SensorConfig: ['SensorID', 'Machine', 'SensorName', 'SensorType', 'Unit', 'WarnThreshold', 'CriticalThreshold', 'Direction', 'Active'],
  AlarmLog: ['Timestamp', 'Machine', 'AlarmCode', 'AlarmMessage', 'ResolvedAt', 'Duration_min', 'ResolvedBy'],
  DowntimeLog: ['Timestamp', 'Machine', 'DowntimeStart', 'DowntimeEnd', 'Duration_min', 'Reason', 'ResolvedBy'],
  AnomalyLog: ['Timestamp', 'Machine', 'SensorID', 'SensorName', 'AnomalyType', 'Description', 'Value', 'Threshold', 'RiskScore', 'AlertSent', 'EngineerFeedback'],
  MachineSummary: ['Machine', 'LastUpdated', 'Status', 'CycleTime_sec', 'LastAlarm', 'TodayDowntime_min', 'TodayRejectCount', 'ActiveAnomalyCount', 'AnomalyFlag'],
  Config: ['Parameter', 'Value']
};

const AIM_REQUIRED_CONFIG_PARAMS = [
  'CycleTime_Warning_sec',
  'CycleTime_Critical_sec',
  'AlarmRepeat_Threshold',
  'AlarmRepeat_Window_min',
  'MaxDowntime_min',
  'NoSignal_Timeout_min',
  'SensorDrift_Percent',
  'IForest_WindowSize',
  'IForest_Contamination',
  'IForest_WarningScore',
  'IForest_CriticalScore',
  'Weight_Temperature',
  'Weight_Pressure',
  'Weight_Current',
  'Weight_Vibration',
  'Weight_Speed',
  'Weight_CycleTime',
  'Weight_AlarmFrequency',
  'Weight_Downtime',
  'Weight_RejectRate',
  'DataRetention_days',
  'Alert_Email_1',
  'Alert_Email_2',
  'DailyReport_Hour'
];

const AIM_EXPECTED_MACHINES = ['EM1', 'EM2', 'EM3', 'EM4'];
const AIM_EXPECTED_SENSOR_IDS = [
  'EM1_TEMP_01', 'EM1_TEMP_02', 'EM1_PRES_01', 'EM1_CURR_01', 'EM1_VIBR_01', 'EM1_SPED_01', 'EM1_POSN_01',
  'EM2_LASR_01', 'EM2_TEMP_01', 'EM2_CURR_01', 'EM2_VIBR_01', 'EM2_SPED_01', 'EM2_VISN_01', 'EM2_REJT_01',
  'EM3_TEMP_01', 'EM3_PRES_01', 'EM3_CURR_01', 'EM3_VIBR_01', 'EM3_SPED_01', 'EM3_FORC_01', 'EM3_POSN_01',
  'EM4_VISN_01', 'EM4_LASR_01', 'EM4_CURR_01', 'EM4_VIBR_01', 'EM4_SPED_01', 'EM4_MARK_01', 'EM4_REJT_01'
];

const AIM_MAINTAINED_SHEETS = ['HealthCheck', 'Instructions'];

/**
 * Audits the AIM Monitoring System workbook against the structure defined in GEMINI.md
 * and checks live machine health from the latest rows in the operational sheets.
 */
function runAIMHealthCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const issues = [];
  const machineStatuses = [];
  const now = new Date();

  syncProjectInstructionsSheet_(ss, now);

  validateWorkbookStructure_(ss, issues);
  validateConfig_(ss, issues);
  validateMachineSummarySetup_(ss, issues);
  validateSensorCatalog_(ss, issues);

  if (hasCoreHealthSheets_(ss)) {
    machineStatuses.push.apply(machineStatuses, evaluateMachineHealth_(ss, issues, now));
  }

  const overallStatus = calculateOverallHealth_(issues, machineStatuses);
  writeHealthReport_(ss, overallStatus, issues, machineStatuses, now);

  Logger.log(JSON.stringify({
    overallStatus: overallStatus,
    issueCount: issues.length,
    machineStatuses: machineStatuses
  }));

  return {
    checkedAt: now,
    overallStatus: overallStatus,
    issues: issues,
    machineStatuses: machineStatuses
  };
}

function validateWorkbookStructure_(ss, issues) {
  const actualSheetNames = ss.getSheets().map(function(sheet) {
    return sheet.getName();
  });

  Object.keys(AIM_REQUIRED_SHEETS).forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      issues.push(makeIssue_('critical', 'Workbook', sheetName, 'MissingSheet', 'Required sheet is missing.'));
      return;
    }

    const actualHeaders = getSheetHeaders_(sheet);
    const expectedHeaders = AIM_REQUIRED_SHEETS[sheetName];
    if (!arraysEqual_(actualHeaders, expectedHeaders)) {
      issues.push(makeIssue_(
        'critical',
        'Workbook',
        sheetName,
        'HeaderMismatch',
        'Header row does not match GEMINI.md specification.'
      ));
    }
  });

  actualSheetNames.forEach(function(sheetName) {
    if (!AIM_REQUIRED_SHEETS[sheetName] && AIM_MAINTAINED_SHEETS.indexOf(sheetName) === -1) {
      issues.push(makeIssue_('warning', 'Workbook', sheetName, 'UnexpectedSheet', 'Extra sheet found; review whether it is still needed.'));
    }
  });
}

function validateConfig_(ss, issues) {
  const sheet = ss.getSheetByName('Config');
  if (!sheet) {
    return;
  }

  const rows = getBodyValues_(sheet, 2);
  const configMap = {};
  rows.forEach(function(row) {
    if (row[0]) {
      configMap[row[0]] = row[1];
    }
  });

  AIM_REQUIRED_CONFIG_PARAMS.forEach(function(param) {
    if (configMap[param] === '' || configMap[param] === null || configMap[param] === undefined) {
      issues.push(makeIssue_('critical', 'Config', param, 'MissingConfig', 'Required configuration parameter is missing or empty.'));
    }
  });

  const missingParams = AIM_REQUIRED_CONFIG_PARAMS.filter(function(param) {
    return configMap[param] === '' || configMap[param] === null || configMap[param] === undefined;
  });

  if (missingParams.length > 0) {
    issues.push(makeIssue_(
      'warning',
      'Config',
      'Summary',
      'MissingConfigSummary',
      'Missing config parameters: ' + missingParams.join(', ')
    ));
  }
}

function validateMachineSummarySetup_(ss, issues) {
  const sheet = ss.getSheetByName('MachineSummary');
  if (!sheet) {
    return;
  }

  const machineRows = getBodyValues_(sheet, 1)
    .map(function(row) { return row[0]; })
    .filter(String);

  AIM_EXPECTED_MACHINES.forEach(function(machine) {
    if (machineRows.indexOf(machine) === -1) {
      issues.push(makeIssue_('critical', machine, 'MachineSummary', 'MissingMachine', 'Machine row is missing from MachineSummary.'));
    }
  });
}

function validateSensorCatalog_(ss, issues) {
  const sheet = ss.getSheetByName('SensorConfig');
  if (!sheet) {
    return;
  }

  const data = sheet.getDataRange().getValues().slice(1);
  const sensorIds = data.map(function(row) { return row[0]; });

  AIM_EXPECTED_SENSOR_IDS.forEach(function(sensorId) {
    if (sensorIds.indexOf(sensorId) === -1) {
      issues.push(makeIssue_('critical', 'SensorConfig', sensorId, 'MissingSensorConfig', 'Expected sensor definition is missing.'));
    }
  });
}

function hasCoreHealthSheets_(ss) {
  return !!(
    ss.getSheetByName('MachineSummary') &&
    ss.getSheetByName('RawData') &&
    ss.getSheetByName('SensorData') &&
    ss.getSheetByName('AnomalyLog')
  );
}

function evaluateMachineHealth_(ss, issues, now) {
  const summaryRows = getRowsAsObjects_(ss.getSheetByName('MachineSummary'));
  const rawRows = getRowsAsObjects_(ss.getSheetByName('RawData'));
  const sensorRows = getRowsAsObjects_(ss.getSheetByName('SensorData'));
  const anomalyRows = getRowsAsObjects_(ss.getSheetByName('AnomalyLog'));
  const noSignalTimeoutMin = Number(getConfigValue('NoSignal_Timeout_min') || 5);
  const staleDataHours = 24;
  const cycleWarn = Number(getConfigValue('CycleTime_Warning_sec') || 5.5);
  const cycleCritical = Number(getConfigValue('CycleTime_Critical_sec') || 7.0);
  const activeWindowStart = new Date(now.getTime() - 10 * 60 * 1000);

  return AIM_EXPECTED_MACHINES.map(function(machine) {
    const summary = findLatestRowForMachine_(summaryRows, machine, 'LastUpdated');
    const latestRaw = findLatestRowForMachine_(rawRows, machine, 'Timestamp');
    const latestSensors = findLatestSensorRowsForMachine_(sensorRows, machine);
    const activeAnomalies = anomalyRows.filter(function(row) {
      return row.Machine === machine && asDate_(row.Timestamp) >= activeWindowStart;
    });

    let severity = 'healthy';
    const reasons = [];

    if (!summary || !summary.LastUpdated) {
      severity = 'critical';
      reasons.push('No MachineSummary update found.');
      issues.push(makeIssue_('critical', machine, 'MachineSummary', 'NoSummaryData', 'No LastUpdated value found for machine.'));
    } else {
      const ageMin = minutesBetween_(now, asDate_(summary.LastUpdated));
      if (ageMin > staleDataHours * 60) {
        severity = maxSeverity_(severity, 'stale');
        reasons.push('Data is stale.');
        issues.push(makeIssue_('warning', machine, 'MachineSummary', 'StaleData', 'LastUpdated is more than 24 hours old.'));
      } else if (ageMin > noSignalTimeoutMin) {
        severity = 'critical';
        reasons.push('No recent signal.');
        issues.push(makeIssue_('critical', machine, 'MachineSummary', 'NoSignal', 'LastUpdated exceeded NoSignal_Timeout_min.'));
      }
    }

    if (latestRaw) {
      const cycleTime = Number(latestRaw.CycleTime_sec || 0);
      if (cycleTime > cycleCritical) {
        severity = maxSeverity_(severity, 'critical');
        reasons.push('Cycle time is critical.');
      } else if (cycleTime > cycleWarn) {
        severity = maxSeverity_(severity, 'warning');
        reasons.push('Cycle time is above warning threshold.');
      }

      if (latestRaw.Status === 'alarm' || latestRaw.Status === 'stopped') {
        severity = maxSeverity_(severity, 'critical');
        reasons.push('Machine status is ' + latestRaw.Status + '.');
      } else if (latestRaw.Status === 'idle') {
        severity = maxSeverity_(severity, 'warning');
        reasons.push('Machine is idle.');
      }
    } else {
      severity = maxSeverity_(severity, 'critical');
      reasons.push('No RawData record found.');
      issues.push(makeIssue_('critical', machine, 'RawData', 'NoRawData', 'No RawData record found for machine.'));
    }

    const warningSensors = latestSensors.filter(function(row) { return row.Status === 'warning'; }).length;
    const criticalSensors = latestSensors.filter(function(row) { return row.Status === 'critical'; }).length;
    if (criticalSensors > 0) {
      severity = maxSeverity_(severity, 'critical');
      reasons.push(criticalSensors + ' critical sensor(s).');
    } else if (warningSensors > 0) {
      severity = maxSeverity_(severity, 'warning');
      reasons.push(warningSensors + ' warning sensor(s).');
    }

    if (activeAnomalies.length > 0) {
      const hasCriticalAnomaly = activeAnomalies.some(function(row) {
        return String(row.AnomalyType).indexOf('Critical') !== -1 || Number(row.RiskScore || 0) >= 0.8;
      });
      severity = maxSeverity_(severity, hasCriticalAnomaly ? 'critical' : 'warning');
      reasons.push(activeAnomalies.length + ' active anomaly log entr' + (activeAnomalies.length === 1 ? 'y' : 'ies') + '.');
    }

    if (reasons.length === 0) {
      reasons.push('No immediate health issues detected.');
    }

    return {
      machine: machine,
      status: severity,
      lastUpdated: summary ? summary.LastUpdated : '',
      machineState: latestRaw ? latestRaw.Status : '',
      cycleTime: latestRaw ? latestRaw.CycleTime_sec : '',
      warningSensors: warningSensors,
      criticalSensors: criticalSensors,
      activeAnomalies: activeAnomalies.length,
      notes: reasons.join(' ')
    };
  });
}

function writeHealthReport_(ss, overallStatus, issues, machineStatuses, checkedAt) {
  const sheet = ss.getSheetByName('HealthCheck') || ss.insertSheet('HealthCheck');
  sheet.clearContents();

  const summaryRows = [
    ['CheckedAt', checkedAt],
    ['OverallStatus', overallStatus],
    ['IssueCount', issues.length],
    ['HealthyMachines', machineStatuses.filter(function(item) { return item.status === 'healthy'; }).length],
    ['WarningMachines', machineStatuses.filter(function(item) { return item.status === 'warning'; }).length],
    ['StaleMachines', machineStatuses.filter(function(item) { return item.status === 'stale'; }).length],
    ['CriticalMachines', machineStatuses.filter(function(item) { return item.status === 'critical'; }).length]
  ];

  sheet.getRange(1, 1, summaryRows.length, 2).setValues(summaryRows);
  sheet.getRange(8, 1, 1, 9).setValues([[
    'Machine',
    'Status',
    'LastUpdated',
    'MachineState',
    'CycleTime_sec',
    'WarningSensors',
    'CriticalSensors',
    'ActiveAnomalies',
    'Notes'
  ]]);

  if (machineStatuses.length > 0) {
    const machineRows = machineStatuses.map(function(item) {
      return [
        item.machine,
        item.status,
        item.lastUpdated,
        item.machineState,
        item.cycleTime,
        item.warningSensors,
        item.criticalSensors,
        item.activeAnomalies,
        item.notes
      ];
    });
    sheet.getRange(9, 1, machineRows.length, machineRows[0].length).setValues(machineRows);
  }

  sheet.getRange(15, 1, 1, 5).setValues([['Severity', 'Machine', 'Area', 'Code', 'Message']]);
  if (issues.length > 0) {
    const issueRows = issues.map(function(issue) {
      return [issue.severity, issue.machine, issue.area, issue.code, issue.message];
    });
    sheet.getRange(16, 1, issueRows.length, issueRows[0].length).setValues(issueRows);
  } else {
    sheet.getRange(16, 1).setValue('No issues detected.');
  }

  sheet.autoResizeColumns(1, 9);
}

function syncProjectInstructionsSheet_(ss, updatedAt) {
  const sheet = ss.getSheetByName('Instructions') || ss.insertSheet('Instructions');
  sheet.clearContents();

  const summaryRows = [
    ['AIM Monitoring System Instructions'],
    ['LastUpdated', updatedAt],
    ['Purpose', 'Maintained operating guide for all Google Apps Script files and workbook setup.'],
    ['HowToUse', 'Read the steps from top to bottom. Re-run runAIMHealthCheck() whenever you want this sheet refreshed.']
  ];

  sheet.getRange(1, 1, summaryRows.length, 2).setValues(padInstructionSummaryRows_(summaryRows));

  const headers = [['Step', 'Area', 'FileOrFunction', 'Action', 'Details', 'StatusHint']];
  sheet.getRange(7, 1, 1, headers[0].length).setValues(headers);

  const rows = buildInstructionRows_(ss);
  if (rows.length > 0) {
    sheet.getRange(8, 1, rows.length, rows[0].length).setValues(rows);
  }

  sheet.setFrozenRows(7);
  sheet.autoResizeColumns(1, 6);
}

function buildInstructionRows_(ss) {
  const hasAllCoreSheets = Object.keys(AIM_REQUIRED_SHEETS).every(function(name) {
    return !!ss.getSheetByName(name);
  });
  const hasConfig = !!ss.getSheetByName('Config');
  const configStatus = hasConfig ? 'Check Config tab values before running triggers.' : 'Config tab missing.';
  const simulatorStatus = ss.getSheetByName('RawData') && ss.getSheetByName('RawData').getLastRow() > 1
    ? 'Historical or live data already exists.'
    : 'No machine data found yet.';

  return [
    ['1', 'Workbook', 'GEMINI.md / spreadsheet tabs', 'Verify workbook structure', 'Make sure RawData, SensorData, SensorConfig, AlarmLog, DowntimeLog, AnomalyLog, MachineSummary, and Config exist with the expected headers.', hasAllCoreSheets ? 'Core sheets present.' : 'Some required sheets are missing.'],
    ['2', 'Receiver', 'receiver.gs / doPost(e)', 'Receive machine payloads', 'Deploy the Apps Script project as a Web App. External PLC or gateway payloads should POST machine data into RawData, SensorData, AlarmLog, and MachineSummary.', 'Use when real machine data or external simulator is available.'],
    ['3', 'Anomaly Engine', 'anomaly.gs / runAnomalyCheck()', 'Run rule-based and AI-style anomaly detection', 'This checks warning and critical sensors, cycle time, repeated alarms, no-signal conditions, and the modified isolation-forest-inspired score.', 'Set up the 1-minute trigger with setupAnomalyTrigger().'],
    ['4', 'Alerts', 'alerts.gs / sendAlerts()', 'Send anomaly emails', 'Unsent anomalies in AnomalyLog are grouped by machine and emailed to recipients from Config.', configStatus],
    ['5', 'Daily Report', 'alerts.gs / sendDailyReport()', 'Send daily summary email', 'Builds the prior-day summary using DowntimeLog, AlarmLog, AnomalyLog, RawData, and MachineSummary.', 'Set up the daily trigger with setupDailyReportTrigger().'],
    ['6', 'Cleanup', 'maintenance.gs / cleanOldData()', 'Clean old operational data', 'Deletes old rows only from RawData and SensorData based on DataRetention_days, while keeping alarm, downtime, and anomaly history.', 'Set up the weekly trigger with setupCleanupTrigger().'],
    ['7', 'Simulator', 'simulator.gs / seedHistoricalData()', 'Seed history for dashboard charts', 'Run once to create 7 days of sample history before starting the live simulator.', simulatorStatus],
    ['8', 'Simulator', 'simulator.gs / startSimulator()', 'Start live demo data', 'Creates a 1-minute trigger that simulates EM1 to EM4 activity and then runs the anomaly engine.', 'Stop it with stopSimulator() when you no longer need demo data.'],
    ['9', 'Dashboard', 'dashboard.gs / doGet(e)', 'Serve dashboard page and data API', 'Hosts dashboard_.html and returns JSON for overview, sensors, anomalies, downtime, alarms, and cycle time.', 'Deploy as Web App if you want browser access.'],
    ['10', 'Health Audit', 'health.gs / runAIMHealthCheck()', 'Refresh health and instruction sheets', 'Validates workbook structure, config completeness, machine freshness, and current machine condition. It also refreshes this Instructions sheet.', 'Run anytime after major changes or before presentations.'],
    ['11', 'Recommended Order', 'Manual run order', 'Use the project end-to-end', 'Suggested sequence: verify workbook, fill Config, deploy Web App, run setupAnomalyTrigger, setupDailyReportTrigger, setupCleanupTrigger, seedHistoricalData, startSimulator, then run runAIMHealthCheck.', 'This is the fastest full prototype setup path.']
  ];
}

function padInstructionSummaryRows_(rows) {
  return rows.map(function(row) {
    return row.length === 1 ? [row[0], ''] : row;
  });
}

function getSheetHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    return [];
  }
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getBodyValues_(sheet, columnCount) {
  const rowCount = sheet.getLastRow() - 1;
  if (rowCount <= 0) {
    return [];
  }
  return sheet.getRange(2, 1, rowCount, columnCount).getValues();
}

function getRowsAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const headers = values[0];
  return values.slice(1).map(function(row) {
    const item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

function findLatestRowForMachine_(rows, machine, dateField) {
  return rows
    .filter(function(row) {
      return row.Machine === machine && row[dateField];
    })
    .sort(function(a, b) {
      return asDate_(b[dateField]) - asDate_(a[dateField]);
    })[0] || null;
}

function findLatestSensorRowsForMachine_(sensorRows, machine) {
  const latestBySensor = {};
  sensorRows.forEach(function(row) {
    if (row.Machine !== machine || !row.Timestamp || !row.SensorID) {
      return;
    }
    const current = latestBySensor[row.SensorID];
    if (!current || asDate_(row.Timestamp) > asDate_(current.Timestamp)) {
      latestBySensor[row.SensorID] = row;
    }
  });
  return Object.keys(latestBySensor).map(function(sensorId) {
    return latestBySensor[sensorId];
  });
}

function calculateOverallHealth_(issues, machineStatuses) {
  if (issues.some(function(issue) { return issue.severity === 'critical'; })) {
    return 'critical';
  }
  if (machineStatuses.some(function(item) { return item.status === 'critical'; })) {
    return 'critical';
  }
  if (machineStatuses.some(function(item) { return item.status === 'stale'; })) {
    return 'stale';
  }
  if (issues.some(function(issue) { return issue.severity === 'warning'; })) {
    return 'warning';
  }
  if (machineStatuses.some(function(item) { return item.status === 'warning'; })) {
    return 'warning';
  }
  return 'healthy';
}

function makeIssue_(severity, machine, area, code, message) {
  return {
    severity: severity,
    machine: machine,
    area: area,
    code: code,
    message: message
  };
}

function arraysEqual_(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (var i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

function asDate_(value) {
  return value instanceof Date ? value : new Date(value);
}

function minutesBetween_(later, earlier) {
  return (later.getTime() - earlier.getTime()) / 60000;
}

function maxSeverity_(current, next) {
  const rank = { healthy: 0, stale: 1, warning: 2, critical: 3 };
  return rank[next] > rank[current] ? next : current;
}
