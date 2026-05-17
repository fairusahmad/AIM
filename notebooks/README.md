# EM1 Machine Learning Examples

This folder contains notebook-style Python examples for simple machine learning workflows focused on `EM1`.

Files:
- `em1_prediction_example.ipynb` - rendered notebook version for GitHub viewing
- `em1_prediction_example.py` - regression example for predicting the next `CycleTime_sec`
- `em1_fault_classification_example.ipynb` - rendered notebook version for GitHub viewing
- `em1_fault_classification_example.py` - classification example for predicting whether the next EM1 state will be `alarm`

What they do:
- load `RawData` and `SensorData` from `AIM_MonitoringSystem.xlsx`
- filter data for `EM1`
- build simple time-based features and sensor features
- train a scikit-learn model
- print evaluation metrics and plot results

Suggested environment:
- Python 3.10+
- `pandas`
- `numpy`
- `matplotlib`
- `openpyxl`
- `scikit-learn`

Suggested install:

```bash
pip install pandas numpy matplotlib openpyxl scikit-learn
```

How to use:
1. On GitHub, open either `.ipynb` file to view a rendered notebook page.
2. In VS Code or Jupyter, open either `.ipynb` notebook or the notebook-style `.py` file.
3. Run the cells from top to bottom.
4. Review metrics, feature importance, and charts.

These examples are intentionally simple so they are easy to adapt later for:
- specific alarm-code classification
- anomaly risk prediction
- multi-machine modeling
- model export and deployment
