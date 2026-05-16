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

/**
 * Audits the AIM Monitoring System workbook against the structure defined in GEMINI.md
 * and checks live machine health from the latest rows in the operational sheets.
 */
function runAIMHealthCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const issues = [];
  const machineStatuses = [];
  const now = new Date();

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
    if (!AIM_REQUIRED_SHEETS[sheetName] && sheetName !== 'HealthCheck') {
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
      if (ageMin > noSignalTimeoutMin) {
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
  const rank = { healthy: 0, warning: 1, critical: 2 };
  return rank[next] > rank[current] ? next : current;
}
