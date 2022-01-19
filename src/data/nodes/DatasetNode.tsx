import { memo, FC, CSSProperties } from 'react';

import { Handle, Position, NodeProps } from 'react-flow-renderer';

const targetHandleStyle: CSSProperties = { display: 'flex', flexDirection: 'row-reverse', background: '#555', top: 'initial' };
const handlesWrapperStyle: CSSProperties = { height: '3.0rem' };
const targetHandleLabelStyle: CSSProperties = { marginRight: '1rem', alignSelf: 'center' };
const datasetNodeStyle: CSSProperties = { background: '#9CA8B3', color: '#FFF', padding: '1rem' };

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

const DatasetNode: FC<DatasetNodeProps> = ({ data, isConnectable }) => {
    return (
        <div style={datasetNodeStyle}>
            <div>
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
