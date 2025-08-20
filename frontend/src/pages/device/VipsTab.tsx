import React, { useEffect, useMemo, useState } from 'react';
import type { VipItem } from '../../api/f5';
import { getVips, rescanDeviceNow } from '../../api/f5';
import './VipsTab.css';

type Props = { deviceId: number };

type Filters = {
  q: string;
  onlyNoCert: boolean;
  onlyNoProfiles: boolean;
};

export default function VipsTab({ deviceId }: Props) {
  const [data, setData] = useState<VipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ q: '', onlyNoCert: false, onlyNoProfiles: false });
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getVips(deviceId)
      .then((items) => { if (!cancelled) setData(items); })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deviceId]);

  const filtered = useMemo(() => {
    const q = filters.q.toLowerCase().trim();
    return data.filter((vip) => {
      const nameHit = !q || vip.vip_name.toLowerCase().includes(q) || vip.profiles.some(p => (p.full_path || '').toLowerCase().includes(q));
      if (!nameHit) return false;
      if (filters.onlyNoProfiles && vip.profiles.length > 0) return false;
      if (filters.onlyNoCert) {
        const hasCert = vip.profiles.some(p => !!p.cert_name);
        if (hasCert) return false;
      }
      return true;
    });
  }, [data, filters]);

  const onRescan = async () => {
    try {
      setRescanning(true);
      await rescanDeviceNow(deviceId);
      // feedback mínimo
      alert('Rescan queued. Reopen this tab in a few seconds to see updates.');
    } catch (e) {
      alert(String(e));
    } finally {
      setRescanning(false);
    }
  };

  return (
    <div>
      <div className="vips-toolbar">
        <input
          placeholder="Search VIP or profile"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          className="vips-search-input"
        />
        <label className="vips-checkbox-label" title="Show VIPs whose profiles have no certificate linked">
          <input type="checkbox" checked={filters.onlyNoCert} onChange={(e) => setFilters({ ...filters, onlyNoCert: e.target.checked })} />
          Only VIPs without cert
        </label>
        <label className="vips-checkbox-label" title="Show VIPs that currently have zero SSL profiles in cache">
          <input type="checkbox" checked={filters.onlyNoProfiles} onChange={(e) => setFilters({ ...filters, onlyNoProfiles: e.target.checked })} />
          Only VIPs without profiles
        </label>
        <div className="vips-toolbar-spacer" />
        <button onClick={onRescan} disabled={rescanning}>
          {rescanning ? 'Queuing…' : 'Rescan live now'}
        </button>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: 'crimson' }}>{error}</div>}

      <table className="vips-table">
        <thead>
          <tr>
            <th className="vips-table-header">VIP</th>
            <th className="vips-table-header">Profiles</th>
            <th className="vips-table-header">Certificate</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((vip) => (
            <tr key={vip.vip_name}>
              <td className="vips-table-cell vips-table-vip">{vip.vip_name}</td>
              <td className="vips-table-cell">
                {vip.profiles.length === 0 ? (
                  <span className="vips-no-profiles">— no profiles —</span>
                ) : (
                  <div className="vips-profiles-list">
                    {vip.profiles.map((p) => (
                      <span key={p.full_path} title={p.full_path} className="vips-profile-chip">
                        {p.partition}/{p.name}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="vips-table-cell">
                {vip.profiles.length === 0 ? (
                  <span className="vips-no-cert">—</span>
                ) : (
                  <div className="vips-cert-list">
                    {vip.profiles.map((p) => (
                      <span
                        key={p.full_path + ':cert'}
                        title={p.cert_name || 'No certificate linked'}
                        className={`vips-cert-chip${p.cert_name ? '' : ' vips-cert-chip--no-cert'}`}
                      >
                        {p.cert_name || '— no cert —'}
                      </span>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={3} className="vips-table-empty">No VIPs found for current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}