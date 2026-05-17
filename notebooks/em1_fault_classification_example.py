# %% [markdown]
# # EM1 Fault / Alarm Classification Example
#
# This notebook-style Python script shows a simple classification workflow for
# `EM1` using the workbook data already included in this project.
#
# Goal:
# - predict whether the next EM1 machine state will be `alarm`
#
# Data used:
# - `RawData`
# - `SensorData`
#
# Model used:
# - `RandomForestClassifier`

# %%
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
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
raw_df.head()


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
# ## 4. Merge machine-level data with nearest sensor snapshot

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
# ## 5. Create classification target and simple features

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

# Predict whether the next row becomes an alarm state.
model_df["NextStatus"] = model_df["Status"].shift(-1)
model_df["Target_NextAlarm"] = (model_df["NextStatus"] == "alarm").astype(int)

model_df = model_df.dropna(subset=["NextStatus"]).reset_index(drop=True)
model_df.head()


# %% [markdown]
# ## 6. Choose features

# %%
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
target_col = "Target_NextAlarm"

dataset = model_df[["Timestamp"] + feature_cols + [target_col]].dropna().copy()

print("Feature count:", len(feature_cols))
print("Dataset rows:", len(dataset))
print("Alarm rate:", dataset[target_col].mean())
feature_cols


# %% [markdown]
# ## 7. Train/test split by time

# %%
split_index = int(len(dataset) * 0.8)
train_df = dataset.iloc[:split_index].copy()
test_df = dataset.iloc[split_index:].copy()

X_train = train_df[feature_cols]
y_train = train_df[target_col]
X_test = test_df[feature_cols]
y_test = test_df[target_col]

print("Train rows:", len(train_df))
print("Test rows:", len(test_df))
print("Train alarm rate:", y_train.mean())
print("Test alarm rate:", y_test.mean())


# %% [markdown]
# ## 8. Train a simple classification pipeline

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
            "classifier",
            RandomForestClassifier(
                n_estimators=250,
                max_depth=8,
                min_samples_leaf=2,
                class_weight="balanced",
                random_state=42,
            ),
        ),
    ]
)

model.fit(X_train, y_train)
pred_test = model.predict(X_test)
pred_proba_test = model.predict_proba(X_test)[:, 1]

print(classification_report(y_test, pred_test, digits=4))
print(f"ROC-AUC: {roc_auc_score(y_test, pred_proba_test):.4f}")


# %% [markdown]
# ## 9. Confusion matrix

# %%
fig, ax = plt.subplots(figsize=(6, 5))
ConfusionMatrixDisplay.from_predictions(
    y_test,
    pred_test,
    display_labels=["No Alarm", "Next Alarm"],
    cmap="Blues",
    ax=ax,
)
ax.set_title("EM1 Next-Alarm Confusion Matrix")
plt.tight_layout()
plt.show()


# %% [markdown]
# ## 10. Predicted alarm probability over time

# %%
results_df = pd.DataFrame(
    {
        "Timestamp": test_df["Timestamp"],
        "ActualNextAlarm": y_test.values,
        "PredictedAlarmProbability": pred_proba_test,
        "PredictedNextAlarm": pred_test,
    }
)

plt.figure(figsize=(14, 5))
plt.plot(
    results_df["Timestamp"],
    results_df["PredictedAlarmProbability"],
    label="Predicted probability of next alarm",
    linewidth=2,
)
plt.scatter(
    results_df.loc[results_df["ActualNextAlarm"] == 1, "Timestamp"],
    results_df.loc[results_df["ActualNextAlarm"] == 1, "PredictedAlarmProbability"],
    color="red",
    label="Actual next alarm",
    zorder=3,
)
plt.title("EM1 Next-Alarm Classification Probability")
plt.xlabel("Timestamp")
plt.ylabel("Probability")
plt.ylim(0, 1.05)
plt.grid(True, alpha=0.3)
plt.legend()
plt.tight_layout()
plt.show()


# %% [markdown]
# ## 11. Feature importance

# %%
rf_model = model.named_steps["classifier"]
importances = pd.Series(rf_model.feature_importances_, index=feature_cols).sort_values(ascending=False)

top_n = 12
plt.figure(figsize=(10, 6))
importances.head(top_n).sort_values().plot(kind="barh")
plt.title("Top Feature Importances for EM1 Next Alarm Classification")
plt.xlabel("Importance")
plt.tight_layout()
plt.show()

importances.head(top_n)


# %% [markdown]
# ## 12. Latest-row example prediction

# %%
latest_row = dataset.iloc[[-1]][feature_cols]
next_alarm_probability = model.predict_proba(latest_row)[0, 1]
next_alarm_prediction = model.predict(latest_row)[0]

print("Latest EM1 feature row timestamp:", dataset.iloc[-1]["Timestamp"])
print(f"Predicted probability of next alarm: {next_alarm_probability:.4f}")
print("Predicted next state alarm flag:", int(next_alarm_prediction))


# %% [markdown]
# ## Notes
#
# This is intentionally a simple example for GitHub and experimentation.
# Good next steps would be:
# - classify specific EM1 alarm codes instead of only alarm/non-alarm
# - predict alarms several steps ahead
# - add anomaly-derived features from `AnomalyLog`
# - compare classifier performance against gradient boosting models
