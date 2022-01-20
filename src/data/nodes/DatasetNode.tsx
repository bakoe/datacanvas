import { memo, FC, CSSProperties } from 'react';

import { Handle, Position, NodeProps } from 'react-flow-renderer';

const targetHandleStyle: CSSProperties = { display: 'flex', flexDirection: 'row-reverse', top: 'initial' };
const handlesWrapperStyle: CSSProperties = { height: '1.5rem' };
const targetHandleLabelStyle: CSSProperties = { marginRight: '10px', alignSelf: 'center' };
const datasetNodeStyle: CSSProperties = { boxSizing: 'border-box' };
const datasetNodeTitleStyle: CSSProperties = { display: 'inline', hyphens: 'auto', background: 'white' };

interface Column {
    type: 'string' | 'number';
    name: string;
}

type DatasetNodeValidTypes = 'csv' | 'json' | undefined;

export interface DatasetNodeData {
    type: DatasetNodeValidTypes;
    filename: string;
    columns: Column[];
}

export const mapMimetypeToNodeFiletype = (mimeType: string): DatasetNodeValidTypes | undefined => {
    switch (mimeType) {
        case 'text/csv':
            return 'csv';
        case 'application/json':
            return 'json';
        default:
            return undefined;
    }
};

interface DatasetNodeProps extends NodeProps {
    data: DatasetNodeData;
}

const DatasetNode: FC<DatasetNodeProps> = ({ data, isConnectable, selected }) => {
    return (
        <div style={datasetNodeStyle} className={`react-flow__node-default ${selected && 'selected'}`}>
            <div style={datasetNodeTitleStyle}>
                Dataset Node: <strong>{data.filename}</strong>
            </div>
            {data.columns.map((column) => (
                <div key={column.name} style={handlesWrapperStyle}>
                    <br />
                    <Handle
                        type="target"
                        position={Position.Right}
                        id={column.name}
                        style={targetHandleStyle}
                        isConnectable={isConnectable}
                    >
                        <span style={targetHandleLabelStyle}>
                            {column.name}:&nbsp;{column.type}
                        </span>
                    </Handle>
                </div>
            ))}
        </div>
    );
};

export default memo(DatasetNode);
