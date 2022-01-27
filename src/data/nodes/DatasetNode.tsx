import { memo, FC, CSSProperties, useEffect, useState } from 'react';

import { Handle, Position, NodeProps, Connection, Edge } from 'react-flow-renderer';

import {
    Column as CSVColumn,
    ColumnHeader as CSVColumnHeader,
    CSV,
    DataType,
    Float32Chunk,
    Float32Column,
    NumberColumn,
    StringChunk,
    StringColumn,
} from '@lukaswagner/csv-parser';
import Papa from 'papaparse';

// Workaround to use papaparse instead of @lukaswagner/csv-parser for the time being,
// due to problems with nested worker imports in Vite
const USE_CSV_PARSER_INSTEAD_OF_PAPAPARSE = false;

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

const prettyPrintDataType = (dataType: DataType): string => {
    switch (dataType.valueOf()) {
        case 'string':
            return 'Strings';
        case 'number':
        default:
            return 'Numbers';
    }
    return 'Elements';
};

const DatasetNode: FC<DatasetNodeProps> = ({ data, isConnectable, selected }) => {
    const [columnHeaders, setColumnHeaders] = useState<CSVColumnHeader[]>([]);
    const [columns, setColumns] = useState<CSVColumn[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (columnHeaders.length > 0 && columns.length > 0) {
            setIsLoading(false);
        }
    }, [columnHeaders, columns]);

    useEffect(() => {
        const readColumnsFromCSVFile = async (file: File) => {
            if (USE_CSV_PARSER_INSTEAD_OF_PAPAPARSE) {
                const fileId = file.name;

                const loader = new CSV<string>({
                    includesHeader: true,
                    delimiter: ',',
                });

                loader.addDataSource(fileId, file);
                const columnHeaders = await loader.open(fileId);
                setColumnHeaders(columnHeaders);

                const [columns, loaderDispatch] = loader.load({
                    columns: columnHeaders.map(({ type }) => type.valueOf() as DataType),
                    generatedColumns: [],
                });

                for await (const value of loaderDispatch()) {
                    if (value.type === 'done') {
                        setColumns(columns);
                    }
                }
            } else {
                Papa.parse(file, {
                    download: true,
                    header: true,
                    dynamicTyping: true,
                    delimiter: ',',
                    complete: (data) => {
                        // https://stackoverflow.com/a/9436948
                        const valueIsString = (variable: any): boolean => {
                            return typeof variable === 'string' || variable instanceof String;
                        };

                        const valueIsBoolean = (variable: any): boolean => {
                            return typeof variable === 'boolean';
                        };

                        const columnHeaders = Object.entries(data.data[0] as any).map(([key, value]) => {
                            if (valueIsString(value)) {
                                return {
                                    name: key,
                                    type: DataType.String,
                                } as CSVColumnHeader;
                            } else if (valueIsBoolean(value)) {
                                return {
                                    name: key,
                                    type: DataType.Number,
                                } as CSVColumnHeader;
                            }
                            return {
                                name: key,
                                type: DataType.Number,
                            } as CSVColumnHeader;
                        });

                        setColumnHeaders(columnHeaders);

                        const columns = columnHeaders.map((columnHeader, index) => {
                            const values = data.data.map((row: any) => {
                                return Object.values(row)[index];
                            });
                            switch (columnHeader.type.valueOf()) {
                                case 'string': {
                                    const column = new StringColumn(columnHeader.name);
                                    const chunk = new StringChunk(values.length, 0);
                                    for (let i = 0; i < values.length; i++) {
                                        chunk.set(i, values[i] as string);
                                    }
                                    column.push(chunk);
                                    return column;
                                }
                                case 'number':
                                default: {
                                    const column = new Float32Column(columnHeader.name);
                                    const chunk = new Float32Chunk(values.length, 0);
                                    for (let i = 0; i < values.length; i++) {
                                        chunk.set(i, values[i] as number);
                                    }
                                    column.push(chunk);
                                    return column;
                                }
                            }
                        }) as CSVColumn[];

                        setColumns(columns);
                    },
                });
            }
        };

        if (data.file) {
            readColumnsFromCSVFile(data.file);
        }
    }, [data.file]);

    return (
        <div style={nodeStyleOverrides} className={`react-flow__node-default ${selected && 'selected'} ${classes.node}`}>
            <div className={classes.title}>
                {data.type?.toUpperCase() + ' '}Dataset{isLoading ? ' …' : ''}
            </div>
            <span className={classes.hyphenate}>{data.filename}</span>
            <hr className={classes.divider} />
            {columnHeaders?.map((columnHeader) => {
                const column = columns.find((column) => column.name === columnHeader.name);
                const minMaxString =
                    column?.type === 'number'
                        ? `↓ ${(column as NumberColumn)?.min.toLocaleString()} ↑ ${(column as NumberColumn)?.max.toLocaleString()}`
                        : undefined;
                return (
                    <div key={columnHeader.name} className={classes.handleWrapper}>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={columnHeader.name}
                            className={classes.sourceHandle}
                            isConnectable={isConnectable}
                            onConnect={onConnect}
                        ></Handle>
                        <span className={classes.sourceHandleLabel}>
                            {columnHeader.name}
                            <br />
                            <small>
                                <strong>{column && column.length}</strong> {prettyPrintDataType(columnHeader.type)} {minMaxString}
                            </small>
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default memo(DatasetNode);
