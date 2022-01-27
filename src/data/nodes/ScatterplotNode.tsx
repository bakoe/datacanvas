import { memo, FC } from 'react';

import { Handle, Position, NodeProps, Connection, Edge } from 'react-flow-renderer';

import classes from '../../assets/styles/react-flow.module.css';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ScatterplotNodeData {}

interface ScatterplotNodeProps extends NodeProps {
    data: ScatterplotNodeData;
}

const onConnect = (params: Connection | Edge) => console.log('handle onConnect on ScatterplotNode', params);

const ScatterplotNode: FC<ScatterplotNodeProps> = ({ isConnectable, selected }) => {
    return (
        <div className={`react-flow__node-default ${classes.node} ${selected && 'selected'}`}>
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
