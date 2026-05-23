"use client";
import { createContext, useContext, useState, useEffect } from "react";

type WeightUnit = "lb" | "kg";
type DistanceUnit = "mi" | "km";

interface UnitsContextValue {
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  setWeightUnit: (u: WeightUnit) => void;
  setDistanceUnit: (u: DistanceUnit) => void;
}

const UnitsContext = createContext<UnitsContextValue>({
  weightUnit: "lb",
  distanceUnit: "mi",
  setWeightUnit: () => {},
  setDistanceUnit: () => {},
});

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>("lb");
  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>("mi");

  useEffect(() => {
    const w = localStorage.getItem("astrofit_weight_unit") as WeightUnit;
    const d = localStorage.getItem("astrofit_distance_unit") as DistanceUnit;
    if (w === "kg") setWeightUnitState("kg");
    if (d === "km") setDistanceUnitState("km");
  }, []);

  const setWeightUnit = (u: WeightUnit) => {
    setWeightUnitState(u);
    localStorage.setItem("astrofit_weight_unit", u);
  };

  const setDistanceUnit = (u: DistanceUnit) => {
    setDistanceUnitState(u);
    localStorage.setItem("astrofit_distance_unit", u);
  };

  return (
    <UnitsContext.Provider value={{ weightUnit, distanceUnit, setWeightUnit, setDistanceUnit }}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  return useContext(UnitsContext);
}
