// frontend/src/components/DeviceSelector.jsx
import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import { Autocomplete, TextField, Checkbox, CircularProgress } from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

const DeviceSelector = ({ selectedDevices, setSelectedDevices }) => {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/devices/')
            .then(res => {
                const list = Array.isArray(res.data) ? res.data : [];
                // Si existe last_scan_status, filtramos por éxito; si no, mostramos todos
                const activeDevices = list.filter(d => !('last_scan_status' in d) || d.last_scan_status === 'success');
                setOptions(activeDevices);
            })
            .catch(error => console.error("Failed to fetch devices for selector:", error))
            .finally(() => setLoading(false));
    }, []);

    return (
        <Autocomplete
            multiple
            id="device-selector"
            options={options}
            disableCloseOnSelect
            loading={loading}
            value={selectedDevices}
            onChange={(event, newValue) => {
                setSelectedDevices(newValue);
            }}
            // Cómo se muestra cada opción en la lista
            getOptionLabel={(option) => option.hostname}
            renderOption={(props, option, { selected }) => {
                // Sacamos la 'key' del objeto 'props'
                const { key, ...restProps } = props;
                // Le pasamos la 'key' directamente al 'li' y el resto de las props con el spread.
                return (
                    <li key={key} {...restProps}>
                        <Checkbox
                            icon={icon}
                            checkedIcon={checkedIcon}
                            style={{ marginRight: 8 }}
                            checked={selected}
                        />
                        {option.hostname} ({option.ip_address})
                    </li>
                );
            }}
            style={{ width: '100%' }}
            renderInput={(params) => (
                <TextField 
                    {...params} 
                    label="Select Target Devices (only reachable devices shown)" 
                    placeholder="Search devices..."
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                />
            )}
        />
    );
};

export default DeviceSelector;