/**
 * PlanPreview - Enterprise-styled deployment plan preview
 * Shows a clean summary of the deployment plan with actions and targets
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  alpha,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import type { DeploymentPlan } from '../../types/renewal';

// Local types for plan data - standalone interfaces to avoid type conflicts
interface ProfileItem {
  name?: string;
  partition?: string;
  context?: string;
  profile?: string;
  id?: string;
  vips?: VipItem[];
}

interface VipItem {
  name?: string;
  enabled?: boolean;
}

interface ActionItem {
  type?: string;
  action?: string;
  name?: string;
  target?: string;
  profile?: string;
  detail?: string;
  reason?: string;
}

interface VirtualServerInfo {
  name?: string;
  id?: string;
  destination?: string;
  partition?: string;
}

interface ExtendedPlan {
  device?: string;
  device_ip?: string;
  old_cert_name?: string;
  mode?: string;
  derived_new_object?: string;
  chain_name?: string;
  install_chain_from_pfx?: boolean;
  update_profiles?: boolean;
  actions?: ActionItem[];
  profiles_detected?: ProfileItem[];
  profiles_to_update?: ProfileItem[];
  virtual_servers?: VirtualServerInfo[];
}

interface PlanPreviewProps {
  plan: DeploymentPlan | { plan: DeploymentPlan } | ExtendedPlan | { plan: ExtendedPlan } | null;
}

// Helper to get profile label
function getProfileLabel(p: unknown): string {
  if (p == null) return '—';
  if (typeof p === 'string' || typeof p === 'number') return String(p);
  if (typeof p === 'object') {
    const profile = p as ProfileItem;
    return profile.name || profile.profile || profile.id || 'Profile';
  }
  return String(p);
}

// Helper to format action text
function formatAction(a: ActionItem): { type: string; description: string } {
  const type = a.type || a.action || 'action';
  const target = a.name || a.target || a.profile || '';
  const detail = a.detail || a.reason || '';
  return {
    type: type.charAt(0).toUpperCase() + type.slice(1),
    description: [target, detail].filter(Boolean).join(' — ') || 'No details',
  };
}

const PlanPreview: React.FC<PlanPreviewProps> = ({ plan }) => {
  const [showVirtualServers, setShowVirtualServers] = React.useState(false);

  if (!plan) return null;

  // Handle nested plan structure
  const p: ExtendedPlan = (plan as { plan?: DeploymentPlan }).plan 
    ? (plan as { plan: ExtendedPlan }).plan 
    : (plan as ExtendedPlan);

  const hasActions = Array.isArray(p.actions) && p.actions.length > 0;
  const hasProfilesToUpdate = Array.isArray(p.profiles_to_update) && p.profiles_to_update.length > 0;
  const hasVirtualServers = Array.isArray(p.virtual_servers) && p.virtual_servers.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PlaylistAddCheckIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={600}>
          Deployment Plan Summary
        </Typography>
      </Box>

      {/* Device & Certificate Info */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5),
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
          {/* Device Info */}
          {(p.device || p.device_ip) && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <StorageIcon sx={{ color: 'primary.main', mt: 0.25 }} fontSize="small" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Target Device
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {p.device || p.device_ip}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Old Certificate */}
          {p.old_cert_name && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <SecurityIcon sx={{ color: 'warning.main', mt: 0.25 }} fontSize="small" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Certificate to Replace
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {p.old_cert_name}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Deployment Mode */}
          {p.mode && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <SettingsIcon sx={{ color: 'info.main', mt: 0.25 }} fontSize="small" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Deployment Mode
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {p.mode.charAt(0).toUpperCase() + p.mode.slice(1)}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Chain Info */}
          {p.chain_name && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <LinkIcon sx={{ color: 'secondary.main', mt: 0.25 }} fontSize="small" />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Certificate Chain
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {p.chain_name}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Options Summary */}
        {(typeof p.install_chain_from_pfx !== 'undefined' || typeof p.update_profiles !== 'undefined') && (
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {p.install_chain_from_pfx && (
                <Chip
                  size="small"
                  icon={<CheckCircleIcon />}
                  label="Install Chain from PFX"
                  color="info"
                  variant="outlined"
                />
              )}
              {p.update_profiles && (
                <Chip
                  size="small"
                  icon={<CheckCircleIcon />}
                  label="Update SSL Profiles"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Planned Actions */}
      {hasActions && (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: (theme) => alpha(theme.palette.info.main, 0.08),
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Planned Actions ({p.actions!.length})
            </Typography>
          </Box>
          <List dense disablePadding>
            {p.actions!.map((action, idx) => {
              const formatted = formatAction(action);
              return (
                <ListItem
                  key={idx}
                  sx={{
                    borderBottom: idx < p.actions!.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                    py: 1,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckCircleIcon
                      fontSize="small"
                      sx={{ color: 'success.main' }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          size="small"
                          label={formatted.type}
                          sx={{
                            fontSize: '0.7rem',
                            height: 20,
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                          }}
                        />
                        <Typography variant="body2">
                          {formatted.description}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}

      {/* Profiles to Update */}
      {hasProfilesToUpdate && (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              SSL Profiles to Update ({p.profiles_to_update!.length})
            </Typography>
          </Box>
          <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {p.profiles_to_update!.map((profile, idx) => (
              <Chip
                key={idx}
                label={getProfileLabel(profile)}
                icon={<SecurityIcon />}
                variant="outlined"
                color="primary"
                size="small"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Virtual Servers - Collapsible */}
      {hasVirtualServers && (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08),
              cursor: 'pointer',
            }}
            onClick={() => setShowVirtualServers(!showVirtualServers)}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Virtual Servers ({p.virtual_servers!.length})
            </Typography>
            <IconButton size="small">
              {showVirtualServers ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          </Box>
          <Collapse in={showVirtualServers}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04) }}>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Destination</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Partition</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {p.virtual_servers!.map((vs, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      '&:last-child td': { borderBottom: 0 },
                      '&:hover': {
                        bgcolor: (theme) => alpha(theme.palette.action.hover, 0.04),
                      },
                    }}
                  >
                    <TableCell sx={{ fontSize: '0.8125rem' }}>
                      {vs?.name || vs?.id || '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>
                      {vs?.destination || '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8125rem' }}>
                      {vs?.partition || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Collapse>
        </Paper>
      )}
    </Box>
  );
};

export default PlanPreview;
