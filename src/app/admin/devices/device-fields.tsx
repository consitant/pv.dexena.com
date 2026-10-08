type D = { name?: string; kind?: "gateway" | "esp32"; pollIntervalS?: number; offlineAfterMin?: number };

export function DeviceFields({ d = {} }: { d?: D }) {
  return (
    <>
      <div>
        <label className="label">Name *</label>
        <input className="input" name="name" required defaultValue={d.name ?? ""} placeholder="z. B. LXC solarmax-gateway" />
      </div>
      <div>
        <label className="label">Typ</label>
        <select className="input" name="kind" defaultValue={d.kind ?? "gateway"}>
          <option value="gateway">Gateway (LXC)</option>
          <option value="esp32">ESP32</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Abfrageintervall (s)</label>
          <input className="input" name="pollIntervalS" type="number" min={30} max={3600} defaultValue={d.pollIntervalS ?? 300} />
        </div>
        <div>
          <label className="label">Offline nach (min)</label>
          <input className="input" name="offlineAfterMin" type="number" min={2} max={1440} defaultValue={d.offlineAfterMin ?? 15} />
        </div>
      </div>
    </>
  );
}
