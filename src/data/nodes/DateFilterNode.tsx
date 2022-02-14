import { memo, FC, useEffect, useState, CSSProperties } from 'react';

import { Node, Handle, Position, Connection } from 'react-flow-renderer/nocss';

import {
    Column as CSVColumn,
    ColumnHeader as CSVColumnHeader,
    Float32Chunk,
    Float32Column,
    NumberColumn,
    StringChunk,
    StringColumn,
} from '@lukaswagner/csv-parser';

const nodeStyleOverrides: CSSProperties = { width: '250px' };

export function isDateFilterNode(node: Node<unknown>): node is Node<DateFilterNodeData> {
    return node.type === NodeTypes.DateFilter;
}

export enum DateFilterNodeSourceHandles {
    FilteredDataset = 'filtered-dataset',
}

export const DateFilterNodeSourceHandlesDatatypes: Map<DateFilterNodeSourceHandles, Datatypes> = new Map([
    [DateFilterNodeSourceHandles.FilteredDataset, Datatypes.Dataset],
]);

import { DateTime } from 'luxon';
import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import CollapsibleHandle from './util/CollapsibleHandle';
import { prettyPrintDataType } from './util/prettyPrintDataType';
import { Collapse } from 'react-collapse';
import { serializeColumnInfo } from './util/serializeColumnInfo';

export interface DateFilterNodeState {
    isPending: boolean;
    from: DateTime;
    to: DateTime;
    dataToFilter?: CSVColumn[];
    filteredColumns?: CSVColumn[];
    errorMessage?: string;
}

export interface DateFilterNodeData {
    onChangeState: (state: Partial<DateFilterNodeState>) => void;
    onDeleteNode: () => void;
    state?: DateFilterNodeState;
    isValidConnection?: (connection: Connection) => boolean;
}

interface DateFilterNodeProps extends NodeWithStateProps<DateFilterNodeState> {
    data: DateFilterNodeData;
}

const guessDateColumn = (columnHeaders: CSVColumnHeader[]): string | undefined => {
    for (const columnHeader of columnHeaders) {
        if (columnHeader.name.includes('Datum') || columnHeader.name.includes('Date')) {
            return columnHeader.name;
        }
    }
};

const filterColumnsByDate = (columns: CSVColumn[], from: DateTime, to: DateTime, dateColumnName?: string): CSVColumn[] => {
    if (!dateColumnName) {
        const columnHeaders = columns.map(
            (column) =>
                ({
                    name: column.name,
                    type: column.type,
                } as CSVColumnHeader),
        );
        dateColumnName = guessDateColumn(columnHeaders);
    }

    if (!dateColumnName) {
        throw new Error('No date column given or found!');
    }

    const dateColumn = columns.find((column) => column.name === dateColumnName);

    if (!dateColumn) {
        throw new Error('No date column given or found!');
    }

    const rowIndicesInGivenDateRange = [] as number[];

    for (let i = 0; i < dateColumn.length; i++) {
        const date = DateTime.fromFormat(dateColumn.get(i) as string, 'dd.MM.yy HH:mm');
        if (!date.isValid) {
            throw new Error(`The date column "${dateColumn.name}" could not be interpreted as a date: ${date.invalidExplanation}`);
        }
        if (from.toMillis() <= date.toMillis() && date.toMillis() <= to.toMillis()) {
            rowIndicesInGivenDateRange.push(i);
        }
    }

    return columns.map((column) => {
        const values = [];

        for (let i = 0; i < column.length; i++) {
            if (rowIndicesInGivenDateRange.includes(i)) {
                values.push(column.get(i));
            }
        }

        switch (column.type.valueOf()) {
            case 'string': {
                const filteredColumn = new StringColumn(column.name);
                const chunk = new StringChunk(values.length, 0);
                for (let i = 0; i < values.length; i++) {
                    chunk.set(i, values[i] as string);
                }
                filteredColumn.push(chunk);
                return filteredColumn;
            }
            case 'number':
            default: {
                const filteredColumn = new Float32Column(column.name);
                const chunk = new Float32Chunk(values.length, 0);
                for (let i = 0; i < values.length; i++) {
                    chunk.set(i, values[i] as number);
                }
                filteredColumn.push(chunk);
                return filteredColumn;
            }
        }
    }) as CSVColumn[];
};

export const defaultState = { isPending: true } as DateFilterNodeState;

const DateFilterNode: FC<DateFilterNodeProps> = ({ data, selected, isConnectable }) => {
    const { state, onChangeState, onDeleteNode, isValidConnection } = data;
    const { isPending, from, to, filteredColumns, dataToFilter, errorMessage } = { ...defaultState, ...state };

    const [isCollapsed, setIsCollapsed] = useState(true);
    const [collapsibleHandlesHeights, setCollapsibleHandlesHeights] = useState([] as number[]);

    const updateFilteredColumns = (dataToFilter: CSVColumn[] | undefined, from: DateTime, to: DateTime) => {
        if (dataToFilter && from && to) {
            try {
                const filteredColumns = filterColumnsByDate(dataToFilter, from, to);
                onChangeState({
                    from: from,
                    to: to,
                    filteredColumns,
                    isPending: false,
                    errorMessage: undefined,
                });
            } catch (_e: any) {
                const e: Error = _e;
                onChangeState({
                    from: from,
                    to: to,
                    errorMessage: e.message,
                    isPending: false,
                    filteredColumns: undefined,
                });
            }
        }
    };

    useEffect(() => {
        updateFilteredColumns(dataToFilter, from, to);
    }, [JSON.stringify(dataToFilter ? `${dataToFilter.map(serializeColumnInfo)}` : '')]);

    const previousElementsHeights = [] as number[];
    for (let index = 0; index < collapsibleHandlesHeights.length; index++) {
        let sumOfPrevElementsHeight = 0;
        for (let prevIndex = 0; prevIndex < index; prevIndex++) {
            sumOfPrevElementsHeight += collapsibleHandlesHeights[prevIndex];
        }
        previousElementsHeights[index] = sumOfPrevElementsHeight;
    }

    const collapsibleHandles = filteredColumns?.map((column, index) => {
        const minMaxString =
            column?.type === 'number'
                ? `↓ ${(column as NumberColumn)?.min.toLocaleString()} ↑ ${(column as NumberColumn)?.max.toLocaleString()}`
                : undefined;

        return (
            <CollapsibleHandle
                key={column.name}
                handleElement={
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={column.name}
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
                    {column.name}
                    <br />
                    <small>
                        <strong>{column && column.length}</strong> {prettyPrintDataType(column.type)} {minMaxString}
                    </small>
                </span>
            </CollapsibleHandle>
        );
    });

    return (
        <div
            style={nodeStyleOverrides}
            className={`react-flow__node-default ${selected && 'selected'} ${isPending && 'pending'} ${errorMessage && 'erroneous'} node`}
        >
            <div className="title-wrapper">
                <div className="title" title={errorMessage}>
                    Filter: Date Range{isPending ? ' …' : ''}
                </div>
                <div className="title-actions">
                    <span>
                        <a onClick={onDeleteNode}>Delete</a>
                    </span>
                </div>
            </div>
            <div className="handle-wrapper">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="x"
                    className="target-handle handle-dataset"
                    isConnectable={isConnectable}
                    isValidConnection={isValidConnection}
                ></Handle>
                <span className="target-handle-label">
                    {dataToFilter ? (
                        <>
                            <strong>{dataToFilter[0].length}</strong> Dates to filter
                        </>
                    ) : (
                        <em>Data to filter</em>
                    )}
                </span>
            </div>

            <hr className="divider" />

            <div className="handle-wrapper nodrag" style={{ alignItems: 'baseline' }}>
                <span style={{ marginRight: '0.5rem' }}>From:</span>
                <input
                    style={{ fontSize: '0.6rem' }}
                    type="date"
                    defaultValue={from.toFormat('yyyy-MM-dd')}
                    max={to.toFormat('yyyy-MM-dd')}
                    onChange={(event) => {
                        const updatedFrom = DateTime.fromFormat(event.target.value, 'yyyy-MM-dd');
                        updateFilteredColumns(dataToFilter, updatedFrom, to);
                    }}
                ></input>
            </div>
            <div className="handle-wrapper nodrag" style={{ alignItems: 'baseline' }}>
                <span style={{ marginRight: '0.5rem' }}>To:</span>
                <input
                    style={{ fontSize: '0.6rem' }}
                    type="date"
                    defaultValue={to.toFormat('yyyy-MM-dd')}
                    min={from.toFormat('yyyy-MM-dd')}
                    onChange={(event) => {
                        const updatedTo = DateTime.fromFormat(event.target.value, 'yyyy-MM-dd');
                        updateFilteredColumns(dataToFilter, from, updatedTo);
                    }}
                ></input>
            </div>

            <hr className="divider" />

            <div className="handle-wrapper">
                <Handle
                    type="source"
                    position={Position.Right}
                    id={DateFilterNodeSourceHandles.FilteredDataset}
                    className="source-handle handle-dataset"
                    isConnectable={isConnectable}
                    isValidConnection={isValidConnection}
                ></Handle>
                <span className="source-handle-label">
                    {filteredColumns ? (
                        <a
                            className="nodrag link"
                            onClick={() => {
                                setIsCollapsed(!isCollapsed);
                            }}
                        >
                            <strong>
                                {filteredColumns && filteredColumns[0] ? `${filteredColumns[0].length} Rows | ` : ''}
                                {filteredColumns?.length}&nbsp;Columns
                            </strong>{' '}
                            {isCollapsed ? '↓' : '↑'}
                        </a>
                    ) : (
                        <em>Filtered data</em>
                    )}
                </span>
            </div>
            {filteredColumns && <Collapse isOpened={!isCollapsed}>{collapsibleHandles}</Collapse>}
        </div>
    );
};

export default memo(DateFilterNode);
