import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import apiClient from "../../services/api";

/**
 * ImpactPreviewStep – cache‑first, live on demand
 *
 * Props
 *  - device: { id, hostname }
 *  - certName: string (object name en F5)
 *  - certificateId: number (para fallback/uso cache)
 *  - timeoutSeconds: number
 *  - onResolved?: ({ profiles, from, error }) => void
 *  - preferCache?: boolean (default true) – consulta cache primero
 *  - autoLive?: boolean (default false) – dispara live lookup inmediatamente
 */
export default function ImpactPreviewStep({
  device,
  certName,
  certificateId,
  timeoutSeconds = 10,
  onResolved,
  preferCache = true,
  autoLive = false,
}) {
  const [profiles, setProfiles] = useState([]);
  const [source, setSource] = useState("none"); // 'cache' | 'live' | 'none'
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [loadingLive, setLoadingLive] = useState(false);

  const abortRef = useRef(null);

  const runCache = async () => {
    if (!certificateId) return;
    setLoadingCache(true);
    setNotice(null);
    setError(null);
    try {
      const r = await apiClient.get(`/certificates/${certificateId}/usage`);
      const rows = Array.isArray(r.data?.profiles)
        ? r.data.profiles
        : Array.isArray(r.data)
          ? r.data
          : [];
      setProfiles(rows);
      setSource("cache");
      setLoadingCache(false);
      setNotice("Using cached usage.");
      onResolved?.({ profiles: rows, from: "cache", error: null });
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Cached usage failed.";
      setLoadingCache(false);
      setError(msg);
      onResolved?.({ profiles: [], from: "cache-error", error: msg });
    }
  };

  const runLive = async () => {
    if (!device?.id || !certName) {
      setError("Missing device or certificate name.");
      onResolved?.({ profiles: [], from: "none", error: "missing-params" });
      return;
    }
    // cancel any previous
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoadingLive(true);
    setNotice(null);
    setError(null);

    const timer = setTimeout(() => abortRef.current?.abort(), timeoutSeconds * 1000);

    try {
      const res = await apiClient.get(`/f5/impact-preview`, {
        params: { device_id: device.id, cert_name: certName, timeout: timeoutSeconds },
        signal: abortRef.current.signal,
      });
      clearTimeout(timer);

      const data = res?.data || {};
      const rows = Array.isArray(data?.profiles) ? data.profiles : (Array.isArray(data) ? data : []);

      setProfiles(rows);
      setSource("live");
      setLoadingLive(false);
      setNotice(rows.length === 0 ? "Live lookup returned no profiles." : null);
      onResolved?.({ profiles: rows, from: "live", error: null });
    } catch (e) {
      clearTimeout(timer);
      const status = e?.response?.status;
      const isTimeout = e?.name === "AbortError";
      const isCanceled = e?.message?.toLowerCase?.().includes("canceled") || e?.message?.includes("ERR_CANCELED");
      if (isTimeout || isCanceled) {
        setNotice("Live lookup canceled or timed out.");
      } else if (status === 404) {
        setNotice("No profiles found in live lookup.");
      } else {
        const msg = e?.response?.data?.detail || e.message || "Live lookup failed.";
        setError(msg);
      }
      setLoadingLive(false);
      onResolved?.({ profiles, from: source, error: "live-failed" });
    }
  };

  useEffect(() => {
    // Cache primero por defecto
    if (preferCache && certificateId) runCache();
    // Si se pide live automático, lánzalo tras el cache (o inmediatamente si no hay certId)
    if (autoLive) runLive();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.id, certName, certificateId]);

  const loading = loadingCache || loadingLive;
  const empty = !loading && profiles.length === 0 && !error;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Live lookup on device{" "}
        <strong>
          {device?.hostname || `#${device?.id}`}
          {device?.ip_address ? ` — ${device.ip_address}` : ""}
        </strong>
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Button size="small" variant="outlined" onClick={runLive} disabled={loadingLive}>
          {loadingLive ? "Running live…" : "Refresh from device"}
        </Button>
        {loading && (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">{loadingLive ? "Querying F5…" : "Loading cached usage…"}</Typography>
          </Box>
        )}
        {source === "cache" && !loadingLive && (
          <Typography variant="body2" color="text.secondary">(showing cached usage)</Typography>
        )}
        {source === "live" && (
          <Typography variant="body2" color="text.secondary">(live results)</Typography>
        )}
      </Box>

      {!!error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!!notice && !error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}

      {empty && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No profiles found.
        </Alert>
      )}

      {!loading && profiles.length > 0 && (
        <>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>SSL Profile</TableCell>
                <TableCell>Partition</TableCell>
                <TableCell>Context</TableCell>
                <TableCell>VIPs / Virtual Servers</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {profiles.map((p, idx) => {
                const name = p.name || p.profile || p.profile_name || "—";
                const partition = p.partition || p.partition_name || "Common";
                const context = p.context || p.side || "—";
                const vips = p.vips || p.virtual_servers || p.vs || [];
                const vipsList = Array.isArray(vips) ? vips : [];
                return (
                  <TableRow key={`${name}-${idx}`}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{partition}</TableCell>
                    <TableCell>{context}</TableCell>
                    <TableCell>
                      {vipsList.length === 0 ? "—" : (
                        <Tooltip title={
                          <Box sx={{ p: 1 }}>
                            {vipsList.map((v, i) => <div key={i}>{v.name || v}</div>)}
                          </Box>
                        }>
                          <Link component="button" underline="hover">
                            {vipsList[0]?.name || vipsList[0]}
                            {vipsList.length > 1 ? ` +${vipsList.length - 1} more` : ""}
                          </Link>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Divider sx={{ mt: 2 }} />
        </>
      )}
    </Box>
  );
}