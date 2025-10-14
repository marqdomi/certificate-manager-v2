

import React, { useMemo } from 'react';
import VipsTab from './VipsTab';

// Muy sencillo: tomamos device_id de la querystring (?device_id=33)
function useDeviceId(): number | null {
  const params = new URLSearchParams(window.location.search);
  const v = params.get('device_id');
  return v ? Number(v) : null;
}

export default function DeviceView() {
  const deviceId = useDeviceId();

  const content = useMemo(() => {
    if (!deviceId) return <div>Missing device_id in URL</div>;
    return <VipsTab deviceId={deviceId} />;
  }, [deviceId]);

  return (
    <div style={{ padding: 16 }}>
      <h2>Device #{deviceId} – VIPs</h2>
      {content}
    </div>
  );
}