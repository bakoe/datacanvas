import { FC, memo } from 'react';
import { Connection, Edge, Handle, Node, Position } from 'react-flow-renderer/nocss';

import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';

export function isPointPrimitiveNode(node: Node<unknown>): node is Node<PointPrimitiveNodeData> {
    return node.type === NodeTypes.PointPrimitive;
}

export enum PointPrimitiveNodeTargetHandles {
    Dataset = 'Dataset',
    X = 'x axis',
    Y = 'y axis',
    Z = 'z axis',
}

export const PointPrimitiveNodeTargetHandlesDatatypes: Map<PointPrimitiveNodeTargetHandles, Datatypes> = new Map([
    [PointPrimitiveNodeTargetHandles.Dataset, Datatypes.Dataset],
    [PointPrimitiveNodeTargetHandles.X, Datatypes.Column],
    [PointPrimitiveNodeTargetHandles.Y, Datatypes.Column],
    [PointPrimitiveNodeTargetHandles.Z, Datatypes.Column],
]);

export interface PointPrimitiveNodeState {
    isPending: boolean;
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
    const { state, isValidConnection } = data;
    const { isPending = true } = { ...defaultState, ...state };

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
