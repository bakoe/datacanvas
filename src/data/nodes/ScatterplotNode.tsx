import { FC, memo } from 'react';
import { Connection, Edge, Handle, Node, Position, useStoreApi } from 'react-flow-renderer/nocss';

import { NodeWithStateProps } from '../BasicFlow';

export function isScatterplotNode(node: Node<unknown>): node is Node<ScatterplotNodeData> {
    return node.type === 'scatterplot';
}

export interface ScatterplotNodeState {
    isPending: boolean;
}

export const defaultState = { isPending: true } as ScatterplotNodeState;

export interface ScatterplotNodeData {
    onChangeState: (state: Partial<ScatterplotNodeState>) => void;
    state?: ScatterplotNodeState;
}

type ScatterplotNodeProps = NodeWithStateProps<ScatterplotNodeData>;

const onConnect = (params: Connection | Edge) => console.log('handle onConnect on ScatterplotNode', params);

const ScatterplotNode: FC<ScatterplotNodeProps> = ({ isConnectable, selected, data }) => {
    const { state } = data;
    const { isPending = true } = { ...defaultState, ...state };
    return (
        <div className={`react-flow__node-default node ${selected && 'selected'} ${isPending && 'pending'}`}>
            <div className="title">Scatterplot</div>
            <div className="handle-wrapper">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="x"
                    className="target-handle"
                    isConnectable={isConnectable}
                    onConnect={onConnect}
                ></Handle>
                <span className="target-handle-label">x axis</span>
            </div>
            <div className="handle-wrapper">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="y"
                    className="target-handle"
                    isConnectable={isConnectable}
                    onConnect={onConnect}
                ></Handle>
                <span className="target-handle-label">y axis</span>
            </div>
            <div className="handle-wrapper">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="z"
                    className="target-handle"
                    isConnectable={isConnectable}
                    onConnect={onConnect}
                ></Handle>
                <span className="target-handle-label">z axis</span>
            </div>
        </div>
    );
};

export default memo(ScatterplotNode);
