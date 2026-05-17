# %% [markdown]
# # EM1 Isolation Forest Anomaly Detection Example
#
# This notebook-style Python script shows a simple unsupervised anomaly
# detection workflow for `EM1` using workbook data already included in this
# project.
#
# Goal:
# - detect unusual EM1 operating points using `IsolationForest`
# - compare anomaly flags against upcoming EM1 alarms for an early-warning view
#
# Data used:
# - `RawData`
# - `SensorData`
#
# Model used:
# - `IsolationForest`

# %%
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.metrics import ConfusionMatrixDisplay, classification_report, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


CURRENT_DIR = Path(__file__).resolve().parent if "__file__" in globals() else Path.cwd()
PROJECT_ROOT = CURRENT_DIR.parent if CURRENT_DIR.name == "notebooks" else CURRENT_DIR
WORKBOOK_PATH = PROJECT_ROOT / "AIM_MonitoringSystem.xlsx"
TARGET_MACHINE = "EM1"

print(f"Project root: {PROJECT_ROOT}")
print(f"Workbook path: {WORKBOOK_PATH}")


# %% [markdown]
# ## 1. Load workbook data

# %%
raw_df = pd.read_excel(WORKBOOK_PATH, sheet_name="RawData")
sensor_df = pd.read_excel(WORKBOOK_PATH, sheet_name="SensorData")

raw_df["Timestamp"] = pd.to_datetime(raw_df["Timestamp"], errors="coerce")
sensor_df["Timestamp"] = pd.to_datetime(sensor_df["Timestamp"], errors="coerce")

raw_df = raw_df.dropna(subset=["Timestamp"]).sort_values("Timestamp").reset_index(drop=True)
sensor_df = sensor_df.dropna(subset=["Timestamp"]).sort_values("Timestamp").reset_index(drop=True)

print("RawData rows:", len(raw_df))
print("SensorData rows:", len(sensor_df))


# %% [markdown]
# ## 2. Filter EM1 data only

# %%
raw_em1 = raw_df.loc[raw_df["Machine"] == TARGET_MACHINE].copy()
sensor_em1 = sensor_df.loc[sensor_df["Machine"] == TARGET_MACHINE].copy()

print("EM1 raw rows:", len(raw_em1))
print("EM1 sensor rows:", len(sensor_em1))
raw_em1.head()


# %% [markdown]
# ## 3. Build sensor snapshot features

# %%
sensor_snapshot = (
    sensor_em1.pivot_table(
        index="Timestamp",
        columns="SensorID",
        values="Value",
        aggfunc="last",
    )
    .sort_index()
    .reset_index()
)

sensor_snapshot.columns.name = None
sensor_snapshot.head()


# %% [markdown]
# ## 4. Merge machine data with sensor snapshots

# %%
raw_em1 = raw_em1.sort_values("Timestamp").reset_index(drop=True)
sensor_snapshot = sensor_snapshot.sort_values("Timestamp").reset_index(drop=True)

model_df = pd.merge_asof(
    raw_em1,
    sensor_snapshot,
    on="Timestamp",
    direction="backward",
)

print("Merged rows:", len(model_df))
model_df.head()


# %% [markdown]
# ## 5. Create anomaly-detection features and an upcoming-alarm label

# %%
model_df["CycleTime_lag1"] = model_df["CycleTime_sec"].shift(1)
model_df["CycleTime_lag2"] = model_df["CycleTime_sec"].shift(2)
model_df["CycleTime_roll3"] = model_df["CycleTime_sec"].rolling(window=3).mean()
model_df["RejectCount_lag1"] = model_df["RejectCount"].shift(1)
model_df["RejectCount_roll3"] = model_df["RejectCount"].rolling(window=3).mean()
model_df["Hour"] = model_df["Timestamp"].dt.hour
model_df["MinuteOfDay"] = model_df["Timestamp"].dt.hour * 60 + model_df["Timestamp"].dt.minute
model_df["IsAlarmNow"] = (model_df["Status"] == "alarm").astype(int)
model_df["IsRunningNow"] = (model_df["Status"] == "running").astype(int)
model_df["NextStatus_1"] = model_df["Status"].shift(-1)
model_df["NextStatus_2"] = model_df["Status"].shift(-2)
model_df["UpcomingAlarm_10min"] = (
    (model_df["NextStatus_1"] == "alarm") |
    (model_df["NextStatus_2"] == "alarm")
).astype(int)

sensor_feature_cols = [col for col in sensor_snapshot.columns if col != "Timestamp"]
base_feature_cols = [
    "CycleTime_sec",
    "CycleTime_lag1",
    "CycleTime_lag2",
    "CycleTime_roll3",
    "RejectCount",
    "RejectCount_lag1",
    "RejectCount_roll3",
    "Hour",
    "MinuteOfDay",
    "IsAlarmNow",
    "IsRunningNow",
]

feature_cols = [col for col in base_feature_cols + sensor_feature_cols if col in model_df.columns]
dataset = model_df[["Timestamp", "Status", "UpcomingAlarm_10min"] + feature_cols].dropna().copy()

print("Feature count:", len(feature_cols))
print("Dataset rows:", len(dataset))
feature_cols


# %% [markdown]
# ## 6. Train Isolation Forest

# %%
preprocessor = ColumnTransformer(
    transformers=[
        (
            "num",
            Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]
            ),
            feature_cols,
        )
    ]
)

model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "detector",
            IsolationForest(
                n_estimators=250,
                contamination=0.08,
                random_state=42,
            ),
        ),
    ]
)

model.fit(dataset[feature_cols])
anomaly_flag = model.predict(dataset[feature_cols])
anomaly_score = model.decision_function(dataset[feature_cols])

dataset["AnomalyFlag"] = anomaly_flag
dataset["AnomalyScore"] = anomaly_score
dataset["IsAnomaly"] = (dataset["AnomalyFlag"] == -1).astype(int)

print("Detected anomalies:", int(dataset["IsAnomaly"].sum()))
print("Anomaly ratio:", dataset["IsAnomaly"].mean())


# %% [markdown]
# ## 7. Review top detected anomalies

# %%
anomaly_rows = dataset.loc[dataset["IsAnomaly"] == 1].copy()
anomaly_rows = anomaly_rows.sort_values("AnomalyScore").reset_index(drop=True)
anomaly_rows[["Timestamp", "Status", "UpcomingAlarm_10min", "CycleTime_sec", "RejectCount", "AnomalyScore"]].head(15)


# %% [markdown]
# ## 8. Plot anomaly score over time

# %%
plt.figure(figsize=(14, 5))
plt.plot(dataset["Timestamp"], dataset["AnomalyScore"], label="Isolation Forest score", linewidth=2)
plt.scatter(
    dataset.loc[dataset["IsAnomaly"] == 1, "Timestamp"],
    dataset.loc[dataset["IsAnomaly"] == 1, "AnomalyScore"],
    color="red",
    label="Flagged anomaly",
    zorder=3,
)
plt.axhline(0, color="gray", linestyle="--", linewidth=1)
plt.title("EM1 Isolation Forest Anomaly Score")
plt.xlabel("Timestamp")
plt.ylabel("Decision score")
plt.grid(True, alpha=0.3)
plt.legend()
plt.tight_layout()
plt.show()


# %% [markdown]
# ## 9. Plot cycle time with anomaly markers

# %%
plt.figure(figsize=(14, 5))
plt.plot(dataset["Timestamp"], dataset["CycleTime_sec"], label="Cycle time", linewidth=2)
plt.scatter(
    dataset.loc[dataset["IsAnomaly"] == 1, "Timestamp"],
    dataset.loc[dataset["IsAnomaly"] == 1, "CycleTime_sec"],
    color="red",
    label="Flagged anomaly",
    zorder=3,
)
plt.title("EM1 Cycle Time with Isolation Forest Flags")
plt.xlabel("Timestamp")
plt.ylabel("Cycle Time (sec)")
plt.grid(True, alpha=0.3)
plt.legend()
plt.tight_layout()
plt.show()


# %% [markdown]
# ## 10. Compare anomaly rate by machine state

# %%
state_summary = (
    dataset.groupby("Status")["IsAnomaly"]
    .agg(["count", "sum", "mean"])
    .rename(columns={"count": "Rows", "sum": "AnomalyCount", "mean": "AnomalyRate"})
    .sort_values("AnomalyRate", ascending=False)
)

state_summary


# %% [markdown]
# ## 11. Evaluate early-warning behavior against upcoming alarms

# %%
evaluation_df = dataset.copy()
evaluation_df["PredictedWarning"] = evaluation_df["IsAnomaly"]

print(
    classification_report(
        evaluation_df["UpcomingAlarm_10min"],
        evaluation_df["PredictedWarning"],
        digits=4
    )
)
print(
    "ROC-AUC using inverted anomaly score as risk:",
    f"{roc_auc_score(evaluation_df['UpcomingAlarm_10min'], -evaluation_df['AnomalyScore']):.4f}"
)


# %% [markdown]
# ## 12. Confusion matrix for early warning

# %%
fig, ax = plt.subplots(figsize=(6, 5))
ConfusionMatrixDisplay.from_predictions(
    evaluation_df["UpcomingAlarm_10min"],
    evaluation_df["PredictedWarning"],
    display_labels=["No upcoming alarm", "Upcoming alarm in 10 min"],
    cmap="Oranges",
    ax=ax,
)
ax.set_title("EM1 Isolation Forest Early-Warning Confusion Matrix")
plt.tight_layout()
plt.show()


# %% [markdown]
# ## 13. Risk score view against future alarms

# %%
plt.figure(figsize=(14, 5))
plt.plot(
    evaluation_df["Timestamp"],
    -evaluation_df["AnomalyScore"],
    label="Isolation Forest risk score",
    linewidth=2,
)
plt.scatter(
    evaluation_df.loc[evaluation_df["UpcomingAlarm_10min"] == 1, "Timestamp"],
    (-evaluation_df.loc[evaluation_df["UpcomingAlarm_10min"] == 1, "AnomalyScore"]),
    color="darkred",
    label="Actual upcoming alarm within 10 min",
    zorder=3,
)
plt.title("EM1 Isolation Forest Risk vs Upcoming Alarm")
plt.xlabel("Timestamp")
plt.ylabel("Risk score")
plt.grid(True, alpha=0.3)
plt.legend()
plt.tight_layout()
plt.show()


# %% [markdown]
# ## Notes
#
# This is intentionally a simple example for GitHub and experimentation.
# Good next steps would be:
# - compare Isolation Forest flags with `AnomalyLog`
# - tune `contamination`, warning threshold, and feature set
# - score each sensor independently
# - use a longer prediction horizon such as 15 or 30 minutes
# - build a hybrid workflow with anomaly detection plus alarm classification
