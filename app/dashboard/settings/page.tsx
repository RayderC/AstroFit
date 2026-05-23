"use client";
import { useUnits } from "@/app/context/UnitsContext";

export default function SettingsPage() {
  const { weightUnit, distanceUnit, setWeightUnit, setDistanceUnit } = useUnits();

  return (
    <div className="content-narrow">
      <div className="dash-header">
        <h1 className="dash-title">Settings</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Units</span>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-label">Weight</div>
            <div className="settings-hint">Used for workout tracking and volume stats</div>
          </div>
          <div className="unit-toggle">
            <button
              className={`unit-btn${weightUnit === "lb" ? " active" : ""}`}
              onClick={() => setWeightUnit("lb")}
            >
              lb
            </button>
            <button
              className={`unit-btn${weightUnit === "kg" ? " active" : ""}`}
              onClick={() => setWeightUnit("kg")}
            >
              kg
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-label">Distance</div>
            <div className="settings-hint">Used for cardio and GPS tracking</div>
          </div>
          <div className="unit-toggle">
            <button
              className={`unit-btn${distanceUnit === "mi" ? " active" : ""}`}
              onClick={() => setDistanceUnit("mi")}
            >
              mi
            </button>
            <button
              className={`unit-btn${distanceUnit === "km" ? " active" : ""}`}
              onClick={() => setDistanceUnit("km")}
            >
              km
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
