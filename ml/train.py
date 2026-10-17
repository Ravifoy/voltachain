"""
Generate a SYNTHETIC battery dataset and train a RandomForest to predict State of Health (SoH).

IMPORTANT: the data below is simulated (not measured from real batteries). It follows
simple, realistic Li-ion degradation trends so the demo behaves sensibly:
  - more charge cycles  -> more capacity fade
  - older cells         -> more calendar ageing
  - hot operation       -> faster ageing
  - lower SoH           -> higher internal resistance, lower measured capacity
"""
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

FEATURES = ["cycle_count", "age_months", "internal_resistance",
            "avg_temperature", "measured_capacity", "nominal_capacity"]


def make_dataset(n=2000, seed=42):
    rng = np.random.default_rng(seed)
    cycles = rng.uniform(20, 1500, n)
    age = rng.uniform(1, 72, n)
    temp = np.clip(rng.normal(30, 6, n), 15, 50)
    nominal = rng.choice([2000, 2600, 3000, 3500, 5000, 10000, 20000], n)

    # Capacity fade: cycle ageing + calendar ageing, both accelerated by heat above 25C.
    heat_factor = 1 + 0.03 * np.maximum(0, temp - 25)
    fade = (0.02 * cycles + 0.2 * age) * heat_factor
    soh = np.clip(100 - fade + rng.normal(0, 2.0, n), 20, 100)

    # Readings an inspector would measure, derived from the true health (plus noise).
    measured = nominal * soh / 100 * rng.normal(1, 0.02, n)
    resistance = 30 + (100 - soh) * 1.1 + rng.normal(0, 5, n)  # milli-ohm

    return pd.DataFrame({
        "cycle_count": cycles.round(), "age_months": age.round(1),
        "internal_resistance": resistance.round(1), "avg_temperature": temp.round(1),
        "measured_capacity": measured.round(), "nominal_capacity": nominal,
        "soh_percent": soh.round(1),
    })


if __name__ == "__main__":
    df = make_dataset()
    df.to_csv("synthetic_battery_data.csv", index=False)
    X_train, X_test, y_train, y_test = train_test_split(
        df[FEATURES], df["soh_percent"], test_size=0.2, random_state=1)
    model = RandomForestRegressor(n_estimators=200, random_state=1, n_jobs=-1)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    print(f"Rows: {len(df)} (synthetic)")
    print(f"R2  : {r2_score(y_test, pred):.4f}")
    print(f"MAE : {mean_absolute_error(y_test, pred):.2f} SoH points")
    joblib.dump(model, "model.joblib")
    print("Saved model.joblib")
