// simulator.gs

// 6.1 — Define constants at the top of the file:
const SENSOR_RANGES = {
  EM1_TEMP_01: { min: 200, max: 225 }, EM1_TEMP_02: { min: 198, max: 222 }, EM1_PRES_01: { min: 3.2, max: 4.8 },
  EM1_CURR_01: { min: 6.0, max: 7.5 }, EM1_VIBR_01: { min: 1.0, max: 3.2 }, EM1_SPED_01: { min: 90,  max: 120 },
  EM1_POSN_01: { min: 0.05, max: 0.35 }, EM2_LASR_01: { min: 290, max: 340 }, EM2_TEMP_01: { min: 250, max: 295 },
  EM2_CURR_01: { min: 4.5, max: 6.0 }, EM2_VIBR_01: { min: 1.0, max: 3.0 }, EM2_SPED_01: { min: 95,  max: 125 },
  EM2_VISN_01: { min: 96,  max: 99.5 }, EM2_REJT_01: { min: 0,   max: 3 },   EM3_TEMP_01: { min: 235, max: 258 },
  EM3_PRES_01: { min: 3.0, max: 4.3 }, EM3_CURR_01: { min: 3.8, max: 5.0 }, EM3_VIBR_01: { min: 1.2, max: 3.4 },
  EM3_SPED_01: { min: 85,  max: 115 }, EM3_FORC_01: { min: 8,   max: 13 },  EM3_POSN_01: { min: 0.05, max: 0.25 },
  EM4_VISN_01: { min: 96,  max: 99.8 }, EM4_LASR_01: { min: 250, max: 275 }, EM4_CURR_01: { min: 3.5, max: 4.8 },
  EM4_VIBR_01: { min: 1.0, max: 3.0 }, EM4_SPED_01: { min: 90,  max: 120 }, EM4_MARK_01: { min: 97.5, max: 99.9 },
  EM4_REJT_01: { min: 0,   max: 2 }
};

const CYCLE_TIMES = {
  EM1: { min: 3.8, max: 4.5 }, EM2: { min: 4.2, max: 5.0 },
  EM3: { min: 3.5, max: 4.2 }, EM4: { min: 4.0, max: 4.8 }
};

const FAULT_SCENARIOS = [
  { name: "EM1_Overheat", machine: "EM1", sensors: { EM1_TEMP_01: 248, EM1_TEMP_02: 245, EM1_CURR_01: 9.3 }, alarm: { code: "AL001", message: "Heater Zone overtemperature" }, cycleTime: 6.8 },
  { name: "EM1_PressureLow", machine: "EM1", sensors: { EM1_PRES_01: 2.1, EM1_SPED_01: 58 }, alarm: { code: "AL002", message: "Clamp pressure low" }, cycleTime: 5.8 },
  { name: "EM1_MechanicalVibration", machine: "EM1", sensors: { EM1_VIBR_01: 7.4, EM1_CURR_01: 9.8, EM1_SPED_01: 62 }, alarm: { code: "AL003", message: "Stacker vibration and load abnormal" }, cycleTime: 7.0 },
  { name: "EM2_LaserSpike", machine: "EM2", sensors: { EM2_LASR_01: 395, EM2_TEMP_01: 375, EM2_CURR_01: 7.5 }, alarm: { code: "AL010", message: "Laser power out of range" }, cycleTime: 7.2 },
  { name: "EM2_VisionFail", machine: "EM2", sensors: { EM2_VISN_01: 88, EM2_REJT_01: 12 }, alarm: { code: "AL011", message: "Vision inspection failure rate high" }, cycleTime: 5.5 },
  { name: "EM2_TransferSpeedDrop", machine: "EM2", sensors: { EM2_SPED_01: 60, EM2_VIBR_01: 6.8, EM2_CURR_01: 8.2 }, alarm: { code: "AL012", message: "Transfer speed unstable with high vibration" }, cycleTime: 6.6 },
  { name: "EM3_SolderOverheat", machine: "EM3", sensors: { EM3_TEMP_01: 298, EM3_PRES_01: 2.1, EM3_CURR_01: 6.6 }, alarm: { code: "AL020", message: "Solder temperature critical" }, cycleTime: 6.5 },
  { name: "EM3_InsertionForce", machine: "EM3", sensors: { EM3_FORC_01: 21, EM3_VIBR_01: 7.2, EM3_SPED_01: 50 }, alarm: { code: "AL021", message: "Insertion force exceeded limit" }, cycleTime: 5.9 },
  { name: "EM4_FinalRejectHigh", machine: "EM4", sensors: { EM4_VISN_01: 91, EM4_REJT_01: 9 }, alarm: { code: "AL030", message: "Final inspection reject rate high" }, cycleTime: 5.2 },
  { name: "EM4_MarkQualityLow", machine: "EM4", sensors: { EM4_MARK_01: 91.5, EM4_LASR_01: 315, EM4_CURR_01: 6.2 }, alarm: { code: "AL031", message: "Mark quality below threshold" }, cycleTime: 5.7 },
  { name: "EM4_HandlerVibration", machine: "EM4", sensors: { EM4_VIBR_01: 7.0, EM4_SPED_01: 57, EM4_CURR_01: 6.8 }, alarm: { code: "AL032", message: "Final handler vibration and speed abnormal" }, cycleTime: 6.4 }
];
const SIMULATOR_MACHINES = ['EM1', 'EM2', 'EM3', 'EM4'];


/**
 * Main simulator function to generate data for all machines.
 * This version uses a simple, predictable, deterministic cycle for demonstration purposes.
 */
function runSimulator(historicalTimestamp = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const properties = PropertiesService.getScriptProperties();

  // Prepare sheets and configs
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
    const timestamp = historicalTimestamp || new Date();
    let stateCounter = parseInt(properties.getProperty(machine + '_stateCounter') || '0');
    const cyclePosition = stateCounter % 20; // 20-minute cycle for each machine

    let status = 'running', cycleTime = 0, alarm = null, rejectCount = 0, faultSensors = {};

    // --- Start of simplified, deterministic logic for demonstration ---
    // Each machine cycles through a predictable 20-minute pattern to make the demo easy to follow.
    if (cyclePosition < 15) {
      // State: NORMAL (15 minutes) - Standard operation with minor variations.
      status = 'running';
      cycleTime = randomFloat(CYCLE_TIMES[machine].min, CYCLE_TIMES[machine].max);
      rejectCount = Math.floor(randomFloat(0, 2));
    } else if (cyclePosition === 15) {
      // State: DRIFT (1 minute) - Values start to move towards a failure condition.
      status = 'running';
      const fault = FAULT_SCENARIOS.filter(f => f.machine === machine)[0];
      cycleTime = (fault.cycleTime + CYCLE_TIMES[machine].max) / 2; // Cycle time increases
      rejectCount = 3;
      // Sensor values are set halfway between normal max and fault value
      for (const sensorId in fault.sensors) {
        const normalRange = SENSOR_RANGES[sensorId];
        if (normalRange) faultSensors[sensorId] = (fault.sensors[sensorId] + normalRange.max) / 2;
      }
    } else if (cyclePosition === 16) {
      // State: FAULT (1 minute) - A specific fault is triggered with an alarm.
      status = 'alarm';
      const fault = FAULT_SCENARIOS.filter(f => f.machine === machine)[0];
      cycleTime = fault.cycleTime;
      alarm = fault.alarm;
      faultSensors = fault.sensors;
      rejectCount = 8;
    } else if (cyclePosition === 17) {
      // State: DOWNTIME (1 minute) - Machine is stopped for "maintenance".
      status = 'stopped';
      downtimeLogBatch.push([timestamp, machine, timestamp, null, 5, 'Scheduled Demo Downtime', 'System']);
    } else {
      // State: IDLE (2 minutes) - Machine is inactive before restarting the cycle.
      status = 'idle';
    }
    // --- End of deterministic state logic ---

    // --- Data Generation and Writing ---
    const currentSensorData = [];
    if (status === 'running' || status === 'alarm') {
        const machineSensors = allSensorConfigs.filter(s => s.machine === machine && s.active);
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
      if(currentSensorData.length > 0) sensorDataBatch.push(...currentSensorData);
      if(alarm) alarmLogBatch.push([timestamp, machine, alarm.code, alarm.message]);
    }
    
    // Update MachineSummary directly
    updateMachineSummaryForSimulator(machineSummarySheet, machine, timestamp, status, cycleTime, alarm, rejectCount);

    // For live demo, increment the state counter. For historical, it remains at 0.
    if (!historicalTimestamp) {
      properties.setProperty(machine + '_stateCounter', (stateCounter + 1).toString());
    }
  }
  
  // Batch write to sheets to improve performance
  if(rawDataBatch.length > 0) rawDataSheet.getRange(rawDataSheet.getLastRow() + 1, 1, rawDataBatch.length, rawDataBatch[0].length).setValues(rawDataBatch);
  if(sensorDataBatch.length > 0) sensorDataSheet.getRange(sensorDataSheet.getLastRow() + 1, 1, sensorDataBatch.length, sensorDataBatch[0].length).setValues(sensorDataBatch);
  if(alarmLogBatch.length > 0) alarmLogSheet.getRange(alarmLogSheet.getLastRow() + 1, 1, alarmLogBatch.length, alarmLogBatch[0].length).setValues(alarmLogBatch);
  if(downtimeLogBatch.length > 0) downtimeLogSheet.getRange(downtimeLogSheet.getLastRow() + 1, 1, downtimeLogBatch.length, downtimeLogBatch[0].length).setValues(downtimeLogBatch);

  // Run anomaly detection engine if it's a live run
  if (!historicalTimestamp) {
      runAnomalyCheck();
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

/**
 * 6.3 — Trigger management functions.
 */
function startSimulator() {
  stopSimulator(false);
  ScriptApp.newTrigger('runSimulator')
      .timeBased()
      .everyMinutes(1)
      .create();
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
