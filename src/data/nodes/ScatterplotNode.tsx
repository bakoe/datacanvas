import { FC, memo } from 'react';
import { Connection, Edge, Handle, Node, Position } from 'react-flow-renderer/nocss';

import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';

export function isScatterplotNode(node: Node<unknown>): node is Node<ScatterplotNodeData> {
    return node.type === NodeTypes.Scatterplot;
}

export enum ScatterplotNodeTargetHandles {
    Dataset = 'Dataset',
    X = 'x axis',
    Y = 'y axis',
    Z = 'z axis',
}

export const ScatterplotNodeTargetHandlesDatatypes: Map<ScatterplotNodeTargetHandles, Datatypes> = new Map([
    [ScatterplotNodeTargetHandles.Dataset, Datatypes.Dataset],
    [ScatterplotNodeTargetHandles.X, Datatypes.Column],
    [ScatterplotNodeTargetHandles.Y, Datatypes.Column],
    [ScatterplotNodeTargetHandles.Z, Datatypes.Column],
]);

export interface ScatterplotNodeState {
    isPending: boolean;
}

export const defaultState = { isPending: true } as ScatterplotNodeState;

export interface ScatterplotNodeData {
    onChangeState: (state: Partial<ScatterplotNodeState>) => void;
    state?: ScatterplotNodeState;
    isValidConnection?: (connection: Connection) => boolean;
}

type ScatterplotNodeProps = NodeWithStateProps<ScatterplotNodeData>;

const onConnect = (params: Connection | Edge) => console.log('handle onConnect on ScatterplotNode', params);

const ScatterplotNode: FC<ScatterplotNodeProps> = ({ isConnectable, selected, data }) => {
    const { state, isValidConnection } = data;
    const { isPending = true } = { ...defaultState, ...state };

    return (
        <div className={`react-flow__node-default node ${selected && 'selected'} ${isPending && 'pending'}`}>
            <div className="title">Scatterplot</div>
            {Array.from(ScatterplotNodeTargetHandlesDatatypes).map(([targetHandle, datatype]) => {
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

export default memo(ScatterplotNode);
