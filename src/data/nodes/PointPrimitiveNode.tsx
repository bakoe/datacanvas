import { FC, memo, useEffect } from 'react';
import { Connection, Edge, Handle, Node, Position } from 'react-flow-renderer/nocss';

import { Column as CSVColumn } from '@lukaswagner/csv-parser';

import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import { Color } from 'webgl-operate';
import { ColorPalette } from './util/EditableColorGradient';

export function isPointPrimitiveNode(node: Node<unknown>): node is Node<PointPrimitiveNodeData> {
    return node.type === NodeTypes.PointPrimitive;
}

export enum PointPrimitiveNodeTargetHandles {
    X = 'x coordinate',
    Y = 'y coordinate',
    Z = 'z coordinate',
    Size = 'size (optional)',
    Color = 'color (optional)',
}

export const PointPrimitiveNodeTargetHandlesDatatypes: Map<PointPrimitiveNodeTargetHandles, Datatypes> = new Map([
    [PointPrimitiveNodeTargetHandles.X, Datatypes.Column],
    [PointPrimitiveNodeTargetHandles.Y, Datatypes.Column],
    [PointPrimitiveNodeTargetHandles.Z, Datatypes.Column],
    [PointPrimitiveNodeTargetHandles.Size, Datatypes.Column],
    [PointPrimitiveNodeTargetHandles.Color, Datatypes.Color],
]);

export interface PointPrimitiveNodeState {
    isPending: boolean;
    xColumn?: CSVColumn;
    yColumn?: CSVColumn;
    zColumn?: CSVColumn;
    sizeColumn?: CSVColumn;
    colors?: {
        column: CSVColumn;
        colorPalette: ColorPalette;
    };
}

export const defaultState = { isPending: true } as PointPrimitiveNodeState;

export interface PointPrimitiveNodeData {
    onChangeState: (state: Partial<PointPrimitiveNodeState>) => void;
    state?: PointPrimitiveNodeState;
    isValidConnection?: (connection: Connection) => boolean;
}

type PointPrimitiveNodeProps = NodeWithStateProps<PointPrimitiveNodeData>;

const onConnect = (params: Connection | Edge) => console.log('handle onConnect on PointPrimitiveNode', params);

const PointPrimitiveNode: FC<PointPrimitiveNodeProps> = ({ isConnectable, selected, data }) => {
    const { state, onChangeState, isValidConnection } = data;
    const { isPending = true, xColumn = undefined, yColumn = undefined, zColumn = undefined } = { ...defaultState, ...state };

    useEffect(() => {
        if (xColumn && yColumn && zColumn) {
            onChangeState({
                isPending: false,
            });
        }
    }, [xColumn, yColumn, zColumn]);

    return (
        <div className={`react-flow__node-default node ${selected && 'selected'} ${isPending && 'pending'}`}>
            <div className="title">Point Primitive</div>
            {Array.from(PointPrimitiveNodeTargetHandlesDatatypes).map(([targetHandle, datatype]) => {
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
        </div>
    );
};

export default memo(PointPrimitiveNode);
