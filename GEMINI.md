# AIM Monitoring Dashboard — Build Instructions for Gemini

**Project:** IoT-Based Smart Monitoring, Data Historian and AI-Assisted Anomaly Detection
**Company:** AIM Automation Solution Sdn. Bhd.
**Machines:** EM1, EM2, EM3, EM4 (sequential production line)
**Platform:** Google Apps Script + Google Sheets + Google Looker Studio
**Mode:** Prototype with simulated data (no industrial PC required)
**AI Method:** Rule-based detection + Modified Isolation Forest-inspired anomaly scoring
**Machine-health parameters:** Temperature, pressure, current, vibration and speed

---

> **How to use this guide**
> Give Gemini one step at a time.
> Wait for Gemini to finish and confirm it is done.
> Then paste the next step.
> Do not skip steps — each step depends on the one before it.

---

## Key Modification Added

This version includes the AI method discussed in the proposal development:

- Machine-health monitoring using **temperature, pressure, current, vibration and speed**.
- Early breakdown prediction using **rule-based detection** and **Modified Isolation Forest-inspired anomaly scoring**.
- Configurable variables for feature weighting, time-window size, anomaly thresholds and contamination rate.
- Dashboard support for risk score, warning/critical alerts and engineer feedback.

---


## STEP 1 — Create Google Spreadsheet and All Sheet Tabs

Paste this to Gemini:

---

I am building an IoT machine monitoring dashboard using Google Sheets and Google Apps Script.
The system monitors 4 industrial machines: EM1, EM2, EM3 and EM4.

**Task:** Help me create a Google Spreadsheet named `AIM_MonitoringSystem` with the following tabs and column headers.

Create these tabs in order:

**Tab 1: `RawData`**
Columns:
```
Timestamp | Machine | Status | CycleTime_sec | AlarmCode | AlarmMessage | RejectCount | Notes
```

**Tab 2: `SensorData`**
Columns:
```
Timestamp | Machine | SensorID | SensorName | SensorType | Value | Unit | Status
```

**Tab 3: `SensorConfig`**
Columns:
```
SensorID | Machine | SensorName | SensorType | Unit | WarnThreshold | CriticalThreshold | Direction | Active
```
Pre-fill with these rows:

| SensorID | Machine | SensorName | SensorType | Unit | WarnThreshold | CriticalThreshold | Direction | Active |
|---|---|---|---|---|---|---|---|---|
| EM1_TEMP_01 | EM1 | Heater_Zone1 | Temperature | °C | 220 | 250 | above | TRUE |
| EM1_TEMP_02 | EM1 | Heater_Zone2 | Temperature | °C | 220 | 250 | above | TRUE |
| EM1_PRES_01 | EM1 | Clamp_Pressure | Pressure | bar | 2.8 | 2.2 | below | TRUE |
| EM1_CURR_01 | EM1 | Heater_Current | Current | A | 8.0 | 10.0 | above | TRUE |
| EM1_VIBR_01 | EM1 | Stacker_Vibration | Vibration | mm/s | 4.5 | 7.0 | above | TRUE |
| EM1_SPED_01 | EM1 | Stack_Actuator_Speed | Speed | mm/s | 80 | 60 | below | TRUE |
| EM1_POSN_01 | EM1 | Stack_Position | Position | mm | 0.5 | 1.0 | above | TRUE |
| EM2_LASR_01 | EM2 | Laser_Power | Power | W | 350 | 400 | above | TRUE |
| EM2_TEMP_01 | EM2 | Weld_Temperature | Temperature | °C | 300 | 380 | above | TRUE |
| EM2_CURR_01 | EM2 | Weld_Head_Current | Current | A | 6.5 | 8.0 | above | TRUE |
| EM2_VIBR_01 | EM2 | Weld_Head_Vibration | Vibration | mm/s | 4.0 | 6.5 | above | TRUE |
| EM2_SPED_01 | EM2 | Transfer_Speed | Speed | mm/s | 90 | 70 | below | TRUE |
| EM2_VISN_01 | EM2 | Vision_Result | Vision | % | 95 | 90 | below | TRUE |
| EM2_REJT_01 | EM2 | Reject_Count | Count | pcs | 5 | 10 | above | TRUE |
| EM3_TEMP_01 | EM3 | Solder_Temperature | Temperature | °C | 260 | 300 | above | TRUE |
| EM3_PRES_01 | EM3 | Insert_Pressure | Pressure | bar | 2.8 | 2.0 | below | TRUE |
| EM3_CURR_01 | EM3 | Inserter_Motor_Current | Current | A | 5.5 | 7.0 | above | TRUE |
| EM3_VIBR_01 | EM3 | Inserter_Vibration | Vibration | mm/s | 4.5 | 7.0 | above | TRUE |
| EM3_SPED_01 | EM3 | Insertion_Speed | Speed | mm/s | 75 | 55 | below | TRUE |
| EM3_FORC_01 | EM3 | Insertion_Force | Force | N | 15 | 20 | above | TRUE |
| EM3_POSN_01 | EM3 | Wafer_Position | Position | mm | 0.3 | 0.8 | above | TRUE |
| EM4_VISN_01 | EM4 | Final_Vision_Score | Vision | % | 95 | 90 | below | TRUE |
| EM4_LASR_01 | EM4 | Mark_Laser_Power | Power | W | 280 | 320 | above | TRUE |
| EM4_CURR_01 | EM4 | Marking_Head_Current | Current | A | 5.0 | 6.5 | above | TRUE |
| EM4_VIBR_01 | EM4 | Final_Handler_Vibration | Vibration | mm/s | 4.0 | 6.5 | above | TRUE |
| EM4_SPED_01 | EM4 | Final_Transfer_Speed | Speed | mm/s | 85 | 65 | below | TRUE |
| EM4_MARK_01 | EM4 | Mark_Quality | Vision | % | 97 | 93 | below | TRUE |
| EM4_REJT_01 | EM4 | Final_Reject_Count | Count | pcs | 3 | 8 | above | TRUE |

**Tab 4: `AlarmLog`**
Columns:
```
Timestamp | Machine | AlarmCode | AlarmMessage | ResolvedAt | Duration_min | ResolvedBy
```

**Tab 5: `DowntimeLog`**
Columns:
```
Timestamp | Machine | DowntimeStart | DowntimeEnd | Duration_min | Reason | ResolvedBy
```

**Tab 6: `AnomalyLog`**
Columns:
```
Timestamp | Machine | SensorID | SensorName | AnomalyType | Description | Value | Threshold | RiskScore | AlertSent | EngineerFeedback
```

**Tab 7: `MachineSummary`**
Columns:
```
Machine | LastUpdated | Status | CycleTime_sec | LastAlarm | TodayDowntime_min | TodayRejectCount | ActiveAnomalyCount | AnomalyFlag
```
Pre-fill 4 rows with Machine = EM1, EM2, EM3, EM4. Leave other columns empty for now.

**Tab 8: `Config`**
Columns: `Parameter | Value`
Pre-fill with:
```
CycleTime_Warning_sec       | 5.5
CycleTime_Critical_sec      | 7.0
AlarmRepeat_Threshold       | 3
AlarmRepeat_Window_min      | 10
MaxDowntime_min             | 30
NoSignal_Timeout_min        | 5
SensorDrift_Percent         | 25
IForest_WindowSize          | 30
IForest_Contamination       | 0.10
IForest_WarningScore        | 0.60
IForest_CriticalScore       | 0.80
Weight_Temperature          | 1.20
Weight_Pressure             | 1.10
Weight_Current              | 1.30
Weight_Vibration            | 1.50
Weight_Speed                | 1.20
Weight_CycleTime            | 1.00
Weight_AlarmFrequency       | 1.00
Weight_Downtime             | 1.00
Weight_RejectRate           | 1.00
DataRetention_days          | 90
Alert_Email_1               | engineer@company.com
Alert_Email_2               | manager@company.com
DailyReport_Hour            | 8
```

Give me step-by-step instructions to create this spreadsheet in Google Sheets, including how to create tabs, add headers and pre-fill the data.

---

> **When Gemini finishes Step 1:**
> Create the spreadsheet in Google Sheets following Gemini's instructions.
> Make sure all 8 tabs exist with correct headers and pre-filled data.
> When done, come back and paste **Step 2**.

---

## STEP 2 — Apps Script: Web App to Receive PLC Data

Paste this to Gemini:

---

I have a Google Spreadsheet named `AIM_MonitoringSystem` with these tabs:
RawData, SensorData, SensorConfig, AlarmLog, DowntimeLog, AnomalyLog, MachineSummary, Config.

**Task:** Write Google Apps Script code for a file named `receiver.gs`.

Write a `doPost(e)` function that does the following:

1. Parses incoming JSON from an HTTP POST request
2. Expected JSON format:
```json
{
  "machine": "EM1",
  "status": "running",
  "cycle_time": 4.2,
  "alarm_code": "AL001",
  "alarm_message": "Pressure low",
  "reject_count": 2,
  "timestamp": "2026-05-14T08:30:00",
  "sensors": [
    { "sensor_id": "EM1_TEMP_01", "value": 215.3 },
    { "sensor_id": "EM1_PRES_01", "value": 4.2 }
  ]
}
```
3. Appends one row to `RawData` with machine-level fields
4. For each sensor in the `sensors` array:
   - Looks up `SensorConfig` to get SensorName, SensorType, Unit, WarnThreshold, CriticalThreshold, Direction
   - Calculates Status:
     - Direction = `above`: normal if below WarnThreshold, warning if between warn and critical, critical if above CriticalThreshold
     - Direction = `below`: normal if above WarnThreshold, warning if between warn and critical, critical if below CriticalThreshold
   - Appends one row to `SensorData`
5. If `alarm_code` is not empty, appends one row to `AlarmLog`
6. Updates the matching machine row in `MachineSummary` with: LastUpdated, Status, CycleTime_sec, LastAlarm, TodayRejectCount
7. Returns JSON response `{"status": "ok"}` on success
8. Returns JSON response `{"status": "error", "message": "..."}` on failure
9. Wraps everything in try-catch

Also write a helper function `getConfigValue(param)` that reads a value from the `Config` tab by parameter name.

---

> **When Gemini finishes Step 2:**
> Open your Google Spreadsheet.
> Go to Extensions → Apps Script.
> Create a new file named `receiver.gs`.
> Paste the code Gemini gave you.
> Save the file.
> When done, come back and paste **Step 3**.

---

## STEP 3 — Apps Script: Rule-Based + Modified Isolation Forest Anomaly Detection Engine

Paste this to Gemini:

---

I am continuing to build my Google Apps Script project for `AIM_MonitoringSystem`.
I already have `receiver.gs` with a `doPost` function and a `getConfigValue` helper.

**Task:** Write code for a new file named `anomaly.gs`.

The anomaly engine must use two approaches:

1. **Baseline rule-based detection** for clear engineering limits.
2. **Modified Isolation Forest-inspired anomaly scoring** for early machine breakdown prediction using temperature, pressure, current, vibration, speed, cycle time, alarm frequency, downtime duration and reject rate.

Important note: Google Apps Script does not have a built-in machine learning library. Therefore, implement a lightweight Isolation Forest-inspired method manually using feature normalisation, weighted features, random subspace scoring and time-window comparison. The function should be practical and easy to run inside Apps Script.

---

### 3.1 — Main function

Write a function `runAnomalyCheck()` that performs all checks below.

---

### 3.2 — Rule-based anomaly checks

**Rule 1 — Sensor Warning**
Read `SensorData`. For each row in the last 5 minutes where Status = `warning`:
Log to `AnomalyLog` with:
- AnomalyType = `SensorWarning`
- RiskScore = 0.5

**Rule 2 — Sensor Critical**
For each row in the last 5 minutes where Status = `critical`:
Log to `AnomalyLog` with:
- AnomalyType = `SensorCritical`
- RiskScore = 0.9

**Rule 3 — Sensor Value Drift**
For each unique SensorID in `SensorData`, compare the latest value to the average of the last 30 readings for that sensor.
If deviation is more than `SensorDrift_Percent` from `Config`:
Log to `AnomalyLog` with:
- AnomalyType = `SensorDrift`
- RiskScore = 0.6

**Rule 4 — Cycle Time Warning**
Read `RawData`. For each machine, if latest CycleTime_sec > `CycleTime_Warning_sec` from Config:
Log to `AnomalyLog` with:
- AnomalyType = `CycleTimeWarning`
- RiskScore = 0.5

**Rule 5 — Cycle Time Critical**
If latest CycleTime_sec > `CycleTime_Critical_sec` from Config:
Log to `AnomalyLog` with:
- AnomalyType = `CycleTimeCritical`
- RiskScore = 0.9

**Rule 6 — Repeated Alarm**
Read `AlarmLog`. For each machine, if the same AlarmCode appears more than `AlarmRepeat_Threshold` times within the last `AlarmRepeat_Window_min` minutes:
Log to `AnomalyLog` with:
- AnomalyType = `RepeatedAlarm`
- RiskScore = 0.8

**Rule 7 — Machine Not Responding**
Read `MachineSummary`. If LastUpdated is more than `NoSignal_Timeout_min` minutes ago and Status was `running`:
Log to `AnomalyLog` with:
- AnomalyType = `NoSignal`
- RiskScore = 1.0

---

### 3.3 — Modified Isolation Forest-inspired anomaly scoring

Write a function `runModifiedIsolationForest()` and call it inside `runAnomalyCheck()`.

For each machine EM1–EM4:

1. Read the latest machine and sensor data.
2. Build a feature vector:

```text
x = [
  Temperature,
  Pressure,
  Current,
  Vibration,
  Speed,
  CycleTime,
  AlarmFrequency,
  DowntimeDuration,
  RejectRate
]
```

3. Use configurable feature weights from `Config`:

```text
Weight_Temperature
Weight_Pressure
Weight_Current
Weight_Vibration
Weight_Speed
Weight_CycleTime
Weight_AlarmFrequency
Weight_Downtime
Weight_RejectRate
```

4. Calculate a baseline for each feature using the last `IForest_WindowSize` readings.
5. Normalise each latest feature value against its baseline:

```text
normalisedDeviation = abs(latestValue - baselineAverage) / baselineStandardDeviation
```

If standard deviation is zero, use a small value such as 0.0001 to avoid division by zero.

6. Apply feature weighting:

```text
weightedDeviation = normalisedDeviation * featureWeight
```

7. Calculate the Isolation Forest-inspired risk score using random feature subsets:

- Create 50 random subspaces.
- Each subspace randomly selects 3 to 5 features from the feature vector.
- For each subspace, calculate the average weighted deviation.
- Convert the deviation into a score between 0 and 1 using:

```text
subspaceScore = 1 - exp(-averageWeightedDeviation / 3)
```

8. The final risk score is the average of all subspace scores.
9. If the final score is:

```text
score >= IForest_CriticalScore  → AnomalyType = IForestCritical
score >= IForest_WarningScore   → AnomalyType = IForestWarning
otherwise                       → no anomaly logged
```

10. Log the result to `AnomalyLog` with:

```text
Timestamp | Machine | SensorID | SensorName | AnomalyType | Description | Value | Threshold | RiskScore | AlertSent | EngineerFeedback
```

Use:
- SensorID = `IFOREST_MODEL`
- SensorName = `Modified_Isolation_Forest`
- Description = explain which top 3 features contributed most to the risk score
- Value = final risk score
- Threshold = warning or critical threshold used

---

### 3.4 — What the modified model must study

Add clear comments in the code explaining that the modified Isolation Forest approach allows the project to study:

1. **Feature selection** — which features are most useful for early breakdown detection.
2. **Sensor weighting** — which sensors should have stronger influence on the risk score.
3. **Machine-specific baseline** — each machine may require a different normal behaviour profile.
4. **Time-window analysis** — abnormal patterns may appear gradually before machine stoppage.
5. **Threshold optimisation** — warning and critical thresholds can be tuned to reduce false alerts.
6. **Hybrid rule-based and AI detection** — engineering rules can be combined with AI scores.
7. **Engineer feedback loop** — engineer confirmation can be used to improve the model later.

---

### 3.5 — Duplicate prevention and MachineSummary update

After all checks:

- Update `ActiveAnomalyCount` and `AnomalyFlag` in `MachineSummary` for each machine.
- Avoid duplicate anomaly entries: before logging, check if the same Machine + SensorID + AnomalyType was already logged in the last 10 minutes.
- Call `sendAlerts()` at the end. This function will be written in the next step.

---

### 3.6 — Trigger setup

Also write a function `setupAnomalyTrigger()` that:

- Deletes any existing trigger for `runAnomalyCheck`.
- Creates a new time-driven trigger to run `runAnomalyCheck` every 1 minute.

---

> **When Gemini finishes Step 3:**
> In Apps Script, create a new file named `anomaly.gs`.
> Paste the code.
> Save the file.
> Do not run it yet — the `sendAlerts` function it calls does not exist yet.
> When done, come back and paste **Step 4**.

---

## STEP 4 — Apps Script: Alert Notification

Paste this to Gemini:

---

I am continuing to build my Google Apps Script project for `AIM_MonitoringSystem`.
I have `receiver.gs` and `anomaly.gs` already.

**Task:** Write code for a new file named `alerts.gs`.

Write a function `sendAlerts()` that:

1. Reads all rows in `AnomalyLog` where `AlertSent` column is empty or FALSE
2. Groups unalerted anomalies by machine
3. For each machine that has unalerted anomalies:
   - Gets all alert emails from Config (Alert_Email_1, Alert_Email_2)
   - Builds an HTML email:
     - Subject: `[AIM ALERT] {MachineName} — {count} Anomaly Detected`
     - Body: HTML table listing each anomaly with columns: SensorName, AnomalyType, Value, Threshold, RiskScore, Timestamp
     - Color code the RiskScore cell: green if < 0.5, yellow if 0.5–0.8, red if > 0.8
     - Include a line at the bottom: "View full dashboard: {spreadsheet URL}"
   - Sends the email using `GmailApp.sendEmail()` with htmlBody option
4. Marks `AlertSent = TRUE` and writes current timestamp in the AlertSent column for all rows that were sent

Also write a function `sendDailyReport()` that:
1. Collects yesterday's data for each machine (EM1–EM4):
   - Total downtime minutes from `DowntimeLog`
   - Total alarm count from `AlarmLog`
   - Total anomaly count from `AnomalyLog`
   - Average cycle time from `RawData`
   - Any sensors that had warning or critical status from `SensorData`
2. Builds one HTML email with a summary table showing all 4 machines side by side
3. Highlights machines with AnomalyFlag = TRUE in red
4. Sends to all emails in Config

Also write a function `setupDailyReportTrigger()` that:
- Deletes any existing trigger for `sendDailyReport`
- Creates a time-driven trigger to run `sendDailyReport` every day at the hour set in Config → DailyReport_Hour

---

> **When Gemini finishes Step 4:**
> Create a new file named `alerts.gs` in Apps Script.
> Paste the code.
> Save the file.
> When done, come back and paste **Step 5**.

---

## STEP 5 — Apps Script: Data Cleanup

Paste this to Gemini:

---

I am continuing to build my Google Apps Script project for `AIM_MonitoringSystem`.
I have `receiver.gs`, `anomaly.gs` and `alerts.gs` already.

**Task:** Write code for a new file named `maintenance.gs`.

Write a function `cleanOldData()` that:
1. Reads `DataRetention_days` value from `Config` tab
2. Calculates the cutoff date = today minus DataRetention_days
3. Deletes all rows in `RawData` where Timestamp is older than the cutoff date
4. Deletes all rows in `SensorData` where Timestamp is older than the cutoff date
5. Does NOT delete anything from `AlarmLog`, `DowntimeLog` or `AnomalyLog` — these are kept permanently
6. Logs how many rows were deleted using `Logger.log()`

Also write a function `setupCleanupTrigger()` that:
- Deletes any existing trigger for `cleanOldData`
- Creates a weekly time-driven trigger to run `cleanOldData` every Sunday at midnight

---

> **When Gemini finishes Step 5:**
> Create a new file named `maintenance.gs` in Apps Script.
> Paste the code.
> Save the file.
> When done, come back and paste **Step 6**.

---

## STEP 6 — Apps Script: Auto Simulator (Main Data Source for Prototype)

Paste this to Gemini:

---

I am building a prototype for an IoT monitoring dashboard using Google Apps Script and Google Sheets (`AIM_MonitoringSystem`).
There is no industrial PC connected yet. All data must be generated by a simulator inside Apps Script.

I have these files already: `receiver.gs`, `anomaly.gs`, `alerts.gs`, `maintenance.gs`.

**Task:** Write code for a new file named `simulator.gs`.

---

**6.1 — Define constants at the top of the file:**

Sensor normal ranges:
```javascript
const SENSOR_RANGES = {
  EM1_TEMP_01: { min: 200, max: 225 },
  EM1_TEMP_02: { min: 198, max: 222 },
  EM1_PRES_01: { min: 3.2, max: 4.8 },
  EM1_CURR_01: { min: 6.0, max: 7.5 },
  EM1_VIBR_01: { min: 1.0, max: 3.2 },
  EM1_SPED_01: { min: 90,  max: 120 },
  EM1_POSN_01: { min: 0.05, max: 0.35 },

  EM2_LASR_01: { min: 290, max: 340 },
  EM2_TEMP_01: { min: 250, max: 295 },
  EM2_CURR_01: { min: 4.5, max: 6.0 },
  EM2_VIBR_01: { min: 1.0, max: 3.0 },
  EM2_SPED_01: { min: 95,  max: 125 },
  EM2_VISN_01: { min: 96,  max: 99.5 },
  EM2_REJT_01: { min: 0,   max: 3 },

  EM3_TEMP_01: { min: 235, max: 258 },
  EM3_PRES_01: { min: 3.0, max: 4.3 },
  EM3_CURR_01: { min: 3.8, max: 5.0 },
  EM3_VIBR_01: { min: 1.2, max: 3.4 },
  EM3_SPED_01: { min: 85,  max: 115 },
  EM3_FORC_01: { min: 8,   max: 13 },
  EM3_POSN_01: { min: 0.05, max: 0.25 },

  EM4_VISN_01: { min: 96,  max: 99.8 },
  EM4_LASR_01: { min: 250, max: 275 },
  EM4_CURR_01: { min: 3.5, max: 4.8 },
  EM4_VIBR_01: { min: 1.0, max: 3.0 },
  EM4_SPED_01: { min: 90,  max: 120 },
  EM4_MARK_01: { min: 97.5, max: 99.9 },
  EM4_REJT_01: { min: 0,   max: 2 }
};
```

Machine normal cycle time ranges:
```javascript
const CYCLE_TIMES = {
  EM1: { min: 3.8, max: 4.5 },
  EM2: { min: 4.2, max: 5.0 },
  EM3: { min: 3.5, max: 4.2 },
  EM4: { min: 4.0, max: 4.8 }
};
```

Fault scenarios list:
```javascript
const FAULT_SCENARIOS = [
  {
    name: "EM1_Overheat",
    machine: "EM1",
    sensors: { EM1_TEMP_01: 248, EM1_TEMP_02: 245, EM1_CURR_01: 9.3 },
    alarm: { code: "AL001", message: "Heater Zone overtemperature" },
    cycleTime: 6.8
  },
  {
    name: "EM1_PressureLow",
    machine: "EM1",
    sensors: { EM1_PRES_01: 2.1, EM1_SPED_01: 58 },
    alarm: { code: "AL002", message: "Clamp pressure low" },
    cycleTime: 5.8
  },
  {
    name: "EM1_MechanicalVibration",
    machine: "EM1",
    sensors: { EM1_VIBR_01: 7.4, EM1_CURR_01: 9.8, EM1_SPED_01: 62 },
    alarm: { code: "AL003", message: "Stacker vibration and load abnormal" },
    cycleTime: 7.0
  },
  {
    name: "EM2_LaserSpike",
    machine: "EM2",
    sensors: { EM2_LASR_01: 395, EM2_TEMP_01: 375, EM2_CURR_01: 7.5 },
    alarm: { code: "AL010", message: "Laser power out of range" },
    cycleTime: 7.2
  },
  {
    name: "EM2_VisionFail",
    machine: "EM2",
    sensors: { EM2_VISN_01: 88, EM2_REJT_01: 12 },
    alarm: { code: "AL011", message: "Vision inspection failure rate high" },
    cycleTime: 5.5
  },
  {
    name: "EM2_TransferSpeedDrop",
    machine: "EM2",
    sensors: { EM2_SPED_01: 60, EM2_VIBR_01: 6.8, EM2_CURR_01: 8.2 },
    alarm: { code: "AL012", message: "Transfer speed unstable with high vibration" },
    cycleTime: 6.6
  },
  {
    name: "EM3_SolderOverheat",
    machine: "EM3",
    sensors: { EM3_TEMP_01: 298, EM3_PRES_01: 2.1, EM3_CURR_01: 6.6 },
    alarm: { code: "AL020", message: "Solder temperature critical" },
    cycleTime: 6.5
  },
  {
    name: "EM3_InsertionForce",
    machine: "EM3",
    sensors: { EM3_FORC_01: 21, EM3_VIBR_01: 7.2, EM3_SPED_01: 50 },
    alarm: { code: "AL021", message: "Insertion force exceeded limit" },
    cycleTime: 5.9
  },
  {
    name: "EM4_FinalRejectHigh",
    machine: "EM4",
    sensors: { EM4_VISN_01: 91, EM4_REJT_01: 9 },
    alarm: { code: "AL030", message: "Final inspection reject rate high" },
    cycleTime: 5.2
  },
  {
    name: "EM4_MarkQualityLow",
    machine: "EM4",
    sensors: { EM4_MARK_01: 91.5, EM4_LASR_01: 315, EM4_CURR_01: 6.2 },
    alarm: { code: "AL031", message: "Mark quality below threshold" },
    cycleTime: 5.7
  },
  {
    name: "EM4_HandlerVibration",
    machine: "EM4",
    sensors: { EM4_VIBR_01: 7.0, EM4_SPED_01: 57, EM4_CURR_01: 6.8 },
    alarm: { code: "AL032", message: "Final handler vibration and speed abnormal" },
    cycleTime: 6.4
  }
];
```

---

**6.2 — Write the main function `runSimulator()`:**

For each machine (EM1, EM2, EM3, EM4):

1. Roll a random number to decide the machine mode:
   - 80% → normal operation
   - 12% → fault (pick a random fault scenario for this machine from FAULT_SCENARIOS)
   - 5% → idle (status = `idle`, skip sensor and alarm writing)
   - 3% → downtime (status = `stopped`, write one row to DowntimeLog with random duration 5–20 min, skip sensor writing)

2. Generate sensor values:
   - Normal mode: random float between SENSOR_RANGES min and max for each sensor of this machine
   - Fault mode: use the fault scenario sensor values for affected sensors, random normal values for others

3. Generate cycle time:
   - Normal: random float between CYCLE_TIMES min and max
   - Fault: use the fault scenario cycleTime value

4. Write one row to `RawData`

5. For each sensor of this machine (normal or fault mode only):
   - Look up SensorConfig to get SensorName, SensorType, Unit, WarnThreshold, CriticalThreshold, Direction
   - Calculate Status using same logic as in `receiver.gs`
   - Write one row to `SensorData`

6. If alarm code is not empty, write one row to `AlarmLog`

7. Update the machine row in `MachineSummary`

After all 4 machines are processed, call `runAnomalyCheck()` so the rule-based and Modified Isolation Forest-inspired anomaly engine can update `AnomalyLog`.

---

**6.3 — Write trigger management functions:**

`startSimulator()`:
- Deletes any existing trigger for `runSimulator`
- Creates a new time-driven trigger to run `runSimulator` every 1 minute
- Shows a spreadsheet toast: "Simulator started. Data will update every minute."

`stopSimulator()`:
- Finds and deletes the trigger for `runSimulator`
- Shows a spreadsheet toast: "Simulator stopped."

---

**6.4 — Write `seedHistoricalData()`:**

This function generates 7 days of past data so the dashboard has historical charts from day one.

1. Calculate start time = 7 days ago from now
2. Loop from start time to now in 5-minute intervals
3. For each interval timestamp, run the same logic as `runSimulator()` but use the interval timestamp instead of now
4. Write all rows to RawData, SensorData, AlarmLog, DowntimeLog with the historical timestamp
5. After the loop finishes, update MachineSummary with the latest values
6. Show a spreadsheet toast when complete: "7 days of historical data seeded successfully."

Note: This will write a large number of rows. Use batch writes (collect all rows in an array first, then write all at once using `sheet.getRange(...).setValues(...)`) instead of writing row by row, to avoid timeout.

---

> **When Gemini finishes Step 6:**
> Create a new file named `simulator.gs` in Apps Script.
> Paste the code.
> Save the file.
> Do not run anything yet.
> When done, come back and paste **Step 7**.

---

## STEP 7 — Deploy Web App and Set Up All Triggers

Paste this to Gemini:

---

I have finished writing all my Google Apps Script files:
`receiver.gs`, `anomaly.gs`, `alerts.gs`, `maintenance.gs`, `simulator.gs`

**Task:** Give me step-by-step instructions to:

1. Deploy the Apps Script project as a Web App:
   - Execute as: Me
   - Who has access: Anyone
   - Copy and save the Web App URL after deploying

2. Run these setup functions one by one from the Apps Script editor (tell me the exact steps to run a function manually):
   - `setupAnomalyTrigger` — sets anomaly check to run every 1 minute
   - `setupDailyReportTrigger` — sets daily report email at 8am
   - `setupCleanupTrigger` — sets weekly data cleanup on Sunday

3. Run `seedHistoricalData` to populate 7 days of past data

4. Run `startSimulator` to begin live data generation every minute

5. Verify the system is working by checking:
   - New rows are appearing in `RawData` and `SensorData` every minute
   - `MachineSummary` is being updated
   - `AnomalyLog` has entries after a few minutes
   - Alert emails are being received

---

> **When Gemini finishes Step 7:**
> Follow Gemini's instructions to deploy and set up the triggers.
> Run `seedHistoricalData` first, then `startSimulator`.
> Wait 3–5 minutes and check that data is appearing in the sheets.
> When confirmed working, come back and paste **Step 8**.

---

## STEP 8 — Build Google Looker Studio Dashboard

Paste this to Gemini:

---

My Google Sheets data source (`AIM_MonitoringSystem`) is now live and receiving data from a simulator.

**Task:** Give me step-by-step instructions to build a Google Looker Studio dashboard connected to this spreadsheet.

Build these 6 pages:

---

**Page 1 — Live Machine Overview**
- Page title: "Live Machine Overview"
- 4 scorecards in a row: one per machine (EM1, EM2, EM3, EM4) showing current Status from `MachineSummary`
  - Color: green if Status = running, red if Status = stopped or alarm, grey if idle
- 4 scorecards below showing CycleTime_sec per machine
- One summary table showing all columns from `MachineSummary`
- Machines with AnomalyFlag = TRUE should be highlighted red in the table

---

**Page 2 — Sensor Monitor**
- Page title: "Sensor Monitor"
- Date range filter at the top
- Machine filter (EM1, EM2, EM3, EM4)
- SensorType filter (Temperature, Pressure, Current, Vibration, Speed, Power, Vision, Force, Position, Count)
- Line chart: sensor Value over time, colored by SensorID — data from `SensorData`
- Table below: latest sensor readings showing SensorName, Value, Unit, Status — color Status cell green/yellow/red
- Note: add reference lines on the line chart for WarnThreshold and CriticalThreshold values

---

**Page 3 — Downtime Analysis**
- Page title: "Downtime Analysis"
- Date range filter
- Machine filter
- Bar chart: total downtime minutes per machine for selected period — data from `DowntimeLog`
- Line chart: downtime trend over time (daily total per machine)
- Table: full `DowntimeLog` filterable by machine and date

---

**Page 4 — Alarm History**
- Page title: "Alarm History"
- Date range filter
- Machine filter
- Bar chart: alarm count per machine — data from `AlarmLog`
- Pie chart: top 5 most frequent AlarmCode values
- Table: full `AlarmLog` sorted by Timestamp descending

---

**Page 5 — Anomaly and AI Alerts**
- Page title: "Anomaly and AI Alerts"
- Date range filter
- Machine filter
- AnomalyType filter including SensorWarning, SensorCritical, SensorDrift, CycleTimeWarning, CycleTimeCritical, RepeatedAlarm, NoSignal, IForestWarning and IForestCritical
- Table: full `AnomalyLog` with RiskScore color coded — green if < 0.5, yellow if 0.5–0.8, red if > 0.8
- Bar chart: anomaly count per machine per day
- Scorecard: total anomalies today

---

**Page 6 — Cycle Time Trend**
- Page title: "Cycle Time Trend"
- Date range filter
- Machine filter
- Line chart: CycleTime_sec over time for all 4 machines on one chart — data from `RawData`
- Add two reference lines: one at CycleTime_Warning_sec = 5.5, one at CycleTime_Critical_sec = 7.0
- Table below: latest cycle times per machine with color coding

---

Give me step-by-step instructions to:
1. Open Google Looker Studio and create a new report
2. Connect to the Google Sheets data source
3. Build each page with the charts and tables described above
4. How to add filters, scorecards, and reference lines

---

> **When Gemini finishes Step 8:**
> Follow Gemini's instructions to build the Looker Studio dashboard.
> Connect each chart to the correct sheet tab.
> Test all filters and make sure data appears correctly.
> When all 6 pages are done and working, the prototype is complete.

---

## Prototype Complete

At this point you have:

- Google Sheets acting as the data historian with 8 structured tabs
- Apps Script automatically generating simulated data every minute for all 4 machines
- Anomaly detection running every minute with 7 rule-based checks and Modified Isolation Forest-inspired scoring
- Email alerts sent automatically when anomalies are detected
- Daily summary report sent every morning at 8am
- Looker Studio dashboard with 6 pages of live charts

**Next phase (when ready for real machines):**
Replace `simulator.gs` data generation with a Python script (`gateway.py`) running on the industrial PC that reads real PLC and sensor data via Ethernet/IP or OPC-UA and POSTs to the Apps Script Web App URL. The rest of the system stays the same, including dashboard, historian, alerts and Modified Isolation Forest-inspired anomaly scoring.
