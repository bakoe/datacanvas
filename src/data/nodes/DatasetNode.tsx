import { memo, FC, CSSProperties, useEffect, useState } from 'react';

import { Handle, Position, NodeProps, Connection, Edge } from 'react-flow-renderer';

import { CSV, ColumnHeader } from '@lukaswagner/csv-parser';

import classes from '../../assets/styles/react-flow.module.css';

const nodeStyleOverrides: CSSProperties = { width: '250px' };

interface Column {
    type: 'string' | 'number';
    name: string;
}

type DatasetNodeValidTypes = 'csv' | 'json' | undefined;

export interface DatasetNodeData {
    type: DatasetNodeValidTypes;
    filename: string;
    columns?: Column[];
    file?: File;
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

const onConnect = (params: Connection | Edge) => console.log('handle onConnect on DatasetNode', params);

const DatasetNode: FC<DatasetNodeProps> = ({ data, isConnectable, selected }) => {
    const [stateCols, setStateCols] = useState<ColumnHeader[]>([]);

    useEffect(() => {
        const readColumnsFromCSVFile = async (file: File) => {
            const fileId = file.name;

            const loader = new CSV<string>({
                includesHeader: true,
                delimiter: ',',
            });

            loader.addDataSource(fileId, file);
            const columns = await loader.open(fileId);
            setStateCols(columns);
        };

        if (data.file) {
            readColumnsFromCSVFile(data.file);
        }
    }, [data.file]);

    return (
        <div style={nodeStyleOverrides} className={`react-flow__node-default ${selected && 'selected'} ${classes.node}`}>
            <div className={classes.title}>{data.type?.toUpperCase() + ' '}Dataset</div>
            <span className={classes.hyphenate}>{data.filename}</span>
            <hr className={classes.divider} />
            {stateCols?.map((column) => (
                <div key={column.name} className={classes.handleWrapper}>
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={column.name}
                        className={classes.sourceHandle}
                        isConnectable={isConnectable}
                        onConnect={onConnect}
                    ></Handle>
                    <span className={classes.sourceHandleLabel}>
                        {column.name}:&nbsp;{column.type}
                    </span>
                </div>
            ))}
        </div>
    );
};

export default memo(DatasetNode);
