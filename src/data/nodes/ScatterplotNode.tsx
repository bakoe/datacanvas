import { memo, FC } from 'react';

import { Handle, Position, Connection, Edge, Node } from 'react-flow-renderer';

import classes from '../../assets/styles/react-flow.module.css';
import { NodeWithStateProps } from '../BasicFlow';

export function isScatterplotNode(node: Node<unknown>): node is Node<ScatterplotNodeState> {
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
        <div className={`react-flow__node-default ${classes.node} ${selected && 'selected'} ${isPending && classes.pending}`}>
            <div className={classes.title}>Scatterplot</div>
            <div className={classes.handleWrapper}>
                <Handle
                    type="target"
                    position={Position.Left}
                    id="x"
                    className={classes.targetHandle}
                    isConnectable={isConnectable}
                    onConnect={onConnect}
                ></Handle>
                <span className={classes.targetHandleLabel}>x axis</span>
            </div>
            <div className={classes.handleWrapper}>
                <Handle
                    type="target"
                    position={Position.Left}
                    id="y"
                    className={classes.targetHandle}
                    isConnectable={isConnectable}
                    onConnect={onConnect}
                ></Handle>
                <span className={classes.targetHandleLabel}>y axis</span>
            </div>
            <div className={classes.handleWrapper}>
                <Handle
                    type="target"
                    position={Position.Left}
                    id="z"
                    className={classes.targetHandle}
                    isConnectable={isConnectable}
                    onConnect={onConnect}
                ></Handle>
                <span className={classes.targetHandleLabel}>z axis</span>
            </div>
        </div>
    );
};

export default memo(ScatterplotNode);
