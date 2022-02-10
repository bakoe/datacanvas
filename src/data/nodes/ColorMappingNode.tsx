import { FC, memo, useEffect } from 'react';
import { Connection, Edge, Handle, Node, Position } from 'react-flow-renderer/nocss';

import { Column as CSVColumn } from '@lukaswagner/csv-parser';

import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import { Color } from 'webgl-operate';
import EditableColorGradient from './util/EditableColorGradient';

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
    const { isPending = true, column = undefined } = { ...defaultState, ...state };

    useEffect(() => {
        if (column) {
            onChangeState({
                isPending: false,
            });
        }
    }, [column]);

    return (
        <div className={`react-flow__node-default node ${selected && 'selected'} ${isPending && 'pending'}`}>
            <div className="title">Color Mapping</div>
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
                <EditableColorGradient />
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
