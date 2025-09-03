// frontend/src/components/BulkActionsBar.jsx
import React from 'react';
import {
  Paper,
  Stack,
  Typography,
  Button,
  TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CachedIcon from '@mui/icons-material/Cached';
import ClearAllIcon from '@mui/icons-material/ClearAll';

const BulkActionsBar = ({
  selectionCount,
  onRefreshFacts,
  onRefreshCache,
  onScanAll,
  onClearSelection,
  limitCertsInput,
  setLimitCertsInput,
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        mb: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {selectionCount} selected
        </Typography>
        <TextField
          size="small"
          placeholder="limit_certs (optional)"
          value={limitCertsInput}
          onChange={(e) => setLimitCertsInput(e.target.value)}
          sx={{ minWidth: 220 }}
        />
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={onRefreshFacts}
          disabled={selectionCount === 0}
        >
          Refresh Facts
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<CachedIcon />}
          onClick={onRefreshCache}
          disabled={selectionCount === 0}
        >
          Refresh Cache
        </Button>
        <Button
          size="small"
          variant="text"
          startIcon={<ClearAllIcon />}
          onClick={onClearSelection}
          disabled={selectionCount === 0}
        >
          Clear selection
        </Button>
      </Stack>
    </Paper>
  );
};

export default BulkActionsBar;