import React, { FC, useState } from 'react';

import { SketchPicker } from 'react-color';
import { GradientPickerPopover } from 'react-linear-gradient-picker';

import { ColorScale } from 'haeley-colors';

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

let initialPallet = [
    { offset: '0.00', color: 'rgb(238, 241, 11)' },
    { offset: '1.00', color: 'rgb(126, 32, 207)' },
];

ColorScale.fromPreset('/colorbrewer.json', 'YlGnBu', 5).then(
    (colorScale) =>
        (initialPallet = colorScale.colors.map((color, index) => {
            const rgbaUint8 = color.rgbaUI8;
            const r = rgbaUint8[0];
            const g = rgbaUint8[1];
            const b = rgbaUint8[2];
            const a = rgbaUint8[3] / 255.0;
            return {
                offset: `${index / (colorScale.length - 1)}`,
                color: `rgb(${r}, ${g}, ${b}, ${a})`,
            };
        })),
);

const EditableColorGradient = () => {
    const [open, setOpen] = useState(false);
    const [palette, setPalette] = useState(initialPallet);

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
                onPaletteChange: setPalette,
                flatStyle: true,
            }}
        >
            <WrappedSketchPicker />
        </GradientPickerPopover>
    );
};

export default EditableColorGradient;
