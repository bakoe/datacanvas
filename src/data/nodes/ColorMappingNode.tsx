import { FC, memo, useCallback, useEffect } from 'react';
import { Connection, Edge, Handle, Node, Position } from 'react-flow-renderer/nocss';

import { Column as CSVColumn, Float32Column, NumberColumn } from '@lukaswagner/csv-parser';

import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import { Color, ColorScale } from 'webgl-operate';
import EditableColorGradient, { ColorPalette } from './util/EditableColorGradient';

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
    colorPalette?: ColorPalette;
    column?: CSVColumn;
}

export const defaultState = { isPending: true } as ColorMappingNodeState;

export interface ColorMappingNodeData {
    onChangeState: (state: Partial<ColorMappingNodeState>) => void;
    state?: ColorMappingNodeState;
    isValidConnection?: (connection: Connection) => boolean;
}

type ColorMappingNodeProps = NodeWithStateProps<ColorMappingNodeData>;

const onConnect = (params: Connection | Edge) => console.log('handle onConnect on ColorMappingNode', params);

const ColorMappingNode: FC<ColorMappingNodeProps> = ({ isConnectable, selected, data }) => {
    const { state, onChangeState, isValidConnection } = data;
    const { isPending = true, colorPalette = undefined as undefined | ColorPalette, column = undefined } = { ...defaultState, ...state };

    useEffect(() => {
        ColorScale.fromPreset('/colorbrewer.json', 'YlGnBu', 5).then((colorScale) => {
            const colorPalette = colorScale.colors.map((color, index) => {
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

            onChangeState({
                colorPalette,
            });
        });
    }, []);

    useEffect(() => {
        if (column && colorPalette) {
            onChangeState({
                isPending: false,
            });
        }
    }, [column, colorPalette]);

    return (
        <div className={`react-flow__node-default node ${selected && 'selected'} ${isPending && 'pending'}`}>
            <div className="title">Color Mapping{isPending && ' …'}</div>
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
