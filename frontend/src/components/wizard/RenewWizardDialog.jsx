import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import apiClient from "../../services/api";
import UploadCertStep from "./UploadCertStep";
import ConfirmDeploymentStep from "./ConfirmDeploymentStep";

// Helpers to infer VIP enabled/disabled state from heterogeneous shapes
function isVipEnabled(v) {
  if (!v) return undefined;
  if (typeof v === "string") return undefined; // unknown from string only
  if (typeof v === "object") {
    // Try several common shapes
    if (typeof v.enabled === "boolean") return v.enabled;
    if (typeof v.disabled === "boolean") return !v.disabled;
    if (v.state) {
      const s = String(v.state).toLowerCase();
      if (s.includes("enabled")) return true;
      if (s.includes("disabled")) return false;
    }
    if (v.status && typeof v.status.enabled === "boolean") return v.status.enabled;
  }
  return undefined; // unknown
}

function isOrphanProfile(vipsList) {
  // Orphan if there are no VIPs at all
  if (!Array.isArray(vipsList) || vipsList.length === 0) return true;
  // If we can infer enabled flags and all are disabled/unknown-disabled, consider orphan
  let sawEnabledFlag = false;
  let anyEnabled = false;
  for (const v of vipsList) {
    const en = isVipEnabled(v);
    if (en !== undefined) {
      sawEnabledFlag = true;
      if (en) anyEnabled = true;
    }
  }
  if (sawEnabledFlag) return !anyEnabled; // all known are disabled
  return false; // has VIPs but we can't assert disabled => treat as non-orphan
}

// Normalizes various backend shapes (cache vs live) into rows the table understands
function normalizeProfilesPayload(payload) {
  const raw =
    (payload && Array.isArray(payload.profiles) && payload.profiles) ||
    (Array.isArray(payload) && payload) ||
    (payload && Array.isArray(payload.results) && payload.results) ||
    [];

  const rows = [];
  for (const item of raw) {
    if (!item) continue;

    // Case 1: string with /Partition/Name
    if (typeof item === "string") {
      let partition = "Common";
      let name = item;
      const m = item.match(/^\/([^/]+)\/(.+)$/);
      if (m) {
        partition = m[1];
        name = m[2];
      }
      rows.push({ name, partition, context: "—", vips: [] });
      continue;
    }

    // Case 2: object; try several field names
    const full = item.fullPath || item.full_path || item.profile_full_path;
    let name = item.name || item.profile || item.profile_name;
    let partition = item.partition || item.partition_name;

    if ((!name || !partition) && full) {
      const m = full.match(/^\/([^/]+)\/(.+)$/);
      if (m) {
        partition = partition || m[1];
        name = name || m[2];
      }
    }

    const context = item.context || item.side || item.profileContext || "—";
    const vips =
      item.vips ||
      item.virtual_servers ||
      item.vs ||
      item.virtuals ||
      item.virtualServers ||
      [];

    rows.push({
      name: name || "—",
      partition: partition || "Common",
      context,
      vips: Array.isArray(vips)
        ? vips
        : (vips && typeof vips === "object" && vips !== null
            ? Object.values(vips)
            : []),
    });
  }
  return rows;
}

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
function ImpactPreviewStep({
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
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState(null); // ISO string
  const [cacheAgeLabel, setCacheAgeLabel] = useState("");

  const abortRef = useRef(null);

  const computeAgeLabel = (ts) => {
    if (!ts) return "";
    const updated = new Date(ts);
    if (isNaN(updated.getTime())) return "";
    const now = new Date();
    const diffMs = now - updated;
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return `Cached ${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `Cached ${min} min ago`;
    const hr = Math.floor(min / 60);
    return `Cached ${hr} h ago`;
  };

  const loadCacheAge = async (deviceId) => {
    try {
      if (!deviceId) return;
      const r = await apiClient.get(`/f5/cache/status`, { params: { device_id: deviceId } });
      const ts = r?.data?.last_updated || r?.data?.lastUpdated || null;
      setCacheUpdatedAt(ts);
      setCacheAgeLabel(computeAgeLabel(ts));
    } catch (e) {
      // ignore age errors, keep silent
      setCacheUpdatedAt(null);
      setCacheAgeLabel("");
    }
  };

  const runCache = async () => {
    setNotice(null);
    setError(null);

    // 1) Prefer cache endpoint when we have device & cert
    if (device?.id && certName) {
      setLoadingCache(true);
      try {
        const r = await apiClient.get(`/f5/cache/impact-preview`, {
          params: { device_id: device.id, cert_name: certName },
        });
        const rows = normalizeProfilesPayload(r.data);
        setProfiles(rows);
        setSource("cache");
        setLoadingCache(false);
        setNotice(`Using cached usage (${rows.length} profile${rows.length === 1 ? "" : "s"}).`);
        await loadCacheAge(device.id);
        onResolved?.({ profiles: rows, from: "cache", error: null });
        return; // done
      } catch (e) {
        const status = e?.response?.status;
        // If cache miss (404) or endpoint not present, fall back to legacy when possible
        if (status !== 404 && status !== 400) {
          // Non-404 cache error – surface it but attempt legacy if we can
          // (we won't early-return here)
        }
      } finally {
        setLoadingCache(false);
      }
    }

    // 2) Legacy fallback: /certificates/{id}/usage
    if (!certificateId) {
      // No way to use legacy; report miss quietly
      onResolved?.({ profiles: [], from: "cache-miss", error: null });
      return;
    }

    setLoadingCache(true);
    try {
      const r = await apiClient.get(`/certificates/${certificateId}/usage`);
      const rows = normalizeProfilesPayload(r.data);
      setProfiles(rows);
      setSource("cache");
      setNotice(`Using cached usage (${rows.length} profile${rows.length === 1 ? "" : "s"}).`);
      await loadCacheAge(device?.id);
      onResolved?.({ profiles: rows, from: "cache", error: null });
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Cached usage failed.";
      setError(msg);
      onResolved?.({ profiles: [], from: "cache-error", error: msg });
    } finally {
      setLoadingCache(false);
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

    setCacheUpdatedAt(null);
    setCacheAgeLabel("");

    setLoadingLive(true);
    setNotice(null);
    setError(null);

    // const timer = setTimeout(() => abortRef.current?.abort(), timeoutSeconds * 1000);

    try {
      const res = await apiClient.get(`/f5/impact-preview`, {
        params: { device_id: device.id, cert_name: certName, timeout: timeoutSeconds },
        signal: abortRef.current.signal,
      });
      // clearTimeout(timer);

      const data = res?.data || {};
      const rows = normalizeProfilesPayload(data);

      setProfiles(rows);
      setSource("live");
      setLoadingLive(false);
      setNotice(rows.length === 0 ? "Live lookup returned no profiles." : null);
      onResolved?.({ profiles: rows, from: "live", error: null });
    } catch (e) {
      // clearTimeout(timer);
      const status = e?.response?.status;
      const isCanceled = e?.message?.toLowerCase?.().includes("canceled") || e?.message?.includes("ERR_CANCELED");
      if (isCanceled) {
        setNotice("Live lookup canceled.");
      } else if (status === 404) {
        setNotice("No profiles found in live lookup.");
      } else {
        const msg = e?.response?.data?.detail || e.message || "Live lookup failed.";
        setError(msg);
      }
      setLoadingLive(false);
      // Mantén lo último que tengamos en pantalla
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

  useEffect(() => {
    if (!cacheUpdatedAt) return;
    setCacheAgeLabel(computeAgeLabel(cacheUpdatedAt));
    const iv = setInterval(() => setCacheAgeLabel(computeAgeLabel(cacheUpdatedAt)), 60000);
    return () => clearInterval(iv);
  }, [cacheUpdatedAt]);

  const loading = loadingCache || loadingLive;
  const empty = !loading && profiles.length === 0 && !error;
  // normalize label once per render (e.g., avoid repeating the word "Cached")
  const cacheAgeDisplay = cacheAgeLabel ? cacheAgeLabel.replace(/^Cached\s*/i, "") : "";

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Live lookup on device <strong>{device?.hostname || `#${device?.id}`}</strong>
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Button size="small" variant="outlined" onClick={runLive} disabled={loadingLive}>
          {loadingLive ? "Running live…" : "Refresh from device"}
        </Button>
        {loading && (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">{loadingLive ? "Querying F5…" : "Reading cached usage…"}</Typography>
          </Box>
        )}
        {source === "cache" && !loadingLive && (
          <Chip
            size="small"
            variant="outlined"
            label={
              cacheAgeLabel
                ? `cached · ${cacheAgeLabel.replace(/^Cached\s*/i, "")}`
                : "cached"
            }
            sx={{ ml: 0.5 }}
          />
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
                const name = p.name || "—";
                const partition = p.partition || "Common";
                const context = p.context || "—";
                const vipsList = Array.isArray(p.vips)
                  ? p.vips
                  : (p.vips && typeof p.vips === 'object' && p.vips !== null ? Object.values(p.vips) : []);
                return (
                  <TableRow key={`${name}-${idx}`}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{partition}</TableCell>
                    <TableCell>{context}</TableCell>
                    <TableCell>
                      {(() => {
                        const orphan = isOrphanProfile(vipsList);
                        // Build tooltip content with enabled/disabled hints when we can infer them
                        const tooltip = (
                          <Box sx={{ p: 1 }}>
                            {vipsList.length === 0 ? (
                              <div>No VIPs</div>
                            ) : (
                              vipsList.map((v, i) => {
                                const label = v?.name || String(v);
                                const en = isVipEnabled(v);
                                const hint = en === undefined ? "" : en ? " (enabled)" : " (disabled)";
                                return <div key={i}>{label}{hint}</div>;
                              })
                            )}
                          </Box>
                        );

                        // Determine orphan reason for tooltip
                        let orphanReason = "";
                        if (orphan) {
                          if (vipsList.length === 0) {
                            orphanReason = "No VIPs associated to this profile";
                          } else {
                            // All associated VIPs are disabled
                            orphanReason = "All associated VIPs are disabled";
                          }
                        }

                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {orphan && (
                              <Tooltip title={orphanReason}>
                                <span>
                                  <Chip size="small" color="warning" variant="outlined" label="orphan" />
                                </span>
                              </Tooltip>
                            )}
                            {vipsList.length === 0 ? (
                              "—"
                            ) : (
                              <Tooltip title={tooltip}>
                                <Link component="button" underline="hover">
                                  {vipsList[0]?.name || vipsList[0]}
                                  {vipsList.length > 1 ? ` +${vipsList.length - 1} more` : ""}
                                </Link>
                              </Tooltip>
                            )}
                          </Box>
                        );
                      })()}
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

/**
 * RenewWizardDialog – Wizard de 3 pasos: Impact → Upload → Confirm & Deploy
 */
export default function RenewWizardDialog({ open, onClose, device, certName, certificateId }) {
  const [activeStep, setActiveStep] = useState(0);
  const [previewData, setPreviewData] = useState(null); // {profiles, from, error}
  const [uploadPayload, setUploadPayload] = useState(null); // retornado por UploadCertStep.onValidated
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const notify = (message, severity = "success") => setToast({ open: true, message, severity });

  const reset = () => {
    setActiveStep(0);
    setPreviewData(null);
    setUploadPayload(null);
  };

  const handleClose = () => {
    reset();
    setToast((t) => ({ ...t, open: false }));
    onClose?.();
  };

  const next = () => setActiveStep((s) => Math.min(2, s + 1));
  const back = () => setActiveStep((s) => Math.max(0, s - 1));

  const canNext = () => {
    if (activeStep === 1) {
      // Para avanzar al paso 3, necesitamos un payload validado
      return !!uploadPayload?.validated;
    }
    return true;
  };

  // Add verifyNow async function just above return
  const verifyNow = async () => {
    try {
      if (!device?.id || !certName) {
        notify("Missing device or cert name", "warning");
        return;
      }
      const res = await apiClient.get("/f5/verify", {
        params: { device_id: device.id, cert_name: certName },
      });
      const ok = !!res?.data?.ok;
      if (ok) {
        notify("Verification OK: certificate is installed and readable", "success");
      } else {
        const msg = res?.data?.error || "Verification failed";
        notify(msg, "warning");
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Verification failed";
      notify(msg, "error");
    }
  };

  // --- Compute overallOrphan from previewData ---
  const overallOrphan = (() => {
    const rows = previewData?.profiles || [];
    if (!rows || rows.length === 0) return true; // no profiles => orphan
    // If every profile appears orphan by VIPs disabled/absent, treat as orphan
    let allOrphan = true;
    for (const p of rows) {
      const vips = Array.isArray(p.vips) ? p.vips : (p.vips && typeof p.vips === 'object' ? Object.values(p.vips) : []);
      if (!isOrphanProfile(vips)) { allOrphan = false; break; }
    }
    return allOrphan;
  })();

  return (
    <Dialog open={!!open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>
        Renew Certificate — {certName}{' '}
        {overallOrphan && (
          <Tooltip title="No SSL profiles or all associated VIPs are disabled">
            <Chip size="small" color="warning" variant="outlined" label="orphan" sx={{ ml: 1 }} />
          </Tooltip>
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
          <Step key="impact"><StepLabel>Impact Preview</StepLabel></Step>
          <Step key="upload"><StepLabel>Upload Certificate</StepLabel></Step>
          <Step key="confirm"><StepLabel>Confirm & Deploy</StepLabel></Step>
        </Stepper>

        {activeStep === 0 && (
          <ImpactPreviewStep
            device={device}
            certName={certName}
            certificateId={certificateId}
            timeoutSeconds={60}
            preferCache={true}
            autoLive={false}
            onResolved={(payload) => setPreviewData(payload)}
          />
        )}

        {activeStep === 1 && (
          <UploadCertStep
            device={device}
            certName={certName}
            onValidated={(payload) => setUploadPayload({ ...payload, validated: true })}
            onInvalidated={() => setUploadPayload(null)}
          />
        )}

        {activeStep === 2 && (
          <ConfirmDeploymentStep
            device={device}
            certName={certName}
            previewData={previewData}
            uploadPayload={uploadPayload}
            onDone={handleClose}
            onNotify={(msg, sev) => notify(msg, sev)}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
        <Box sx={{ flex: 1 }} />
        {activeStep === 2 && (
          <Button onClick={verifyNow} variant="outlined">
            Verify now
          </Button>
        )}
        <Button onClick={back} disabled={activeStep === 0}>
          Back
        </Button>
        <Button onClick={next} variant="contained" disabled={!canNext()}>
          {activeStep < 2 ? "Next" : "Finish"}
        </Button>
      </DialogActions>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}