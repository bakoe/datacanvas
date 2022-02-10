import { FC, useEffect, useState } from 'react';

import { SketchPicker } from 'react-color';
import { GradientPickerPopover } from 'react-linear-gradient-picker';

// Taken from https://github.com/odedglas/react-linear-gradient-picker#gradient-picker-popover-usage
const rgbToRgba = (rgb: string, a = 1) => rgb.replace('rgb(', 'rgba(').replace(')', `, ${a})`);

const WrappedSketchPicker: FC<{
    onSelect?: (rgb: string, alpha?: number) => void;
    // All other props
    [x: string]: any;
}> = ({ onSelect, ...rest }) => {
    return (
        <SketchPicker
            {...rest}
            color={rgbToRgba(rest.color, rest.opacity)}
            onChange={(c) => {
                const { r, g, b, a } = c.rgb;
                onSelect ? onSelect(`rgb(${r}, ${g}, ${b})`, a) : undefined;
            }}
        />
    );
};

// import colorBrewer from '/colorbrewer.json?url';

export type ColorPalette = Array<{
    offset: string;
    color: string;
}>;

interface EditableColorGradientProps {
    palette: ColorPalette;
    onChangePalette: (palette: ColorPalette) => void;
}

const EditableColorGradient: FC<EditableColorGradientProps> = ({ palette, onChangePalette }) => {
    const [open, setOpen] = useState(false);

    // Allow closing opened color pickers by pressing the ESC key
    useEffect(() => {
        if (open) {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    setOpen(false);
                }
            });
        }
    }, [open]);

    return (
        <GradientPickerPopover
            {...{
                open,
                setOpen,
                angle: 90,
                width: 220,
                maxStops: 3,
                paletteHeight: 32,
                palette,
                onPaletteChange: onChangePalette,
                flatStyle: true,
            }}
        >
            <WrappedSketchPicker />
        </GradientPickerPopover>
    );
};

export default EditableColorGradient;
