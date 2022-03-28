import { FC, memo, useEffect, useState } from 'react';
import { Connection, Edge, Handle, Node, Position } from 'react-flow-renderer/nocss';

import { Column as CSVColumn, StringColumn } from '@lukaswagner/csv-parser';

import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import { ColorScale } from 'webgl-operate';
import EditableColorGradient, { ColorPalette } from './util/EditableColorGradient';
import { serializeColumnInfo } from './util/serializeColumnInfo';
import { getDistinctValuesInStringColumn } from './DatasetNode';

export function isColorMappingNode(node: Node<unknown>): node is Node<ColorMappingNodeData> {
    return node.type === NodeTypes.ColorMapping;
}

export enum ColorMappingNodeTargetHandles {
    Column = 'column',
}

export enum ColorMappingNodeSourceHandles {
    Color = 'color',
}

export const ColorMappingNodeTargetHandlesDatatypes: Map<ColorMappingNodeTargetHandles, Datatypes> = new Map([
    [ColorMappingNodeTargetHandles.Column, Datatypes.Column],
]);

export const ColorMappingNodeSourceHandlesDatatypes: Map<ColorMappingNodeSourceHandles, Datatypes> = new Map([
    [ColorMappingNodeSourceHandles.Color, Datatypes.Color],
]);

export interface ColorMappingNodeState {
    isPending: boolean;
    colorScaleConfig?: ColorScaleConfig;
    numberOfStops?: number;
    colorPalette?: ColorPalette;
    column?: CSVColumn;
}

export const defaultState = {
    isPending: true,
    colorScaleConfig: { preset: 'smithwalt', type: 'sequential', identifier: 'magma' },
    numberOfStops: 5,
} as ColorMappingNodeState;

export interface ColorMappingNodeData {
    onChangeState: (state: Partial<ColorMappingNodeState>) => void;
    state?: ColorMappingNodeState;
    isValidConnection?: (connection: Connection) => boolean;
}

const AVAILABLE_COLOR_SCALE_PRESETS = ['smithwalt', 'colorbrewer', 'marcosci', 'mikhailov'];

type ColorMappingNodeProps = NodeWithStateProps<ColorMappingNodeData>;

const onConnect = (params: Connection | Edge) => console.log('handle onConnect on ColorMappingNode', params);

interface ColorScaleConfig {
    preset: string;
    type?: string;
    identifier?: string;
    interpolate?: boolean;
}

const ColorMappingNode: FC<ColorMappingNodeProps> = ({ isConnectable, selected, data }) => {
    const { state, onChangeState, onDeleteNode, isValidConnection } = data;
    const {
        isPending = defaultState.isPending,
        colorPalette = undefined as undefined | ColorPalette,
        column = undefined,
        colorScaleConfig = defaultState.colorScaleConfig as ColorScaleConfig | undefined,
        numberOfStops = defaultState.numberOfStops,
    } = { ...defaultState, ...state };
    const [availableColorScales, setAvailableColorScales] = useState([] as ColorScaleConfig[]);

    useEffect(() => {
        const loadColorScales = async (presetName: string) => {
            const response = await fetch(`/${presetName}.json`);
            const presetJSON = (await response.json()) as Array<{
                identifier: string;
                type: string;
                format: string;
                colors: Array<Array<number>>;
            }>;
            const colorScales = [] as ColorScaleConfig[];
            for (let presetIndex = 0; presetIndex < presetJSON.length; presetIndex++) {
                const preset = presetJSON[presetIndex];
                colorScales[presetIndex] = {
                    preset: presetName,
                    identifier: preset.identifier,
                    type: preset.type,
                    interpolate: preset.type !== 'qualitative',
                };
            }
            setAvailableColorScales((availableColorScalePresets) => availableColorScalePresets.concat(colorScales));
        };

        for (const preset of AVAILABLE_COLOR_SCALE_PRESETS) {
            loadColorScales(preset);
        }
    }, []);

    useEffect(() => {
        if (
            availableColorScales.find(
                (colorScale) =>
                    colorScale.preset === colorScaleConfig.preset &&
                    colorScale.identifier === colorScaleConfig.identifier &&
                    colorScale.type === colorScaleConfig.type,
            ) === undefined
        ) {
            return;
        }
        ColorScale.fromPreset(`/${colorScaleConfig.preset}.json`, colorScaleConfig.identifier, numberOfStops).then((colorScale) => {
            let colorPalette = colorScale.colors.map((color, index) => {
                const rgbaUint8 = color.rgbaUI8;
                const r = rgbaUint8[0];
                const g = rgbaUint8[1];
                const b = rgbaUint8[2];
                const a = rgbaUint8[3] / 255.0;
                return {
                    offset: `${index / (colorScale.length - 1)}`,
                    color: `rgb(${r}, ${g}, ${b}, ${a})`,
                };
            });

            if (colorScaleConfig.interpolate === false) {
                const extendedColorPalette = [] as ColorPalette;
                for (let stopIndex = 0; stopIndex < colorPalette.length; stopIndex++) {
                    const stop = colorPalette[stopIndex];
                    const correctedStopOffset = (parseFloat(stop.offset) - 0.5) * ((colorScale.length - 1) / colorScale.length) + 0.5;
                    extendedColorPalette.push({ ...stop, offset: `${correctedStopOffset - 0.5 / colorScale.length + 1e-5}` });
                    extendedColorPalette.push({
                        ...stop,
                        offset: `${correctedStopOffset}`,
                    });
                    extendedColorPalette.push({ ...stop, offset: `${correctedStopOffset + 0.5 / colorScale.length - 1e-5}` });
                }
                colorPalette = extendedColorPalette;
            }

            onChangeState({
                colorPalette,
            });
        });
    }, [numberOfStops, JSON.stringify(colorScaleConfig), JSON.stringify(availableColorScales)]);

    useEffect(() => {
        if (column && colorPalette) {
            onChangeState({
                isPending: false,
            });
            return;
        }
        onChangeState({
            isPending: true,
        });
    }, [serializeColumnInfo(column), JSON.stringify(colorPalette)]);

    const availableColorScaleTypes = availableColorScales.reduce(
        (types, colorScale) =>
            colorScale.preset === colorScaleConfig.preset && colorScale.type && !types.includes(colorScale.type)
                ? types.concat(colorScale.type)
                : types,
        [] as string[],
    );

    const availableColorScalePresets = availableColorScales.filter(
        (colorScale) => colorScale.preset === colorScaleConfig.preset && colorScale.type === colorScaleConfig.type,
    );

    useEffect(() => {
        if (availableColorScalePresets.length > 0) {
            if (
                availableColorScalePresets.findIndex(
                    (colorScale) =>
                        colorScale.preset === colorScaleConfig.preset &&
                        colorScale.identifier === colorScaleConfig.identifier &&
                        colorScale.type === colorScaleConfig.type,
                ) !== -1
            ) {
                return;
            }
            // Select the first (default) color scale if the type changed, i.e., if the previously selected preset does not fit the now selected type
            onChangeState({
                colorScaleConfig: availableColorScalePresets[0],
            });
        }
    }, [JSON.stringify(availableColorScalePresets)]);

    useEffect(() => {
        onChangeState({
            colorScaleConfig:
                availableColorScales.find(
                    (colorScale) => colorScale.preset === colorScaleConfig.preset && colorScale.type === colorScaleConfig.type,
                ) || availableColorScales.find((colorScale) => colorScale.preset === colorScaleConfig.preset),
        });
    }, [colorScaleConfig.preset]);

    useEffect(() => {
        if (column?.type === 'string') {
            const distinctValuesInStringColumn = getDistinctValuesInStringColumn(column as StringColumn);
            if (distinctValuesInStringColumn.length <= 20) {
                onChangeState({
                    colorScaleConfig: {
                        type: 'qualitative',
                    },
                    numberOfStops: distinctValuesInStringColumn.length,
                });
            }
        }
    }, [column?.type]);

    return (
        <div className={`react-flow__node-default node ${selected && 'selected'} ${isPending && 'pending'} category-mapping`}>
            <div className="title-wrapper">
                <div className="title">Color Mapping{isPending && ' …'}</div>
                <div className="title-actions">
                    <span>
                        <a onPointerUp={onDeleteNode}>✕</a>
                    </span>
                </div>
            </div>
            {Array.from(ColorMappingNodeTargetHandlesDatatypes).map(([targetHandle, datatype]) => {
                return (
                    <div className="handle-wrapper" key={targetHandle}>
                        <Handle
                            type="target"
                            position={Position.Left}
                            id={targetHandle}
                            className={`target-handle ${datatype === Datatypes.Dataset ? 'handle-dataset' : ''}`}
                            isConnectable={isConnectable}
                            onConnect={onConnect}
                            isValidConnection={isValidConnection}
                            data-invalid-connection-tooltip={`You have to connect an output of type “${datatype}” here.`}
                        ></Handle>
                        <span className="target-handle-label">{targetHandle}</span>
                    </div>
                );
            })}

            <hr className="divider" />

            <div className="nodrag">
                <table style={{ textAlign: 'right', width: 'calc(100% + 2px)', borderSpacing: '2px' }}>
                    <tbody>
                        <tr>
                            <td>
                                <label htmlFor="preset">Preset:</label>
                            </td>
                            <td>
                                <select
                                    id="preset"
                                    value={colorScaleConfig.preset}
                                    onChange={(event) => {
                                        onChangeState({
                                            colorScaleConfig: {
                                                ...colorScaleConfig,
                                                preset: event.target.value,
                                                identifier: undefined,
                                            },
                                            numberOfStops: undefined,
                                        });
                                    }}
                                >
                                    {AVAILABLE_COLOR_SCALE_PRESETS.map((presetName) => (
                                        <option key={presetName} value={presetName}>
                                            {presetName}
                                        </option>
                                    ))}
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <label htmlFor="type">Type:</label>
                            </td>
                            <td>
                                <select
                                    id="type"
                                    value={colorScaleConfig.type}
                                    onChange={(event) => {
                                        onChangeState({
                                            colorScaleConfig: {
                                                ...colorScaleConfig,
                                                type: event.target.value,
                                            },
                                        });
                                    }}
                                >
                                    {availableColorScaleTypes.map((colorScaleType) => (
                                        <option key={colorScaleType} value={colorScaleType}>
                                            {colorScaleType}
                                        </option>
                                    ))}
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <label htmlFor="preset">Preset:</label>
                            </td>
                            <td>
                                <select
                                    id="preset"
                                    value={colorScaleConfig.identifier}
                                    onChange={(event) => {
                                        onChangeState({
                                            colorScaleConfig: {
                                                ...colorScaleConfig,
                                                identifier: event.target.value,
                                            },
                                        });
                                    }}
                                >
                                    {availableColorScalePresets.map((colorScale) => (
                                        <option key={`${colorScale.type}-${colorScale.identifier}`} value={colorScale.identifier}>
                                            {colorScale.identifier}
                                        </option>
                                    ))}
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <label htmlFor="number-of-stops">#&nbsp;stops:</label>
                            </td>
                            <td>
                                <input
                                    value={numberOfStops}
                                    onChange={(event) => {
                                        onChangeState({
                                            numberOfStops: event.target.valueAsNumber,
                                        });
                                    }}
                                    type="number"
                                    min="1"
                                    max="32"
                                    id="number-of-stops"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="nodrag" style={{ marginTop: '0.4rem' }}>
                <EditableColorGradient
                    palette={colorPalette || []}
                    onChangePalette={(palette) => {
                        onChangeState({ colorPalette: palette });
                    }}
                />
            </div>

            <hr className="divider" />

            {Array.from(ColorMappingNodeSourceHandlesDatatypes).map(([sourceHandle, datatype]) => {
                return (
                    <div className="handle-wrapper" key={sourceHandle}>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={sourceHandle}
                            className={`source-handle ${datatype === Datatypes.Dataset ? 'handle-dataset' : ''}`}
                            isConnectable={isConnectable}
                            onConnect={onConnect}
                            isValidConnection={isValidConnection}
                            data-invalid-connection-tooltip={`You have to connect an output of type “${datatype}” here.`}
                        ></Handle>
                        <span className="source-handle-label">{sourceHandle}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default memo(ColorMappingNode);
