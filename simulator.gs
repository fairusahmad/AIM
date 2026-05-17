// simulator.gs

// 6.1 — Define constants at the top of the file:
const AIM_SIMULATOR_CORE_SENSOR_TYPES = ['Temperature', 'Pressure', 'Current', 'Vibration', 'Speed'];

const SENSOR_RANGES = {
  EM1_TEMP_01: { min: 200, max: 225 },
  EM1_TEMP_02: { min: 198, max: 222 },
  EM1_PRES_01: { min: 3.2, max: 4.8 },
  EM1_CURR_01: { min: 6.0, max: 7.5 },
  EM1_VIBR_01: { min: 1.0, max: 3.2 },
  EM1_SPED_01: { min: 90, max: 120 },
  EM2_TEMP_01: { min: 250, max: 295 },
  EM2_CURR_01: { min: 4.5, max: 6.0 },
  EM2_VIBR_01: { min: 1.0, max: 3.0 },
  EM2_SPED_01: { min: 95, max: 125 },
  EM3_TEMP_01: { min: 235, max: 258 },
  EM3_PRES_01: { min: 3.0, max: 4.3 },
  EM3_CURR_01: { min: 3.8, max: 5.0 },
  EM3_VIBR_01: { min: 1.2, max: 3.4 },
  EM3_SPED_01: { min: 85, max: 115 },
  EM4_CURR_01: { min: 3.5, max: 4.8 },
  EM4_VIBR_01: { min: 1.0, max: 3.0 },
  EM4_SPED_01: { min: 90, max: 120 }
};

const CYCLE_TIMES = {
  EM1: { min: 3.8, max: 4.5 }, EM2: { min: 4.2, max: 5.0 },
  EM3: { min: 3.5, max: 4.2 }, EM4: { min: 4.0, max: 4.8 }
};

const FAULT_SCENARIOS = [
  { name: "EM1_Overheat", machine: "EM1", sensors: { EM1_TEMP_01: 248, EM1_TEMP_02: 245, EM1_CURR_01: 9.3 }, alarm: { code: "AL001", message: "Heater Zone overtemperature" }, cycleTime: 6.8 },
  { name: "EM1_PressureLow", machine: "EM1", sensors: { EM1_PRES_01: 2.1, EM1_SPED_01: 58 }, alarm: { code: "AL002", message: "Clamp pressure low" }, cycleTime: 5.8 },
  { name: "EM1_MechanicalVibration", machine: "EM1", sensors: { EM1_VIBR_01: 7.4, EM1_CURR_01: 9.8, EM1_SPED_01: 62 }, alarm: { code: "AL003", message: "Stacker vibration and load abnormal" }, cycleTime: 7.0 },
  { name: "EM2_TemperatureCurrentSpike", machine: "EM2", sensors: { EM2_TEMP_01: 375, EM2_CURR_01: 7.5, EM2_VIBR_01: 6.1 }, alarm: { code: "AL010", message: "Weld head temperature and current abnormal" }, cycleTime: 7.2 },
  { name: "EM2_SpeedDrop", machine: "EM2", sensors: { EM2_SPED_01: 68, EM2_VIBR_01: 6.4 }, alarm: { code: "AL011", message: "Transfer speed drop with rising vibration" }, cycleTime: 5.5 },
  { name: "EM2_TransferSpeedDrop", machine: "EM2", sensors: { EM2_SPED_01: 60, EM2_VIBR_01: 6.8, EM2_CURR_01: 8.2 }, alarm: { code: "AL012", message: "Transfer speed unstable with high vibration" }, cycleTime: 6.6 },
  { name: "EM3_SolderOverheat", machine: "EM3", sensors: { EM3_TEMP_01: 298, EM3_PRES_01: 2.1, EM3_CURR_01: 6.6 }, alarm: { code: "AL020", message: "Solder temperature critical" }, cycleTime: 6.5 },
  { name: "EM3_VibrationSpeedDrop", machine: "EM3", sensors: { EM3_VIBR_01: 7.2, EM3_SPED_01: 50, EM3_CURR_01: 6.1 }, alarm: { code: "AL021", message: "Insertion vibration and speed abnormal" }, cycleTime: 5.9 },
  { name: "EM4_CurrentRise", machine: "EM4", sensors: { EM4_CURR_01: 6.2, EM4_VIBR_01: 5.9 }, alarm: { code: "AL030", message: "Final station current and vibration high" }, cycleTime: 5.2 },
  { name: "EM4_SpeedInstability", machine: "EM4", sensors: { EM4_SPED_01: 61, EM4_CURR_01: 6.0 }, alarm: { code: "AL031", message: "Final transfer speed below target" }, cycleTime: 5.7 },
  { name: "EM4_HandlerVibration", machine: "EM4", sensors: { EM4_VIBR_01: 7.0, EM4_SPED_01: 57, EM4_CURR_01: 6.8 }, alarm: { code: "AL032", message: "Final handler vibration and speed abnormal" }, cycleTime: 6.4 }
];
const SIMULATOR_MACHINES = ['EM1', 'EM2', 'EM3', 'EM4'];
const MACHINE_CYCLE_OFFSETS = { EM1: 0, EM2: 5, EM3: 9, EM4: 13 };
const MACHINE_FAULT_WINDOWS = {
  EM1: { cycleLength: 31, driftStart: 22, faultStart: 24, faultEnd: 25, downtimeStart: 26, downtimeEnd: 27, idleEnd: 30 },
  EM2: { cycleLength: 37, driftStart: 25, faultStart: 28, faultEnd: 29, downtimeStart: 30, downtimeEnd: 31, idleEnd: 34 },
  EM3: { cycleLength: 29, driftStart: 20, faultStart: 22, faultEnd: 23, downtimeStart: 24, downtimeEnd: 24, idleEnd: 27 },
  EM4: { cycleLength: 41, driftStart: 29, faultStart: 32, faultEnd: 33, downtimeStart: 34, downtimeEnd: 35, idleEnd: 38 }
};
const MACHINE_EVENT_PROFILES = {
  EM1: { faultProbability: 0.65, downtimeProbability: 0.7, idleProbability: 0.25 },
  EM2: { faultProbability: 0.5, downtimeProbability: 0.45, idleProbability: 0.18 },
  EM3: { faultProbability: 0.42, downtimeProbability: 0.35, idleProbability: 0.15 },
  EM4: { faultProbability: 0.3, downtimeProbability: 0.2, idleProbability: 0.12 }
};
const MACHINE_MINOR_EVENT_PROFILES = {
  EM1: { probability: 0.35, cycleTimeLift: [0.3, 0.7] },
  EM2: { probability: 0.28, cycleTimeLift: [0.2, 0.6] },
  EM3: { probability: 0.25, cycleTimeLift: [0.15, 0.45] },
  EM4: { probability: 0.2, cycleTimeLift: [0.1, 0.35] }
};


/**
 * Main simulator function to generate data for all machines.
 * This version uses a simple, predictable, deterministic cycle for demonstration purposes.
 */
function runSimulator(triggerArg) {
  markFlowHandlerStart_('runSimulator', {
    triggerSource: triggerArg && triggerArg.triggerUid ? 'trigger' : 'manual'
  });
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const properties = PropertiesService.getScriptProperties();
    const simulationContext = resolveSimulationContext_(triggerArg);

    const rawDataSheet = ss.getSheetByName('RawData');
    const sensorDataSheet = ss.getSheetByName('SensorData');
    const alarmLogSheet = ss.getSheetByName('AlarmLog');
    const downtimeLogSheet = ss.getSheetByName('DowntimeLog');
    const machineSummarySheet = ss.getSheetByName('MachineSummary');
    const sensorConfigData = ss.getSheetByName('SensorConfig').getDataRange().getValues().slice(1);
    const allSensorConfigs = sensorConfigData.map(row => ({
        sensorId: row[0], machine: row[1], name: row[2], type: row[3], unit: row[4],
        warn: parseFloat(row[5]), crit: parseFloat(row[6]), dir: row[7], active: row[8]
    }));

    let rawDataBatch = [], sensorDataBatch = [], alarmLogBatch = [], downtimeLogBatch = [];

    for (const machine of SIMULATOR_MACHINES) {
      const timestamp = simulationContext.timestamp;
      let stateCounter = parseInt(properties.getProperty(machine + '_stateCounter') || '0', 10);
      const cycleConfig = MACHINE_FAULT_WINDOWS[machine];
      const cyclePosition = (stateCounter + MACHINE_CYCLE_OFFSETS[machine]) % cycleConfig.cycleLength;
      const cycleIndex = Math.floor((stateCounter + MACHINE_CYCLE_OFFSETS[machine]) / cycleConfig.cycleLength);
      const cyclePlan = buildMachineCyclePlan_(machine, cycleIndex, cycleConfig);
      const fault = cyclePlan.fault;

      let status = 'running';
      let cycleTime = 0;
      let alarm = null;
      let rejectCount = 0;
      let faultSensors = {};

      if (cyclePlan.hasFault && cyclePosition >= cyclePlan.eventStart && cyclePosition < cyclePlan.faultStart) {
        status = 'running';
        cycleTime = blendCycleTime_(machine, fault, cyclePlan, cyclePosition, 'drift');
        rejectCount = Math.floor(randomFloat(1, 4));
        for (const sensorId in fault.sensors) {
          const normalRange = SENSOR_RANGES[sensorId];
          if (normalRange) {
            faultSensors[sensorId] = buildSensorFaultValue_(normalRange, fault.sensors[sensorId], cyclePlan, cyclePosition, 'drift');
          }
        }
      } else if (cyclePlan.hasFault && cyclePosition >= cyclePlan.faultStart && cyclePosition <= cyclePlan.faultEnd) {
        status = 'alarm';
        cycleTime = blendCycleTime_(machine, fault, cyclePlan, cyclePosition, 'fault');
        alarm = fault.alarm;
        rejectCount = Math.floor(randomFloat(5, 10));
        for (const sensorId in fault.sensors) {
          const normalRange = SENSOR_RANGES[sensorId];
          if (normalRange) {
            faultSensors[sensorId] = buildSensorFaultValue_(normalRange, fault.sensors[sensorId], cyclePlan, cyclePosition, 'fault');
          }
        }
      } else if (cyclePlan.hasDowntime && cyclePosition >= cyclePlan.downtimeStart && cyclePosition <= cyclePlan.downtimeEnd) {
        status = 'stopped';
        downtimeLogBatch.push([
          timestamp,
          machine,
          timestamp,
          null,
          cyclePlan.downtimeDuration,
          buildDowntimeReason_(fault, cyclePlan),
          'System'
        ]);
      } else if (cyclePlan.hasRecovery && cyclePosition >= cyclePlan.recoveryStart && cyclePosition <= cyclePlan.recoveryEnd) {
        status = 'running';
        cycleTime = blendCycleTime_(machine, fault, cyclePlan, cyclePosition, 'recovery');
        rejectCount = Math.floor(randomFloat(0, 2));
      } else if (cyclePlan.hasIdle && cyclePosition >= cyclePlan.idleStart && cyclePosition <= cyclePlan.idleEnd) {
        status = 'idle';
      } else if (cyclePlan.hasMinorDisturbance && cyclePosition >= cyclePlan.minorStart && cyclePosition <= cyclePlan.minorEnd) {
        status = 'running';
        cycleTime = buildMinorDisturbanceCycleTime_(machine, cyclePlan);
        rejectCount = Math.floor(randomFloat(0, 2));
      } else {
        status = 'running';
        cycleTime = randomFloat(CYCLE_TIMES[machine].min, CYCLE_TIMES[machine].max);
        rejectCount = Math.floor(randomFloat(0, 2));
      }

      const currentSensorData = [];
      if (status === 'running' || status === 'alarm') {
        const machineSensors = allSensorConfigs.filter(s =>
          s.machine === machine &&
          s.active &&
          AIM_SIMULATOR_CORE_SENSOR_TYPES.indexOf(s.type) !== -1
        );
        for (const sensor of machineSensors) {
          let value = faultSensors[sensor.sensorId];
          if (value === undefined) {
            const range = SENSOR_RANGES[sensor.sensorId];
            value = range ? randomFloat(range.min, range.max) : 0;
          }
          let sensorStatus = 'normal';
          if (sensor.dir === 'above') {
            if (value >= sensor.crit) sensorStatus = 'critical';
            else if (value >= sensor.warn) sensorStatus = 'warning';
          } else {
            if (value <= sensor.crit) sensorStatus = 'critical';
            else if (value <= sensor.warn) sensorStatus = 'warning';
          }
          currentSensorData.push([timestamp, machine, sensor.sensorId, sensor.name, sensor.type, value, sensor.unit, sensorStatus]);
        }
      }

      if (status !== 'idle') {
        if (status !== 'stopped') {
          rawDataBatch.push([timestamp, machine, status, cycleTime, alarm ? alarm.code : null, alarm ? alarm.message : null, rejectCount, 'Simulated']);
        }
        if (currentSensorData.length > 0) sensorDataBatch.push(...currentSensorData);
        if (alarm) alarmLogBatch.push([timestamp, machine, alarm.code, alarm.message]);
      }

      updateMachineSummaryForSimulator(machineSummarySheet, machine, timestamp, status, cycleTime, alarm, rejectCount);

      if (!simulationContext.isHistorical) {
        properties.setProperty(machine + '_stateCounter', (stateCounter + 1).toString());
      }
    }

    if (rawDataBatch.length > 0) rawDataSheet.getRange(rawDataSheet.getLastRow() + 1, 1, rawDataBatch.length, rawDataBatch[0].length).setValues(rawDataBatch);
    if (sensorDataBatch.length > 0) sensorDataSheet.getRange(sensorDataSheet.getLastRow() + 1, 1, sensorDataBatch.length, sensorDataBatch[0].length).setValues(sensorDataBatch);
    if (alarmLogBatch.length > 0) alarmLogSheet.getRange(alarmLogSheet.getLastRow() + 1, 1, alarmLogBatch.length, alarmLogBatch[0].length).setValues(alarmLogBatch);
    if (downtimeLogBatch.length > 0) downtimeLogSheet.getRange(downtimeLogSheet.getLastRow() + 1, 1, downtimeLogBatch.length, downtimeLogBatch[0].length).setValues(downtimeLogBatch);

    if (!simulationContext.isHistorical) {
      runAnomalyCheck();
    }

    markFlowHandlerSuccess_('runSimulator', {
      machinesProcessed: SIMULATOR_MACHINES.length,
      timestamp: simulationContext.timestamp
    });
  } catch (err) {
    markFlowHandlerError_('runSimulator', err);
    throw err;
  }
}

function updateMachineSummaryForSimulator(sheet, machine, timestamp, status, cycleTime, alarm, rejectCount) {
    const data = sheet.getRange("A2:H").getValues();
    for (let i = 0; i < data.length; i++) {
        if (data[i][0] === machine) {
            const row = i + 2;
            sheet.getRange(row, 2).setValue(timestamp);
            sheet.getRange(row, 3).setValue(status);
            if (status === 'running' || status === 'alarm') {
                sheet.getRange(row, 4).setValue(cycleTime);
                if (alarm) sheet.getRange(row, 5).setValue(alarm.code);
                const lastUpdatedDate = data[i][1] ? new Date(data[i][1]) : null;
                const isSameDay = lastUpdatedDate && lastUpdatedDate.toDateString() === timestamp.toDateString();
                const currentRejectCount = data[i][6] || 0;
                sheet.getRange(row, 7).setValue(isSameDay ? currentRejectCount + rejectCount : rejectCount);
            }
            break;
        }
    }
}

/**
 * 6.4 — Seed 7 days of historical data.
 */
function seedHistoricalData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    SpreadsheetApp.flush();
    const now = new Date();
    const startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    let currentTime = startTime;
    while(currentTime <= now) {
        runSimulator(currentTime);
        currentTime = new Date(currentTime.getTime() + 5 * 60 * 1000); // 5-minute intervals
    }
    
    runSimulator(); // Run one last time for the current moment
    ss.toast("7 days of historical data seeded successfully.", "Simulator", 5);
}

function resolveSimulationContext_(triggerArg) {
  if (triggerArg instanceof Date) {
    return {
      isHistorical: true,
      timestamp: new Date(triggerArg.getTime())
    };
  }

  return {
    isHistorical: false,
    timestamp: new Date()
  };
}

/**
 * 6.3 — Trigger management functions.
 */
function startSimulator() {
  stopSimulator(false);
    ScriptApp.newTrigger('runSimulator')
        .timeBased()
        .everyMinutes(1)
        .create();
    markFlowSetupRun_('startSimulator', 'runSimulator', {
      interval: 'every 1 minute'
    });
    SpreadsheetApp.getActiveSpreadsheet().toast("Simulator started. Data will update every minute in a predictable cycle.", "Simulator Control", 5);
  }

function stopSimulator(showToast = true) {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'runSimulator') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  if (showToast) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Simulator stopped.", "Simulator Control", 5);
  }
}

/**
 * Helper to reset the deterministic simulator's state for a fresh demonstration cycle.
 */
function resetSimulatorState() {
  const properties = PropertiesService.getScriptProperties();
  for (const machine of SIMULATOR_MACHINES) {
    properties.deleteProperty(machine + '_stateCounter');
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("Simulator state has been reset. The demonstration cycle will restart.", "Simulator Control", 5);
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pickFaultScenario_(machine, stateCounter) {
  const machineFaults = FAULT_SCENARIOS.filter(function(fault) {
    return fault.machine === machine;
  });
  const faultIndex = Math.floor((stateCounter + MACHINE_CYCLE_OFFSETS[machine]) / 2) % machineFaults.length;
  return machineFaults[faultIndex];
}

function buildMachineCyclePlan_(machine, cycleIndex, cycleConfig) {
  const profile = MACHINE_EVENT_PROFILES[machine];
  const minorProfile = MACHINE_MINOR_EVENT_PROFILES[machine];
  const fault = pickFaultScenario_(machine, cycleIndex * 3);
  const faultRoll = seededRatio_(machine + '_fault_' + cycleIndex);
  const downtimeRoll = seededRatio_(machine + '_downtime_' + cycleIndex);
  const idleRoll = seededRatio_(machine + '_idle_' + cycleIndex);
  const startRoll = seededRatio_(machine + '_start_' + cycleIndex);
  const severityRoll = seededRatio_(machine + '_severity_' + cycleIndex);
  const durationRoll = seededRatio_(machine + '_duration_' + cycleIndex);
  const minorRoll = seededRatio_(machine + '_minor_' + cycleIndex);

  const hasFault = faultRoll < profile.faultProbability;
  const hasDowntime = hasFault && downtimeRoll < profile.downtimeProbability;
  const hasIdle = !hasDowntime && idleRoll < profile.idleProbability;
  const hasMinorDisturbance = !hasFault && minorRoll < minorProfile.probability;
  const driftLength = 2 + Math.floor(durationRoll * 2);
  const faultLength = 1 + Math.floor(severityRoll * 2);
  const eventStart = Math.max(8, cycleConfig.driftStart - 4 + Math.floor(startRoll * 6));
  const faultStart = eventStart + driftLength;
  const faultEnd = Math.min(faultStart + faultLength - 1, cycleConfig.cycleLength - 3);
  const downtimeStart = hasDowntime ? faultEnd + 1 : -1;
  const downtimeDuration = randomDurationMinutes_(machine, cycleIndex);
  const downtimeLength = hasDowntime ? 1 + Math.floor(seededRatio_(machine + '_downlength_' + cycleIndex) * 2) : 0;
  const downtimeEnd = hasDowntime ? Math.min(downtimeStart + downtimeLength - 1, cycleConfig.cycleLength - 2) : -1;
  const recoveryStart = hasFault ? faultEnd + 1 : -1;
  const recoveryLength = hasFault ? 2 + Math.floor(seededRatio_(machine + '_recovery_' + cycleIndex) * 3) : 0;
  const recoveryEnd = hasFault ? Math.min(recoveryStart + recoveryLength - 1, cycleConfig.cycleLength - 1) : -1;
  const idleStart = hasIdle ? Math.max(recoveryEnd + 1, cycleConfig.idleEnd - 1) : -1;
  const minorStart = hasMinorDisturbance ? 6 + Math.floor(startRoll * 10) : -1;
  const minorEnd = hasMinorDisturbance ? minorStart + 1 + Math.floor(durationRoll * 2) : -1;

  return {
    fault: fault,
    hasFault: hasFault,
    hasDowntime: hasDowntime,
    hasIdle: hasIdle,
    hasMinorDisturbance: hasMinorDisturbance,
    eventStart: eventStart,
    faultStart: faultStart,
    faultEnd: faultEnd,
    downtimeStart: downtimeStart,
    downtimeEnd: downtimeEnd,
    downtimeDuration: downtimeDuration,
    hasRecovery: hasFault,
    recoveryStart: recoveryStart,
    recoveryEnd: recoveryEnd,
    idleStart: idleStart,
    idleEnd: cycleConfig.idleEnd,
    minorStart: minorStart,
    minorEnd: minorEnd,
    severity: 0.55 + (severityRoll * 0.45)
  };
}

function interpolateTowardFault_(normalValue, faultValue, factor) {
  return normalValue + ((faultValue - normalValue) * factor);
}

function randomDurationMinutes_(machine, cycleIndex) {
  const baseDurations = {
    EM1: [4, 6, 8],
    EM2: [5, 7, 9],
    EM3: [3, 5, 6],
    EM4: [4, 6, 7]
  };
  const options = baseDurations[machine] || [5];
  return options[cycleIndex % options.length];
}

function buildDowntimeReason_(fault, cyclePlan) {
  if (!cyclePlan.hasFault) {
    return 'Short operational check';
  }

  const reasons = [
    'Inspection after ' + fault.name.replace(/_/g, ' '),
    'Operator intervention after ' + fault.alarm.message,
    'Stabilization after ' + fault.name.replace(/_/g, ' ')
  ];
  const index = Math.floor(seededRatio_(fault.name + '_reason') * reasons.length) % reasons.length;
  return reasons[index];
}

function blendCycleTime_(machine, fault, cyclePlan, cyclePosition, stage) {
  const normalMid = (CYCLE_TIMES[machine].min + CYCLE_TIMES[machine].max) / 2;
  const faultTarget = normalMid + ((fault.cycleTime - normalMid) * cyclePlan.severity);

  if (stage === 'drift') {
    const progress = normalizedProgress_(cyclePosition, cyclePlan.eventStart, cyclePlan.faultStart);
    return normalMid + ((faultTarget - normalMid) * (0.35 + (progress * 0.45)));
  }

  if (stage === 'fault') {
    const progress = normalizedProgress_(cyclePosition, cyclePlan.faultStart, cyclePlan.faultEnd + 1);
    return faultTarget + (progress * 0.18);
  }

  if (stage === 'recovery') {
    const progress = normalizedProgress_(cyclePosition, cyclePlan.recoveryStart, cyclePlan.recoveryEnd + 1);
    return faultTarget - ((faultTarget - normalMid) * progress);
  }

  return normalMid;
}

function buildSensorFaultValue_(normalRange, faultValue, cyclePlan, cyclePosition, stage) {
  const normalMid = (normalRange.min + normalRange.max) / 2;
  const scaledTarget = normalMid + ((faultValue - normalMid) * cyclePlan.severity);

  if (stage === 'drift') {
    const progress = normalizedProgress_(cyclePosition, cyclePlan.eventStart, cyclePlan.faultStart);
    return normalMid + ((scaledTarget - normalMid) * (0.35 + (progress * 0.45)));
  }

  if (stage === 'fault') {
    return scaledTarget;
  }

  return normalMid;
}

function buildMinorDisturbanceCycleTime_(machine, cyclePlan) {
  const profile = MACHINE_MINOR_EVENT_PROFILES[machine];
  const base = randomFloat(CYCLE_TIMES[machine].min, CYCLE_TIMES[machine].max);
  const lift = randomFloat(profile.cycleTimeLift[0], profile.cycleTimeLift[1]);
  return base + lift;
}

function normalizedProgress_(value, start, endExclusive) {
  const span = Math.max(endExclusive - start, 1);
  return Math.min(Math.max((value - start) / span, 0), 1);
}

function seededRatio_(key) {
  let hash = 0;
  for (let index = 0; index < key.length; index++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}
