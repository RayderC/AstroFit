"use client";

import { useState } from "react";
import Icon from "./Icon";
import Modal from "./Modal";
import { api, useApi } from "@/lib/client";
import type { ActivityDTO } from "@/lib/types";

export default function ActivityPicker({ onClose, onPick }: { onClose: () => void; onPick: (id: number) => void }) {
  const { data, setData } = useApi<ActivityDTO[]>("/api/activity-types");
  const [name, setName] = useState("");
  return (
    <Modal title="Add cardio" onClose={onClose}>
      <div className="activity-grid">
        {data?.map(a => <button key={a.id} className="activity-btn" onClick={() => onPick(a.id)}><Icon name="run" size={16} />{a.name}</button>)}
      </div>
      <div className="flex gap-2" style={{ marginTop: 14 }}>
        <input className="form-input" placeholder="New activity type" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn-secondary" disabled={!name.trim()} onClick={async () => { setData(await api("/api/activity-types", { body: { name } })); setName(""); }}>Add</button>
      </div>
    </Modal>
  );
}
