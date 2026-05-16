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

const AIM_MAINTAINED_SHEETS = ['HealthCheck', 'Instructions', 'ScriptHealth'];

const AIM_SCRIPT_HEALTH_SPECS = [
  {
    file: 'receiver.gs',
    label: 'Receiver API',
    category: 'api',
    functions: ['doPost', 'testDoPost', 'getConfigValue'],
    requiredSheets: ['RawData', 'SensorData', 'SensorConfig', 'AlarmLog', 'MachineSummary'],
    triggerHandlers: [],
    requiredConfig: []
  },
  {
    file: 'simulator.gs',
    label: 'Simulator',
    category: 'simulation',
    functions: ['runSimulator', 'seedHistoricalData', 'startSimulator', 'stopSimulator', 'resetSimulatorState'],
    requiredSheets: ['RawData', 'SensorData', 'AlarmLog', 'DowntimeLog', 'MachineSummary', 'SensorConfig'],
    triggerHandlers: ['runSimulator'],
    requiredConfig: []
  },
  {
    file: 'anomaly.gs',
    label: 'Anomaly Engine',
    category: 'analytics',
    functions: ['runAnomalyCheck', 'buildFeatureVector', 'calculateRiskScore', 'preventDuplicates', 'updateMachineSummary', 'getSensorConfig', 'setupAnomalyTrigger'],
    requiredSheets: ['AnomalyLog', 'SensorData', 'RawData', 'AlarmLog', 'DowntimeLog', 'MachineSummary', 'SensorConfig'],
    triggerHandlers: ['runAnomalyCheck'],
    requiredConfig: ['IForest_WindowSize', 'IForest_WarningScore', 'IForest_CriticalScore', 'AlarmRepeat_Threshold', 'AlarmRepeat_Window_min', 'NoSignal_Timeout_min']
  },
  {
    file: 'alerts.gs',
    label: 'Alerts and Reporting',
    category: 'notification',
    functions: ['sendAlerts', 'buildAlertEmailHtml', 'sendDailyReport', 'buildDailyReportHtml', 'setupDailyReportTrigger'],
    requiredSheets: ['AnomalyLog', 'DowntimeLog', 'AlarmLog', 'RawData', 'MachineSummary'],
    triggerHandlers: ['sendDailyReport'],
    requiredConfig: ['Alert_Email_1', 'Alert_Email_2', 'DailyReport_Hour']
  },
  {
    file: 'maintenance.gs',
    label: 'Retention Cleanup',
    category: 'maintenance',
    functions: ['cleanOldData', 'setupCleanupTrigger'],
    requiredSheets: ['RawData', 'SensorData'],
    triggerHandlers: ['cleanOldData'],
    requiredConfig: ['DataRetention_days']
  },
  {
    file: 'dashboard.gs',
    label: 'Dashboard Web App',
    category: 'dashboard',
    functions: ['doGet', 'handleDataRequest', 'getSheetDataAsJson_', 'getDashboardMeta_', 'getAIMSpreadsheet_'],
    requiredSheets: ['MachineSummary', 'SensorData', 'AnomalyLog', 'DowntimeLog', 'AlarmLog', 'RawData'],
    triggerHandlers: [],
    requiredConfig: []
  },
  {
    file: 'health.gs',
    label: 'Health Audit',
    category: 'health',
    functions: ['runAIMHealthCheck', 'runAIMScriptHealthCheck', 'runFullAIMHealthAudit'],
    requiredSheets: [],
    triggerHandlers: [],
    requiredConfig: []
  }
];

const AIM_TRIGGER_FLOW = [
  {
    setupFunction: 'startSimulator',
    handler: 'runSimulator',
    label: 'Live simulation updates',
    required: false,
    dependsOn: ['seedHistoricalData']
  },
  {
    setupFunction: 'setupAnomalyTrigger',
    handler: 'runAnomalyCheck',
    label: 'Anomaly detection cycle',
    required: true,
    dependsOn: []
  },
  {
    setupFunction: 'setupDailyReportTrigger',
    handler: 'sendDailyReport',
    label: 'Daily summary reporting',
    required: true,
    dependsOn: ['Alert_Email_1', 'Alert_Email_2']
  },
  {
    setupFunction: 'setupCleanupTrigger',
    handler: 'cleanOldData',
    label: 'Retention cleanup',
    required: true,
    dependsOn: ['DataRetention_days']
  }
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

  logHealthDebug_('WORKBOOK', 'Starting workbook health audit.', {
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    checkedAt: now.toISOString()
  });

  syncProjectInstructionsSheet_(ss, now);
  logHealthDebug_('WORKBOOK', 'Instructions sheet refreshed.');

  validateWorkbookStructure_(ss, issues);
  logHealthDebug_('WORKBOOK', 'Workbook structure validation finished.', {
    issueCountAfterStep: issues.length
  });
  validateConfig_(ss, issues);
  logHealthDebug_('WORKBOOK', 'Config validation finished.', {
    issueCountAfterStep: issues.length
  });
  validateMachineSummarySetup_(ss, issues);
  logHealthDebug_('WORKBOOK', 'MachineSummary validation finished.', {
    issueCountAfterStep: issues.length
  });
  validateSensorCatalog_(ss, issues);
  logHealthDebug_('WORKBOOK', 'Sensor catalog validation finished.', {
    issueCountAfterStep: issues.length
  });

  if (hasCoreHealthSheets_(ss)) {
    logHealthDebug_('WORKBOOK', 'Core health sheets found. Evaluating machine health.');
    machineStatuses.push.apply(machineStatuses, evaluateMachineHealth_(ss, issues, now));
  } else {
    logHealthDebug_('WORKBOOK', 'Skipped machine health evaluation because one or more core sheets are missing.');
  }

  const overallStatus = calculateOverallHealth_(issues, machineStatuses);
  writeHealthReport_(ss, overallStatus, issues, machineStatuses, now);
  logHealthDebug_('WORKBOOK', 'Workbook health audit completed.', {
    overallStatus: overallStatus,
    issueCount: issues.length,
    machineStatuses: machineStatuses.length
  });

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

function runAIMScriptHealthCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const checkedAt = new Date();
  const triggers = ScriptApp.getProjectTriggers();
  const triggerHandlers = triggers.map(function(trigger) {
    return trigger.getHandlerFunction();
  });
  const triggerDetails = describeProjectTriggers_(triggers);
  const configSnapshot = buildScriptHealthConfigSnapshot_();
  const flowSummary = buildTriggerFlowSummary_(triggerHandlers, configSnapshot);

  logHealthDebug_('SCRIPT', 'Starting script health audit.', {
    checkedAt: checkedAt.toISOString(),
    triggerHandlers: triggerHandlers,
    triggerDetails: triggerDetails,
    configSnapshot: configSnapshot,
    flowSummary: flowSummary
  });

  const results = AIM_SCRIPT_HEALTH_SPECS.map(function(spec) {
    return evaluateScriptHealthSpec_(ss, spec, triggerHandlers);
  });

  writeScriptHealthReport_(ss, checkedAt, results, flowSummary);
  logScriptHealthSummary_(results, triggerDetails, configSnapshot, flowSummary);
  logHealthDebug_('SCRIPT', 'Script health audit completed.', {
    overallStatus: calculateScriptHealthOverallStatus_(results),
    scriptCount: results.length,
    categoryCounts: buildScriptTypeCounts_(results),
    nextRecommendedSetup: flowSummary.nextRecommendedSetup
  });

  return {
    checkedAt: checkedAt,
    overallStatus: calculateScriptHealthOverallStatus_(results),
    results: results,
    flowSummary: flowSummary
  };
}

function runFullAIMHealthAudit() {
  logHealthDebug_('SYSTEM', 'Starting full AIM health audit.');
  const workbookHealth = runAIMHealthCheck();
  const scriptHealth = runAIMScriptHealthCheck();
  logHealthDebug_('SYSTEM', 'Full AIM health audit completed.', {
    workbookStatus: workbookHealth.overallStatus,
    scriptStatus: scriptHealth.overallStatus
  });

  return {
    checkedAt: new Date(),
    workbookHealth: workbookHealth,
    scriptHealth: scriptHealth
  };
}

function validateWorkbookStructure_(ss, issues) {
  const actualSheetNames = ss.getSheets().map(function(sheet) {
    return sheet.getName();
  });

  logHealthDebug_('WORKBOOK', 'Validating workbook structure.', {
    sheetNames: actualSheetNames
  });

  Object.keys(AIM_REQUIRED_SHEETS).forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      logHealthDebug_('WORKBOOK', 'Required sheet missing.', { sheetName: sheetName });
      issues.push(makeIssue_('critical', 'Workbook', sheetName, 'MissingSheet', 'Required sheet is missing.'));
      return;
    }

    const actualHeaders = getSheetHeaders_(sheet);
    const expectedHeaders = AIM_REQUIRED_SHEETS[sheetName];
    if (!arraysEqual_(actualHeaders, expectedHeaders)) {
      logHealthDebug_('WORKBOOK', 'Header mismatch detected.', {
        sheetName: sheetName,
        expectedHeaders: expectedHeaders,
        actualHeaders: actualHeaders
      });
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
      logHealthDebug_('WORKBOOK', 'Unexpected sheet found.', { sheetName: sheetName });
      issues.push(makeIssue_('warning', 'Workbook', sheetName, 'UnexpectedSheet', 'Extra sheet found; review whether it is still needed.'));
    }
  });
}

function validateConfig_(ss, issues) {
  const sheet = ss.getSheetByName('Config');
  if (!sheet) {
    logHealthDebug_('CONFIG', 'Config sheet missing; skipping config validation.');
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
      logHealthDebug_('CONFIG', 'Required config value missing.', { parameter: param });
      issues.push(makeIssue_('critical', 'Config', param, 'MissingConfig', 'Required configuration parameter is missing or empty.'));
    }
  });

  const missingParams = AIM_REQUIRED_CONFIG_PARAMS.filter(function(param) {
    return configMap[param] === '' || configMap[param] === null || configMap[param] === undefined;
  });

  if (missingParams.length > 0) {
    logHealthDebug_('CONFIG', 'Config validation summary includes missing parameters.', {
      missingParams: missingParams
    });
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
    logHealthDebug_('MACHINE_SUMMARY', 'MachineSummary sheet missing; skipping setup validation.');
    return;
  }

  const machineRows = getBodyValues_(sheet, 1)
    .map(function(row) { return row[0]; })
    .filter(String);

  AIM_EXPECTED_MACHINES.forEach(function(machine) {
    if (machineRows.indexOf(machine) === -1) {
      logHealthDebug_('MACHINE_SUMMARY', 'Expected machine row missing.', { machine: machine });
      issues.push(makeIssue_('critical', machine, 'MachineSummary', 'MissingMachine', 'Machine row is missing from MachineSummary.'));
    }
  });
}

function validateSensorCatalog_(ss, issues) {
  const sheet = ss.getSheetByName('SensorConfig');
  if (!sheet) {
    logHealthDebug_('SENSOR_CONFIG', 'SensorConfig sheet missing; skipping catalog validation.');
    return;
  }

  const data = sheet.getDataRange().getValues().slice(1);
  const sensorIds = data.map(function(row) { return row[0]; });

  AIM_EXPECTED_SENSOR_IDS.forEach(function(sensorId) {
    if (sensorIds.indexOf(sensorId) === -1) {
      logHealthDebug_('SENSOR_CONFIG', 'Expected sensor definition missing.', { sensorId: sensorId });
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
      logHealthDebug_('MACHINE', 'No MachineSummary update found.', { machine: machine });
      issues.push(makeIssue_('critical', machine, 'MachineSummary', 'NoSummaryData', 'No LastUpdated value found for machine.'));
    } else {
      const ageMin = minutesBetween_(now, asDate_(summary.LastUpdated));
      if (ageMin > staleDataHours * 60) {
        severity = maxSeverity_(severity, 'stale');
        reasons.push('Data is stale.');
        logHealthDebug_('MACHINE', 'Machine data is stale.', { machine: machine, ageMin: ageMin });
        issues.push(makeIssue_('warning', machine, 'MachineSummary', 'StaleData', 'LastUpdated is more than 24 hours old.'));
      } else if (ageMin > noSignalTimeoutMin) {
        severity = 'critical';
        reasons.push('No recent signal.');
        logHealthDebug_('MACHINE', 'No recent machine signal.', { machine: machine, ageMin: ageMin, timeoutMin: noSignalTimeoutMin });
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
      logHealthDebug_('MACHINE', 'No RawData record found.', { machine: machine });
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

    logHealthDebug_('MACHINE', 'Machine health evaluated.', {
      machine: machine,
      status: severity,
      warningSensors: warningSensors,
      criticalSensors: criticalSensors,
      activeAnomalies: activeAnomalies.length,
      notes: reasons.join(' ')
    });

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
    ['10', 'Health Audit', 'health.gs / runAIMHealthCheck()', 'Refresh workbook health and instruction sheets', 'Validates workbook structure, config completeness, machine freshness, and current machine condition. It also refreshes this Instructions sheet.', 'Run anytime after major changes or before presentations.'],
    ['11', 'Script Audit', 'health.gs / runAIMScriptHealthCheck()', 'Check all Apps Script modules', 'Reviews every .gs module for required functions, sheets, config values, trigger installation, and dashboard spreadsheet access. Writes results to the ScriptHealth sheet.', 'Use when you want a script-by-script readiness report.'],
    ['12', 'Recommended Order', 'Manual run order', 'Use the project end-to-end', 'Suggested sequence: verify workbook, fill Config, deploy Web App, run setupAnomalyTrigger, setupDailyReportTrigger, setupCleanupTrigger, seedHistoricalData, startSimulator, then run runFullAIMHealthAudit.', 'This is the fastest full prototype setup path.']
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

function evaluateScriptHealthSpec_(ss, spec, triggerHandlers) {
  logHealthDebug_('SCRIPT', 'Evaluating script health spec.', {
    file: spec.file,
    label: spec.label,
    category: spec.category
  });
  const missingFunctions = spec.functions.filter(function(name) {
    return typeof globalThis[name] !== 'function';
  });
  const missingSheets = spec.requiredSheets.filter(function(name) {
    return !ss.getSheetByName(name);
  });
  const missingConfig = spec.requiredConfig.filter(function(name) {
    const value = getConfigValue(name);
    return value === '' || value === null || value === undefined;
  });
  const installedTriggers = spec.triggerHandlers.filter(function(name) {
    return triggerHandlers.indexOf(name) !== -1;
  });
  const missingTriggers = spec.triggerHandlers.filter(function(name) {
    return triggerHandlers.indexOf(name) === -1;
  });
  const notes = [];
  let status = 'healthy';

  if (missingFunctions.length > 0 || missingSheets.length > 0 || missingConfig.length > 0) {
    status = 'critical';
  } else if (missingTriggers.length > 0) {
    status = 'warning';
  }

  if (missingFunctions.length > 0) {
    logHealthDebug_('SCRIPT', 'Missing functions detected.', {
      file: spec.file,
      missingFunctions: missingFunctions
    });
    notes.push('Missing functions: ' + missingFunctions.join(', '));
  }
  if (missingSheets.length > 0) {
    logHealthDebug_('SCRIPT', 'Missing sheets detected.', {
      file: spec.file,
      missingSheets: missingSheets
    });
    notes.push('Missing sheets: ' + missingSheets.join(', '));
  }
  if (missingConfig.length > 0) {
    logHealthDebug_('SCRIPT', 'Missing config detected.', {
      file: spec.file,
      missingConfig: missingConfig
    });
    notes.push('Missing config: ' + missingConfig.join(', '));
  }
  if (missingTriggers.length > 0) {
    logHealthDebug_('SCRIPT', 'Missing triggers detected.', {
      file: spec.file,
      missingTriggers: missingTriggers
    });
    notes.push('Trigger not installed: ' + missingTriggers.join(', '));
  }
  if (installedTriggers.length > 0) {
    notes.push('Installed triggers: ' + installedTriggers.join(', '));
  }

  appendScriptSpecificChecks_(ss, spec, notes, function(nextStatus) {
    status = maxSeverity_(status, nextStatus);
  });

  if (notes.length === 0) {
    notes.push('All checks passed.');
  }

  logHealthDebug_('SCRIPT', 'Script health spec evaluated.', {
    file: spec.file,
    status: status,
    installedTriggers: installedTriggers,
    notes: notes
  });

  return {
    file: spec.file,
    label: spec.label,
    category: spec.category,
    status: status,
    functionCount: spec.functions.length,
    missingFunctions: missingFunctions,
    missingSheets: missingSheets,
    missingConfig: missingConfig,
    installedTriggers: installedTriggers,
    missingTriggers: missingTriggers,
    notes: notes.join(' ')
  };
}

function appendScriptSpecificChecks_(ss, spec, notes, setStatus) {
  if (spec.file === 'dashboard.gs') {
    try {
      const dashboardSpreadsheet = getAIMSpreadsheet_();
      notes.push('Dashboard spreadsheet access OK: ' + dashboardSpreadsheet.getName());
      logHealthDebug_('SCRIPT', 'Dashboard spreadsheet access OK.', {
        file: spec.file,
        spreadsheetName: dashboardSpreadsheet.getName()
      });
    } catch (err) {
      setStatus('critical');
      notes.push('Dashboard spreadsheet access failed: ' + err.message);
      logHealthDebug_('SCRIPT', 'Dashboard spreadsheet access failed.', {
        file: spec.file,
        error: err.message
      });
    }
    return;
  }

  if (spec.file === 'receiver.gs') {
    notes.push('Receiver smoke test is not auto-run because testDoPost() writes live rows.');
    logHealthDebug_('SCRIPT', 'Receiver smoke test skipped to avoid writing live rows.');
    return;
  }

  if (spec.file === 'simulator.gs') {
    const stateCounters = AIM_EXPECTED_MACHINES.filter(function(machine) {
      return PropertiesService.getScriptProperties().getProperty(machine + '_stateCounter');
    });
    if (stateCounters.length > 0) {
      notes.push('Simulator state present for: ' + stateCounters.join(', '));
    } else {
      notes.push('Simulator state counters are not set yet.');
    }
    logHealthDebug_('SCRIPT', 'Simulator state inspection complete.', {
      stateCounters: stateCounters
    });
    return;
  }

  if (spec.file === 'alerts.gs') {
    const recipients = [getConfigValue('Alert_Email_1'), getConfigValue('Alert_Email_2')].filter(String);
    if (recipients.length === 0) {
      setStatus('warning');
      notes.push('No alert email recipients configured.');
    } else {
      notes.push('Alert recipients configured: ' + recipients.join(', '));
    }
    logHealthDebug_('SCRIPT', 'Alert recipient inspection complete.', {
      recipients: recipients
    });
    return;
  }

  if (spec.file === 'maintenance.gs') {
    const retentionDays = Number(getConfigValue('DataRetention_days') || 0);
    if (!(retentionDays > 0)) {
      setStatus('critical');
      notes.push('DataRetention_days must be greater than 0.');
    } else {
      notes.push('Retention configured for ' + retentionDays + ' day(s).');
    }
    logHealthDebug_('SCRIPT', 'Maintenance retention inspection complete.', {
      retentionDays: retentionDays
    });
    return;
  }

  if (spec.file === 'anomaly.gs') {
    const anomalySheet = ss.getSheetByName('AnomalyLog');
    if (anomalySheet && anomalySheet.getLastRow() <= 1) {
      setStatus('warning');
      notes.push('AnomalyLog has no data yet; anomaly engine has not produced entries.');
    } else {
      notes.push('Anomaly engine data is present.');
    }
    logHealthDebug_('SCRIPT', 'Anomaly engine data inspection complete.', {
      anomalyRowCount: anomalySheet ? anomalySheet.getLastRow() : 0
    });
    return;
  }
}

function writeScriptHealthReport_(ss, checkedAt, results, flowSummary) {
  const sheet = ss.getSheetByName('ScriptHealth') || ss.insertSheet('ScriptHealth');
  sheet.clearContents();

  const overallStatus = calculateScriptHealthOverallStatus_(results);
  const summaryRows = [
    ['CheckedAt', checkedAt],
    ['OverallStatus', overallStatus],
    ['ScriptCount', results.length],
    ['HealthyScripts', results.filter(function(item) { return item.status === 'healthy'; }).length],
    ['WarningScripts', results.filter(function(item) { return item.status === 'warning'; }).length],
    ['CriticalScripts', results.filter(function(item) { return item.status === 'critical'; }).length]
  ];

  sheet.getRange(1, 1, summaryRows.length, 2).setValues(summaryRows);
  sheet.getRange(8, 1, 1, 9).setValues([[
    'ScriptFile',
    'Label',
    'Status',
    'FunctionCount',
    'MissingFunctions',
    'MissingSheets',
    'MissingConfig',
    'MissingTriggers',
    'Notes'
  ]]);

  if (results.length > 0) {
    const rows = results.map(function(item) {
      return [
        item.file,
        item.label,
        item.status,
        item.functionCount,
        item.missingFunctions.join(', '),
        item.missingSheets.join(', '),
        item.missingConfig.join(', '),
        item.missingTriggers.join(', '),
        item.notes
      ];
    });
    sheet.getRange(9, 1, rows.length, rows[0].length).setValues(rows);
  }

  const flowHeaderRow = results.length > 0 ? 11 + results.length : 11;
  sheet.getRange(flowHeaderRow, 1, 1, 9).setValues([[
    'SetupFunction',
    'Handler',
    'Label',
    'State',
    'Installed',
    'Required',
    'LastSetupAt',
    'LastSuccessAt',
    'Notes'
  ]]);

  if (flowSummary.steps.length > 0) {
    const flowRows = flowSummary.steps.map(function(step) {
      return [
        step.setupFunction,
        step.handler,
        step.label,
        step.state,
        step.installed ? 'Yes' : 'No',
        step.required ? 'Yes' : 'No',
        step.lastSetupAt || '',
        step.lastSuccessAt || '',
        step.notes
      ];
    });
    sheet.getRange(flowHeaderRow + 1, 1, flowRows.length, flowRows[0].length).setValues(flowRows);
  }

  const summaryRow = flowHeaderRow + flowSummary.steps.length + 3;
  sheet.getRange(summaryRow, 1, 3, 2).setValues([
    ['FlowStatus', flowSummary.overallState],
    ['NextRecommendedSetup', flowSummary.nextRecommendedSetup || 'None'],
    ['MissingRequiredHandlers', flowSummary.missingRequiredHandlers.join(', ') || 'None']
  ]);

  sheet.setFrozenRows(8);
  sheet.autoResizeColumns(1, 9);
}

function calculateScriptHealthOverallStatus_(results) {
  if (results.some(function(item) { return item.status === 'critical'; })) {
    return 'critical';
  }
  if (results.some(function(item) { return item.status === 'warning'; })) {
    return 'warning';
  }
  return 'healthy';
}

function describeProjectTriggers_(triggers) {
  return triggers.map(function(trigger) {
    return {
      handler: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      source: String(trigger.getTriggerSource()),
      uniqueId: trigger.getUniqueId ? trigger.getUniqueId() : ''
    };
  });
}

function buildScriptHealthConfigSnapshot_() {
  return {
    DailyReport_Hour: getConfigValue('DailyReport_Hour'),
    DataRetention_days: getConfigValue('DataRetention_days'),
    NoSignal_Timeout_min: getConfigValue('NoSignal_Timeout_min'),
    IForest_WindowSize: getConfigValue('IForest_WindowSize'),
    Alert_Email_1_Configured: !!getConfigValue('Alert_Email_1'),
    Alert_Email_2_Configured: !!getConfigValue('Alert_Email_2')
  };
}

function buildScriptTypeCounts_(results) {
  const counts = {};
  results.forEach(function(result) {
    if (!counts[result.category]) {
      counts[result.category] = {
        total: 0,
        healthy: 0,
        warning: 0,
        critical: 0
      };
    }
    counts[result.category].total++;
    counts[result.category][result.status]++;
  });
  return counts;
}

function logScriptHealthSummary_(results, triggerDetails, configSnapshot, flowSummary) {
  const overallStatus = calculateScriptHealthOverallStatus_(results);
  const healthyCount = results.filter(function(item) { return item.status === 'healthy'; }).length;
  const warningCount = results.filter(function(item) { return item.status === 'warning'; }).length;
  const criticalCount = results.filter(function(item) { return item.status === 'critical'; }).length;
  const categoryCounts = buildScriptTypeCounts_(results);
  const failingScripts = results
    .filter(function(item) { return item.status !== 'healthy'; })
    .map(function(item) {
      return item.file + ' [' + item.status + ']: ' + item.notes;
    });

  logHealthDebug_('SCRIPT_SUMMARY', 'Readable script health summary.', {
    overallStatus: overallStatus,
    healthyCount: healthyCount,
    warningCount: warningCount,
    criticalCount: criticalCount,
    triggerDetails: triggerDetails,
    configSnapshot: configSnapshot,
    categoryCounts: categoryCounts,
    failingScripts: failingScripts.length > 0 ? failingScripts : ['None'],
    flowSummary: flowSummary
  });
}

function buildTriggerFlowSummary_(triggerHandlers, configSnapshot) {
  const steps = AIM_TRIGGER_FLOW.map(function(step) {
    const isInstalled = triggerHandlers.indexOf(step.handler) !== -1;
    const executionState = getFlowExecutionState_(step);
    const missingDeps = (step.dependsOn || []).filter(function(dep) {
      if (dep.indexOf('Alert_Email_') === 0) {
        return !getConfigValue(dep);
      }
      if (dep === 'DataRetention_days') {
        return !(Number(getConfigValue(dep) || 0) > 0);
      }
      if (dep === 'seedHistoricalData') {
        return !hasHistoricalSeedData_();
      }
      return false;
    });

    let state = 'ready';
    let notes = 'Trigger handler is installed.';
    if (!isInstalled) {
      state = missingDeps.length > 0 ? 'blocked' : 'missing';
      notes = missingDeps.length > 0
        ? 'Missing dependencies: ' + missingDeps.join(', ')
        : 'Run ' + step.setupFunction + '() to install this trigger.';
    } else if (executionState.lastSuccessAt) {
      state = 'running';
      notes = 'Installed and has recorded successful execution.';
    } else {
      state = 'installed';
      notes = 'Installed, but no successful execution has been recorded yet.';
    }

    if (executionState.lastError) {
      notes += ' Last error: ' + executionState.lastError;
    }

    return {
      setupFunction: step.setupFunction,
      handler: step.handler,
      label: step.label,
      required: step.required,
      installed: isInstalled,
      state: state,
      lastSetupAt: executionState.lastSetupAt,
      lastAttemptAt: executionState.lastAttemptAt,
      lastSuccessAt: executionState.lastSuccessAt,
      lastError: executionState.lastError,
      notes: notes
    };
  });

  const missingRequiredSteps = steps.filter(function(step) {
    return step.required && !step.installed;
  });
  const missingRequiredHandlers = missingRequiredSteps.map(function(step) {
    return step.handler;
  });
  const nextRecommendedStep = steps.find(function(step) {
    return !step.installed && step.state !== 'blocked';
  });
  const overallState = missingRequiredSteps.length > 0 ? 'action_required' : 'ready';

  return {
    overallState: overallState,
    nextRecommendedSetup: nextRecommendedStep ? nextRecommendedStep.setupFunction + '()' : '',
    missingRequiredHandlers: missingRequiredHandlers,
    steps: steps
  };
}

function getFlowExecutionState_(step) {
  const properties = PropertiesService.getScriptProperties();
  const setupState = readFlowStateRecord_(properties, step.setupFunction);
  const handlerState = readFlowStateRecord_(properties, step.handler);

  return {
    lastSetupAt: setupState.lastSuccessAt || setupState.lastAttemptAt || '',
    lastAttemptAt: handlerState.lastAttemptAt || '',
    lastSuccessAt: handlerState.lastSuccessAt || '',
    lastError: handlerState.lastError || setupState.lastError || ''
  };
}

function readFlowStateRecord_(properties, name) {
  const raw = properties.getProperty('AIM_FLOW_STATE_' + name);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    return {
      lastError: 'State parse failed for ' + name + ': ' + err.message
    };
  }
}

function recordFlowState_(name, status, details) {
  const properties = PropertiesService.getScriptProperties();
  const state = readFlowStateRecord_(properties, name);
  const nowIso = new Date().toISOString();

  state.name = name;
  state.lastAttemptAt = nowIso;
  state.lastStatus = status;
  state.lastDetails = details || {};

  if (status === 'success' || status === 'setup') {
    state.lastSuccessAt = nowIso;
    state.lastError = '';
  } else if (status === 'error') {
    state.lastError = details && details.error ? details.error : 'Unknown error';
  }

  properties.setProperty('AIM_FLOW_STATE_' + name, JSON.stringify(state));
}

function markFlowSetupRun_(setupFunction, handler, details) {
  recordFlowState_(setupFunction, 'setup', {
    handler: handler,
    details: details || {}
  });
}

function markFlowHandlerStart_(handler, details) {
  recordFlowState_(handler, 'start', details || {});
}

function markFlowHandlerSuccess_(handler, details) {
  recordFlowState_(handler, 'success', details || {});
}

function markFlowHandlerError_(handler, err) {
  recordFlowState_(handler, 'error', {
    error: err && err.message ? err.message : String(err)
  });
}

function hasHistoricalSeedData_() {
  const rawDataSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RawData');
  return !!(rawDataSheet && rawDataSheet.getLastRow() > 2);
}

function logHealthDebug_(scope, message, details) {
  const payload = {
    scope: scope,
    message: message
  };
  if (details !== undefined) {
    payload.details = details;
  }
  Logger.log('[AIM_HEALTH] ' + JSON.stringify(payload));
}
