import { fetchJson } from "../../../lib/api";

type Device = {
  id: string;
  name: string;
  operatingSystem: string;
  lastSeenAt?: string;
  status: string;
};

async function loadDevices(): Promise<Device[]> {
  try {
    return await fetchJson<Device[]>("/api/devices");
  } catch {
    return [];
  }
}

export default async function DevicesPage() {
  const devices = await loadDevices();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Agents</p>
        <h1 className="text-2xl font-semibold">Device Health</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {devices.map((device) => (
          <div key={device.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">{device.name}</p>
            <p className="text-sm text-slate-500">{device.operatingSystem}</p>
            <p className="mt-2 text-sm text-slate-600">
              Last seen {device.lastSeenAt ?? "never"} | Status {device.status}
            </p>
          </div>
        ))}
        {!devices.length && <p className="text-sm text-slate-500">No devices enrolled yet.</p>}
      </div>
    </div>
  );
}
