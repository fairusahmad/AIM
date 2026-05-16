// anomaly.gs

const MACHINES = ['EM1', 'EM2', 'EM3', 'EM4'];

/**
 * Main function to run all anomaly checks.
 * This is intended to be called by a time-driven trigger.
 */
function runAnomalyCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const anomalyLogSheet = ss.getSheetByName('AnomalyLog');
  
  let newAnomalies = [];

  // 3.2 — Rule-based anomaly checks
  newAnomalies.push(...checkSensorStatusAnomalies(ss));
  newAnomalies.push(...checkSensorDrift(ss));
  newAnomalies.push(...checkCycleTimeAnomalies(ss));
  newAnomalies.push(...checkRepeatedAlarms(ss));
  newAnomalies.push(...checkNoSignal(ss));
  
  // 3.3 — Modified Isolation Forest-inspired anomaly scoring
  newAnomalies.push(...runModifiedIsolationForest(ss));

  if (newAnomalies.length > 0) {
    // 3.5 — Duplicate prevention
    const anomaliesToAdd = preventDuplicates(anomalyLogSheet, newAnomalies);

    if (anomaliesToAdd.length > 0) {
      const anomalyRows = anomaliesToAdd.map(a => [a.timestamp, a.machine, a.sensorId, a.sensorName, a.anomalyType, a.description, a.value, a.threshold, a.riskScore, a.alertSent, a.engineerFeedback]);
      anomalyLogSheet.getRange(anomalyLogSheet.getLastRow() + 1, 1, anomalyRows.length, anomalyRows[0].length).setValues(anomalyRows);
    }
  }

  // 3.5 — MachineSummary update
  updateMachineSummary(ss);
  
  // Call sendAlerts() at the end
  sendAlerts();
}

// =================================================================
// 3.2 — RULE-BASED ANOMALY CHECKS
// =================================================================

function checkSensorStatusAnomalies(ss) {
  const sensorDataSheet = ss.getSheetByName('SensorData');
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const data = sensorDataSheet.getDataRange().getValues();
  data.shift(); // remove headers

  const recentSensorData = data.filter(row => new Date(row[0]) >= fiveMinutesAgo);
  const anomalies = [];

  for (const row of recentSensorData) {
    const [timestamp, machine, sensorId, sensorName, sensorType, value, unit, status] = row;
    if (status === 'warning') {
      anomalies.push({
        timestamp: new Date(timestamp), machine, sensorId, sensorName,
        anomalyType: 'SensorWarning', description: `Sensor value is in warning zone.`,
        value, threshold: null, riskScore: 0.5, alertSent: false, engineerFeedback: ''
      });
    } else if (status === 'critical') {
      anomalies.push({
        timestamp: new Date(timestamp), machine, sensorId, sensorName,
        anomalyType: 'SensorCritical', description: `Sensor value is in critical zone.`,
        value, threshold: null, riskScore: 0.9, alertSent: false, engineerFeedback: ''
      });
    }
  }
  return anomalies;
}

function checkSensorDrift(ss) {
    const sensorDataSheet = ss.getSheetByName('SensorData');
    const driftPercent = getConfigValue('SensorDrift_Percent') || 25;
    const data = sensorDataSheet.getDataRange().getValues();
    data.shift();
    const anomalies = [];
    
    const sensorReadings = new Map();
    for (const row of data) {
        const sensorId = row[2];
        if (!sensorReadings.has(sensorId)) {
            sensorReadings.set(sensorId, []);
        }
        sensorReadings.get(sensorId).push({value: row[5], ts: new Date(row[0])});
    }

    for (const [sensorId, readings] of sensorReadings.entries()) {
        if (readings.length < 31) continue; // Need at least 30 historical + 1 latest
        
        readings.sort((a,b) => b.ts - a.ts); // sort descending by timestamp
        const latestReading = readings[0];
        const last30Readings = readings.slice(1, 31);
        
        const sum = last30Readings.reduce((acc, r) => acc + r.value, 0);
        const avg = sum / last30Readings.length;
        
        const deviation = Math.abs((latestReading.value - avg) / avg) * 100;
        
        if (deviation > driftPercent) {
            const sensorConfig = getSensorConfig(ss, sensorId);
            anomalies.push({
                timestamp: latestReading.ts, machine: sensorConfig.machine, sensorId, sensorName: sensorConfig.name,
                anomalyType: 'SensorDrift', description: `Value deviated by ${deviation.toFixed(2)}% from 30-reading average.`,
                value: latestReading.value, threshold: driftPercent, riskScore: 0.6, alertSent: false, engineerFeedback: ''
            });
        }
    }
    return anomalies;
}

function checkCycleTimeAnomalies(ss) {
    const rawDataSheet = ss.getSheetByName('RawData');
    const warnThreshold = getConfigValue('CycleTime_Warning_sec');
    const criticalThreshold = getConfigValue('CycleTime_Critical_sec');
    const data = rawDataSheet.getDataRange().getValues();
    data.shift();
    const anomalies = [];
    const latestMachineData = new Map();

    for(const row of data) {
        latestMachineData.set(row[1], {timestamp: new Date(row[0]), cycleTime: row[3]});
    }

    for (const [machine, latest] of latestMachineData.entries()) {
        if (latest.cycleTime > criticalThreshold) {
            anomalies.push({
                timestamp: latest.timestamp, machine, sensorId: 'CYCLE_TIME', sensorName: 'Cycle Time',
                anomalyType: 'CycleTimeCritical', description: `Cycle time ${latest.cycleTime}s exceeded critical threshold of ${criticalThreshold}s.`,
                value: latest.cycleTime, threshold: criticalThreshold, riskScore: 0.9, alertSent: false, engineerFeedback: ''
            });
        } else if (latest.cycleTime > warnThreshold) {
             anomalies.push({
                timestamp: latest.timestamp, machine, sensorId: 'CYCLE_TIME', sensorName: 'Cycle Time',
                anomalyType: 'CycleTimeWarning', description: `Cycle time ${latest.cycleTime}s exceeded warning threshold of ${warnThreshold}s.`,
                value: latest.cycleTime, threshold: warnThreshold, riskScore: 0.5, alertSent: false, engineerFeedback: ''
            });
        }
    }
    return anomalies;
}

function checkRepeatedAlarms(ss) {
    const alarmLogSheet = ss.getSheetByName('AlarmLog');
    const repeatThreshold = getConfigValue('AlarmRepeat_Threshold');
    const windowMin = getConfigValue('AlarmRepeat_Window_min');
    const now = new Date();
    const windowTime = new Date(now.getTime() - windowMin * 60 * 1000);

    const data = alarmLogSheet.getDataRange().getValues();
    data.shift();
    const anomalies = [];
    const recentAlarms = data.filter(row => new Date(row[0]) >= windowTime);

    const alarmCounts = {}; // { "EM1_AL001": [ts1, ts2, ...], ... }
    for (const row of recentAlarms) {
        const key = `${row[1]}_${row[2]}`; // machine_alarmcode
        if (!alarmCounts[key]) alarmCounts[key] = [];
        alarmCounts[key].push(new Date(row[0]));
    }

    for (const key in alarmCounts) {
        if (alarmCounts[key].length > repeatThreshold) {
            const [machine, alarmCode] = key.split('_');
            const latestTimestamp = new Date(Math.max.apply(null, alarmCounts[key]));
            anomalies.push({
                timestamp: latestTimestamp, machine, sensorId: 'ALARM_SYSTEM', sensorName: 'Alarm Frequency',
                anomalyType: 'RepeatedAlarm', description: `Alarm ${alarmCode} repeated ${alarmCounts[key].length} times in last ${windowMin} mins.`,
                value: alarmCounts[key].length, threshold: repeatThreshold, riskScore: 0.8, alertSent: false, engineerFeedback: ''
            });
        }
    }
    return anomalies;
}

function checkNoSignal(ss) {
    const machineSummarySheet = ss.getSheetByName('MachineSummary');
    const timeoutMin = getConfigValue('NoSignal_Timeout_min');
    const now = new Date();
    const timeout = new Date(now.getTime() - timeoutMin * 60 * 1000);
    const data = machineSummarySheet.getDataRange().getValues();
    data.shift();
    const anomalies = [];

    for (const row of data) {
        const [machine, lastUpdated, status] = row;
        const lastUpdatedTs = new Date(lastUpdated);
        if (status === 'running' && lastUpdatedTs < timeout) {
            anomalies.push({
                timestamp: now, machine, sensorId: 'SYSTEM_STATUS', sensorName: 'Machine Connectivity',
                anomalyType: 'NoSignal', description: `No signal from machine for over ${timeoutMin} minutes while status was 'running'.`,
                value: Math.round((now - lastUpdatedTs) / 60000), threshold: timeoutMin, riskScore: 1.0, alertSent: false, engineerFeedback: ''
            });
        }
    }
    return anomalies;
}

// =================================================================
// 3.3 — MODIFIED ISOLATION FOREST-INSPIRED SCORING
// =================================================================

/**
 * The modified Isolation Forest approach allows this project to study:
 * 1. Feature selection — which features are most useful for early breakdown detection.
 * 2. Sensor weighting — which sensors should have stronger influence on the risk score.
 * 3. Machine-specific baseline — each machine may require a different normal behaviour profile.
 * 4. Time-window analysis — abnormal patterns may appear gradually before machine stoppage.
 * 5. Threshold optimisation — warning and critical thresholds can be tuned to reduce false alerts.
 * 6. Hybrid rule-based and AI detection — engineering rules can be combined with AI scores.
 * 7. Engineer feedback loop — engineer confirmation can be used to improve the model later.
 */
function runModifiedIsolationForest(ss) {
    const anomalies = [];
    const windowSize = getConfigValue('IForest_WindowSize');
    const contamination = getConfigValue('IForest_Contamination');
    const warningScore = getConfigValue('IForest_WarningScore');
    const criticalScore = getConfigValue('IForest_CriticalScore');

    const sensorData = ss.getSheetByName('SensorData').getDataRange().getValues();
    sensorData.shift();
    const rawData = ss.getSheetByName('RawData').getDataRange().getValues();
    rawData.shift();
    const alarmData = ss.getSheetByName('AlarmLog').getDataRange().getValues();
    alarmData.shift();
    const downtimeData = ss.getSheetByName('DowntimeLog').getDataRange().getValues();
    downtimeData.shift();

    const featureWeights = {
        Temperature: getConfigValue('Weight_Temperature') || 1.2,
        Pressure: getConfigValue('Weight_Pressure') || 1.1,
        Current: getConfigValue('Weight_Current') || 1.3,
        Vibration: getConfigValue('Weight_Vibration') || 1.5,
        Speed: getConfigValue('Weight_Speed') || 1.2,
        CycleTime: getConfigValue('Weight_CycleTime') || 1.0,
        AlarmFrequency: getConfigValue('Weight_AlarmFrequency') || 1.0,
        Downtime: getConfigValue('Weight_Downtime') || 1.0,
        RejectRate: getConfigValue('Weight_RejectRate') || 1.0
    };
    
    for (const machine of MACHINES) {
        // 1. Build Feature Vector for the latest data point
        const latestVector = buildFeatureVector(ss, machine, 'latest', sensorData, rawData, alarmData, downtimeData);
        if (!latestVector) continue;

        // 2. Build baseline matrix
        const baselineMatrix = [];
        for (let i = 0; i < windowSize; i++) {
            const vector = buildFeatureVector(ss, machine, i, sensorData, rawData, alarmData, downtimeData);
            if(vector) baselineMatrix.push(vector);
        }
        if (baselineMatrix.length < 5) continue; // Not enough data for baseline

        // 3. Normalize, weight, and score
        const { riskScore, contributingFeatures } = calculateRiskScore(latestVector, baselineMatrix, featureWeights);

        // 4. Log anomaly if score exceeds thresholds
        let anomalyType = null;
        let threshold = null;
        if (riskScore >= criticalScore) {
            anomalyType = 'IForestCritical';
            threshold = criticalScore;
        } else if (riskScore >= warningScore) {
            anomalyType = 'IForestWarning';
            threshold = warningScore;
        }

        if (anomalyType) {
            const sortedContributors = Object.entries(contributingFeatures).sort(([,a],[,b]) => b-a);
            const top3 = sortedContributors.slice(0, 3).map(([k,v]) => `${k} (dev: ${v.toFixed(2)})`).join(', ');
            
            anomalies.push({
                timestamp: new Date(), machine, sensorId: 'IFOREST_MODEL', sensorName: 'Modified_Isolation_Forest',
                anomalyType, description: `Top contributors: ${top3}`,
                value: riskScore, threshold, riskScore, alertSent: false, engineerFeedback: ''
            });
        }
    }

    return anomalies;
}

function buildFeatureVector(ss, machine, index, allSensorData, allRawData, allAlarmData, allDowntimeData) {
    const sensorConfig = getSensorConfig(ss);
    const machineSensors = sensorConfig.filter(r => r[1] === machine);
    
    const machineRawData = allRawData.filter(r => r[1] === machine).sort((a,b) => new Date(b[0]) - new Date(a[0]));
    if (machineRawData.length <= index) return null;
    const targetRawData = machineRawData[index];
    const timestamp = new Date(targetRawData[0]);

    const findSensorValue = (sensorType) => {
        const relevantSensors = machineSensors.filter(s => s[3] === sensorType).map(s => s[0]);
        if (relevantSensors.length === 0) return 0;
        const machineSensorData = allSensorData.filter(r => r[1] === machine && relevantSensors.includes(r[2]))
                                              .sort((a,b) => new Date(b[0]) - new Date(a[0]));
        // Find the sensor value closest to the raw data timestamp
        const reading = machineSensorData.find(r => new Date(r[0]) <= timestamp);
        return reading ? reading[5] : 0;
    };

    const windowEnd = timestamp;
    const windowStart = new Date(timestamp.getTime() - (getConfigValue('IForest_WindowSize') || 30) * 60 * 1000);

    const alarmsInWindow = allAlarmData.filter(r => r[1] === machine && new Date(r[0]) >= windowStart && new Date(r[0]) <= windowEnd);
    const downtimeInWindow = allDowntimeData.filter(r => r[1] === machine && new Date(r[0]) >= windowStart && new Date(r[0]) <= windowEnd);

    return {
        Temperature: findSensorValue('Temperature'),
        Pressure: findSensorValue('Pressure'),
        Current: findSensorValue('Current'),
        Vibration: findSensorValue('Vibration'),
        Speed: findSensorValue('Speed'),
        CycleTime: targetRawData[3],
        AlarmFrequency: alarmsInWindow.length,
        Downtime: downtimeInWindow.reduce((sum, r) => sum + (r[4] || 0), 0),
        RejectRate: targetRawData[6]
    };
}

function calculateRiskScore(latestVector, baselineMatrix, featureWeights) {
    const numSubspaces = 50;
    const subspaceScores = [];
    const featureDeviations = {};

    // Calculate baseline stats (avg, stdev) for each feature
    const baselineStats = {};
    const features = Object.keys(latestVector);
    for (const feature of features) {
        const values = baselineMatrix.map(v => v[feature]);
        const sum = values.reduce((acc, v) => acc + v, 0);
        const avg = sum / values.length;
        const std = Math.sqrt(values.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b) / values.length) || 0.0001;
        baselineStats[feature] = { avg, std };
    }

    // Calculate weighted deviation for each feature
    for (const feature of features) {
        const { avg, std } = baselineStats[feature];
        const normalizedDeviation = Math.abs(latestVector[feature] - avg) / std;
        const weight = (Object.keys(featureWeights).find(k => feature.includes(k)) && featureWeights[Object.keys(featureWeights).find(k => feature.includes(k))]) || 1.0;
        featureDeviations[feature] = normalizedDeviation * weight;
    }

    // Create random subspaces and calculate scores
    for (let i = 0; i < numSubspaces; i++) {
        // Randomly select 3 to 5 features
        const shuffled = features.sort(() => 0.5 - Math.random());
        const numFeatures = Math.floor(Math.random() * 3) + 3;
        const subspaceFeatures = shuffled.slice(0, numFeatures);

        const avgWeightedDeviation = subspaceFeatures.reduce((sum, f) => sum + featureDeviations[f], 0) / numFeatures;
        
        const subspaceScore = 1 - Math.exp(-avgWeightedDeviation / 3);
        subspaceScores.push(subspaceScore);
    }
    
    // Final score is the average of all subspace scores
    const finalRiskScore = subspaceScores.reduce((sum, s) => sum + s, 0) / numSubspaces;
    
    return { riskScore: finalRiskScore, contributingFeatures: featureDeviations };
}


// =================================================================
// 3.5 — UTILITY FUNCTIONS
// =================================================================

function preventDuplicates(anomalyLogSheet, newAnomalies) {
    const tenMinutesAgo = new Date(new Date().getTime() - 10 * 60 * 1000);
    const data = anomalyLogSheet.getDataRange().getValues();
    data.shift();

    const recentAnomalies = new Set(
      data.filter(row => new Date(row[0]) >= tenMinutesAgo)
          .map(row => `${row[1]}_${row[2]}_${row[4]}`) // Machine + SensorID + AnomalyType
    );
    
    return newAnomalies.filter(a => {
        const key = `${a.machine}_${a.sensorId}_${a.anomalyType}`;
        return !recentAnomalies.has(key);
    });
}

function updateMachineSummary(ss) {
    const summarySheet = ss.getSheetByName('MachineSummary');
    const anomalySheet = ss.getSheetByName('AnomalyLog');
    
    const summaryData = summarySheet.getRange("A2:A" + summarySheet.getLastRow()).getValues();
    const machines = summaryData.map(r => r[0]);

    const anomalyData = anomalySheet.getDataRange().getValues();
    anomalyData.shift();

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // Active anomaly window
    const activeAnomalies = anomalyData.filter(r => new Date(r[0]) >= tenMinutesAgo);

    for (let i = 0; i < machines.length; i++) {
        const machine = machines[i];
        const machineAnomalies = activeAnomalies.filter(r => r[1] === machine);
        const count = machineAnomalies.length;
        
        const row = i + 2;
        summarySheet.getRange(row, 8).setValue(count); // ActiveAnomalyCount
        summarySheet.getRange(row, 9).setValue(count > 0); // AnomalyFlag
    }
}

// Helper to get sensor config
function getSensorConfig(ss, sensorId = null) {
  const sheet = ss.getSheetByName('SensorConfig');
  const data = sheet.getDataRange().getValues();
  data.shift();
  if (sensorId) {
    const row = data.find(r => r[0] === sensorId);
    return row ? { id: row[0], machine: row[1], name: row[2], type: row[3] } : {};
  }
  return data;
}

// =================================================================
// 3.6 — TRIGGER SETUP
// =================================================================

function setupAnomalyTrigger() {
  // Delete existing triggers
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of existingTriggers) {
    if (trigger.getHandlerFunction() === 'runAnomalyCheck') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create new trigger
  ScriptApp.newTrigger('runAnomalyCheck')
      .timeBased()
      .everyMinutes(1)
      .create();
  Logger.log('Anomaly check trigger created to run every 1 minute.');
}
