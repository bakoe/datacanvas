import { memo, FC, CSSProperties, useEffect, useState } from 'react';

import { Handle, Position, Node, Connection } from 'react-flow-renderer/nocss';

import { Collapse } from 'react-collapse';

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

export function isDatasetNode(node: Node<unknown>): node is Node<DatasetNodeData> {
    return node.type === 'dataset';
}

// Workaround to use papaparse instead of @lukaswagner/csv-parser for the time being,
// due to problems with nested worker imports in Vite
const USE_CSV_PARSER_INSTEAD_OF_PAPAPARSE = false;

import { NodeWithStateProps } from '../BasicFlow';
import CollapsibleHandle from './util/CollapsibleHandle';
import { prettyPrintDataType } from './util/prettyPrintDataType';

const nodeStyleOverrides: CSSProperties = { width: '250px' };

interface Column {
    type: 'string' | 'number';
    name: string;
}

type DatasetNodeValidTypes = 'csv' | 'json' | undefined;

export interface DatasetNodeState {
    columnHeaders?: CSVColumnHeader[];
    columns?: CSVColumn[];
    isLoading?: boolean;
}

export const defaultState = { isLoading: true } as DatasetNodeState;

export interface DatasetNodeData {
    type: DatasetNodeValidTypes;
    filename: string;
    onChangeState: (state: Partial<DatasetNodeState>) => void;
    state?: DatasetNodeState;
    isValidConnection?: (connection: Connection) => boolean;
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

interface DatasetNodeProps extends NodeWithStateProps<DatasetNodeState> {
    data: DatasetNodeData;
}

const DatasetNode: FC<DatasetNodeProps> = ({ data, isConnectable, selected }) => {
    const { state, onChangeState, isValidConnection } = data;

    const [isCollapsed, setIsCollapsed] = useState(true);
    const [collapsibleHandlesHeights, setCollapsibleHandlesHeights] = useState([] as number[]);

    useEffect(() => {
        if (state && state.columnHeaders && state.columns && state.columnHeaders.length > 0 && state.columns.length > 0) {
            onChangeState({
                isLoading: false,
            });
        }
    }, [state?.columnHeaders, state?.columns]);

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

                onChangeState({ columnHeaders });

                const [columns, loaderDispatch] = loader.load({
                    columns: columnHeaders.map(({ type }) => type.valueOf() as DataType),
                    generatedColumns: [],
                });

                for await (const value of loaderDispatch()) {
                    if (value.type === 'done') {
                        onChangeState({ columns });
                    }
                }
            } else {
                Papa.parse(file, {
                    download: true,
                    header: true,
                    dynamicTyping: true,
                    delimiter: ',',
                    skipEmptyLines: true,
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

                        onChangeState({ columnHeaders });

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

                        onChangeState({ columns });
                    },
                });
            }
        };

        if (data.file) {
            readColumnsFromCSVFile(data.file);
        }
    }, [data.file]);

    const { isLoading, columnHeaders, columns } = { ...defaultState, ...data.state };

    const previousElementsHeights = [] as number[];
    for (let index = 0; index < collapsibleHandlesHeights.length; index++) {
        let sumOfPrevElementsHeight = 0;
        for (let prevIndex = 0; prevIndex < index; prevIndex++) {
            sumOfPrevElementsHeight += collapsibleHandlesHeights[prevIndex];
        }
        previousElementsHeights[index] = sumOfPrevElementsHeight;
    }

    const collapsibleHandles = columnHeaders?.map((columnHeader, index) => {
        const column = columns?.find((column) => column.name === columnHeader.name);

        const minMaxString =
            column?.type === 'number'
                ? `↓ ${(column as NumberColumn)?.min.toLocaleString()} ↑ ${(column as NumberColumn)?.max.toLocaleString()}`
                : undefined;

        return (
            <CollapsibleHandle
                key={columnHeader.name}
                handleElement={
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={columnHeader.name}
                        className="source-handle"
                        isConnectable={isConnectable}
                        isValidConnection={isValidConnection}
                    ></Handle>
                }
                onElementHeightChange={(height) => {
                    collapsibleHandlesHeights[index] = height;
                    setCollapsibleHandlesHeights(collapsibleHandlesHeights);
                }}
                previousElementsHeight={previousElementsHeights[index]}
                isCollapsed={isCollapsed}
            >
                <span className="source-handle-label">
                    {columnHeader.name}
                    <br />
                    <small>
                        <strong>{column && column.length}</strong> {prettyPrintDataType(columnHeader.type)} {minMaxString}
                    </small>
                </span>
            </CollapsibleHandle>
        );
    });

    return (
        <div style={nodeStyleOverrides} className={`react-flow__node-default ${selected && 'selected'} ${isLoading && 'pending'} node`}>
            <div className="title">
                {data.type?.toUpperCase() + ' '}Dataset{isLoading ? ' …' : ''}
            </div>
            <span className="hyphenate">{data.filename}</span>

            <hr className="divider" />

            <div className="handle-wrapper">
                <Handle
                    type="source"
                    position={Position.Right}
                    id="dataset"
                    className="source-handle handle-dataset"
                    isConnectable={isConnectable}
                    isValidConnection={isValidConnection}
                />
                <span className="source-handle-label">
                    <a
                        className="nodrag link"
                        onClick={() => {
                            setIsCollapsed(!isCollapsed);
                        }}
                    >
                        <strong>
                            {columns && columns[0] ? `${columns[0].length} Rows | ` : ''}
                            {columnHeaders?.length}&nbsp;Columns
                        </strong>{' '}
                        {isCollapsed ? '↓' : '↑'}
                    </a>
                </span>
            </div>
            <Collapse isOpened={!isCollapsed}>{collapsibleHandles}</Collapse>
        </div>
    );
};

export default memo(DatasetNode);
