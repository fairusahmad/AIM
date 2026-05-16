
import pandas as pd
from sklearn.ensemble import IsolationForest
import matplotlib.pyplot as plt
import warnings

# Suppress potential warnings from plotting
warnings.filterwarnings('ignore', category=UserWarning, module='matplotlib')

# --- Configuration ---
# This is the file you downloaded from Google Sheets
CSV_FILE_PATH = 'sensordata.csv' 
# We will focus on one sensor for this demonstration
TARGET_SENSOR_ID = 'EM1_TEMP_01' 
# The contamination parameter is an estimate of the proportion of anomalies in the data.
# This is a key parameter to tune. Let's start with 1% (0.01).
CONTAMINATION_RATE = 0.01
# Output file for the plot
PLOT_OUTPUT_FILE = 'anomaly_plot.png'

def analyze_sensor_data():
    """
    Loads sensor data, trains an Isolation Forest model, identifies anomalies,
    and generates a plot visualizing the results.
    """
    print(f"--- Starting Anomaly Detection for {TARGET_SENSOR_ID} ---")
    
    # 1. Load and Prepare Data
    try:
        df = pd.read_csv(CSV_FILE_PATH)
        print(f"Successfully loaded {CSV_FILE_PATH} with {len(df)} rows.")
    except FileNotFoundError:
        print(f"Error: The file '{CSV_FILE_PATH}' was not found.")
        print("Please make sure you have downloaded the CSV from Google Sheets and saved it in the correct directory.")
        return

    # Clean column names (remove leading/trailing spaces)
    df.columns = df.columns.str.strip()
    
    # Filter for the specific sensor we want to analyze
    sensor_df = df[df['SensorID'] == TARGET_SENSOR_ID].copy()
    if sensor_df.empty:
        print(f"Error: No data found for SensorID '{TARGET_SENSOR_ID}'.")
        print("Please check the CSV file or the TARGET_SENSOR_ID constant in the script.")
        return
        
    print(f"Found {len(sensor_df)} data points for sensor {TARGET_SENSOR_ID}.")

    # Convert columns to correct data types
    sensor_df['Timestamp'] = pd.to_datetime(sensor_df['Timestamp'], dayfirst=True)
    sensor_df['Value'] = pd.to_numeric(sensor_df['Value'], errors='coerce')
    sensor_df.dropna(subset=['Value'], inplace=True)
    
    # We need the data in a specific shape for scikit-learn
    X = sensor_df[['Value']]

    # 2. Train Anomaly Detection Model
    print(f"Training Isolation Forest model with contamination rate = {CONTAMINATION_RATE}...")
    model = IsolationForest(contamination=CONTAMINATION_RATE, random_state=42)
    model.fit(X)

    # 3. Predict Anomalies
    sensor_df['anomaly'] = model.predict(X)
    
    # The model returns 1 for normal (inlier) and -1 for abnormal (outlier)
    anomalies = sensor_df[sensor_df['anomaly'] == -1]
    print(f"Model identified {len(anomalies)} anomalies.")

    # 4. Visualize Results
    print(f"Generating plot and saving to {PLOT_OUTPUT_FILE}...")
    plt.figure(figsize=(15, 6))
    # Plot all the sensor data
    plt.plot(sensor_df['Timestamp'], sensor_df['Value'], 
             label='Normal Sensor Value', color='blue', alpha=0.7)
    # Highlight the anomalies on the plot
    plt.scatter(anomalies['Timestamp'], anomalies['Value'], 
                color='red', label='Detected Anomaly', s=50, zorder=5)
    
    plt.title(f'Anomaly Detection for Sensor: {TARGET_SENSOR_ID}')
    plt.xlabel('Timestamp')
    plt.ylabel('Sensor Value')
    plt.legend()
    plt.grid(True, which='both', linestyle='--', linewidth=0.5)
    plt.tight_layout()
    plt.savefig(PLOT_OUTPUT_FILE)
    print(f"Plot saved successfully.")

    # 5. Bridge to Apps Script: Statistical Analysis
    # This section shows a simpler method we can adapt for Google Apps Script
    normal_data = sensor_df[sensor_df['anomaly'] == 1]['Value']
    mean = normal_data.mean()
    std_dev = normal_data.std()
    
    # Define anomaly threshold using 3-sigma rule (a common statistical practice)
    upper_threshold = mean + 3 * std_dev
    
    print("""

    --- Statistical Analysis (for Apps Script Adaptation) ---""")
    print(f"Based on 'normal' data identified by the model:")
    print(f"  - Mean Value: {mean:.2f}")
    print(f"  - Standard Deviation: {std_dev:.2f}")
    print(f"  - Suggested Upper Threshold (Mean + 3*SD): {upper_threshold:.2f}")
    
    # The comparison part was removed as WarnThreshold is not in SensorData.
    print("\nThis analysis shows how we can use ML to learn a dynamic, statistical threshold from the data.")
    print("The next step is to use this insight back in our Google Apps Script.")

if __name__ == '__main__':
    analyze_sensor_data()
