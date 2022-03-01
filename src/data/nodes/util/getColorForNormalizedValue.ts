import { ColorPalette } from './EditableColorGradient';

const extractRGBColorFromCSSString = (cssString: string): [number, number, number, number] => {
    // Adapted from: https://stackoverflow.com/a/7543829
    // (RegExr playground: https://regexr.com/6f5vt
    const rgbaRegex = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/g;
    const match = rgbaRegex.exec(cssString);
    if (match) {
        const r = parseInt(match[1]) / 255;
        const g = parseInt(match[2]) / 255;
        const b = parseInt(match[3]) / 255;
        const a = match[4] ? parseInt(match[4]) : 1;
        return [r, g, b, a];
    }
    return [1, 1, 1, 1];
};

export const getColorForNormalizedValue = (value: number, colorPalette: ColorPalette): [number, number, number] | undefined => {
    if (isNaN(value) || colorPalette === undefined) {
        return;
    }

    let previousStop = undefined;
    let nextStop = undefined;
    let previousStopDistance = Infinity;
    let nextStopDistance = Infinity;

    for (let stopIndex = 0; stopIndex < colorPalette.length; stopIndex++) {
        const stop = colorPalette[stopIndex];
        const offset = parseFloat(stop.offset);
        const stopDistance = Math.abs(offset - value);
        if (offset <= value && stopDistance < previousStopDistance) {
            previousStop = stop;
            previousStopDistance = stopDistance;
        } else if (offset >= value && stopDistance < nextStopDistance) {
            nextStop = stop;
            nextStopDistance = stopDistance;
        }
    }

    if (previousStop && nextStop) {
        const prevFactor = 1.0 - previousStopDistance / (previousStopDistance + nextStopDistance);
        const nextFactor = 1.0 - nextStopDistance / (previousStopDistance + nextStopDistance);
        const prevColor = extractRGBColorFromCSSString(previousStop.color);
        const nextColor = extractRGBColorFromCSSString(nextStop.color);
        // TODO: Allow for better color interpolation, i.e., not only linearly inside RGB color space(?)
        return [
            prevColor[0] * prevFactor + nextColor[0] * nextFactor,
            prevColor[1] * prevFactor + nextColor[1] * nextFactor,
            prevColor[2] * prevFactor + nextColor[2] * nextFactor,
        ];
    } else if (previousStop) {
        const prevColor = extractRGBColorFromCSSString(previousStop.color);
        return [prevColor[0], prevColor[1], prevColor[2]];
    } else if (nextStop) {
        const nextColor = extractRGBColorFromCSSString(nextStop.color);
        return [nextColor[0], nextColor[1], nextColor[2]];
    }

    return [1, 1, 1];
};
