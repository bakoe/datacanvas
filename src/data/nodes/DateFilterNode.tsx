import { memo, FC, useEffect, useState, CSSProperties } from 'react';

import { Node, Handle, Position, Connection } from 'react-flow-renderer/nocss';

import {
    AnyChunk,
    buildChunk,
    buildColumn,
    Column as CSVColumn,
    ColumnHeader as CSVColumnHeader,
    DateColumn,
    NumberColumn,
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
    from?: DateTime;
    to?: DateTime;
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

export const guessDateColumn = (columnHeaders: CSVColumnHeader[]): string | undefined => {
    for (const columnHeader of columnHeaders) {
        if (columnHeader.name.toLowerCase().includes('datum') || columnHeader.name.toLowerCase().includes('date')) {
            return columnHeader.name;
        }
    }
    for (const columnHeader of columnHeaders) {
        if (columnHeader.type === 'date') {
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

    if (rowIndicesInGivenDateRange.length === columns[0].length) {
        return columns;
    }

    for (let i = 0; i < dateColumn.length; i++) {
        if (dateColumn.type === 'date') {
            const date = DateTime.fromJSDate((dateColumn as DateColumn).get(i));
            if (!date.isValid) {
                throw new Error(`The date column "${dateColumn.name}" could not be interpreted as a date: ${date.invalidExplanation}`);
            }
            if (from.toMillis() <= date.toMillis() && date.toMillis() <= to.toMillis()) {
                rowIndicesInGivenDateRange.push(i);
            }
        } else {
            const formatOptions = [
                'dd.MM.yy HH:mm',
                'dd.MM.yy'
            ]
            for (let formatOptionIndex = 0; formatOptionIndex < formatOptions.length; formatOptionIndex++) {
                const formatOption = formatOptions[formatOptionIndex];
                const date = DateTime.fromFormat(dateColumn.get(i) as string, formatOption);
                if (!date.isValid) {
                    if (formatOptionIndex === formatOptions.length - 1) {
                        throw new Error(`The date column "${dateColumn.name}" could not be interpreted as a date: ${date.invalidExplanation}`);
                    } else {
                        continue;
                    }
                }
                if (from.toMillis() <= date.toMillis() && date.toMillis() <= to.toMillis()) {
                    rowIndicesInGivenDateRange.push(i);
                }
            }
        }
    }

    const orig = columns;
    const chunks = orig.map((column) => {
        return buildChunk(column.type, rowIndicesInGivenDateRange.length, 0) as AnyChunk;
    });
    for (let index = 0; index < rowIndicesInGivenDateRange.length; index++) {
        chunks.forEach((chunk, columnIndex) => {
            chunk.set(index, orig[columnIndex].get(rowIndicesInGivenDateRange[index]) as never);
        });
    }
    const filtered = orig.map((column, columnIndex) => {
        const filteredColumn = buildColumn(column.name, column.type);
        filteredColumn.push(chunks[columnIndex]);
        return filteredColumn;
    });

    return filtered;
};

export const defaultState = { isPending: true } as DateFilterNodeState;

const DateFilterNode: FC<DateFilterNodeProps> = ({ data, selected, isConnectable }) => {
    const { state, onChangeState, onDeleteNode, isValidConnection } = data;
    const { isPending, from, to, filteredColumns, dataToFilter, errorMessage } = { ...defaultState, ...state };

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [collapsibleHandlesHeights, setCollapsibleHandlesHeights] = useState([] as number[]);

    const updateFilteredColumns = (dataToFilter: CSVColumn[] | undefined, from?: DateTime, to?: DateTime) => {
        console.log(`DateFilterNode → updateFilteredColumns:`, dataToFilter);
        if ((!from || !to) && dataToFilter) {
            const columnHeaders = dataToFilter.map(
                (column) =>
                    ({
                        name: column.name,
                        type: column.type,
                    } as CSVColumnHeader),
            );
            const dateColumnName = guessDateColumn(columnHeaders);
            if (dateColumnName) {
                const dateColumn = dataToFilter.find((column) => column.name === dateColumnName) as DateColumn;
                if (!from) {
                    from = DateTime.fromJSDate(dateColumn.min);
                }
                if (!to) {
                    to = DateTime.fromJSDate(dateColumn.max);
                }
            }
        }
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
                <span className="source-handle-label" title={column.name}>
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
            className={`react-flow__node-default ${selected && 'selected'} ${isPending && 'pending'} ${
                errorMessage && 'erroneous'
            } node category-filtering`}
        >
            <div className="title-wrapper">
                <div className="title" title={errorMessage}>
                    Date Filter{isPending ? ' …' : ''}
                </div>
                <div className="title-actions">
                    <span>
                        <a onPointerUp={onDeleteNode}>✕</a>
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
                        'Data to filter'
                    )}
                </span>
            </div>

            <hr className="divider" />

            <div className="nodrag">
                <table style={{ textAlign: 'right', width: 'calc(100% + 2px)', borderSpacing: '2px' }}>
                    <tbody>
                        <tr>
                            <td>
                                <label htmlFor="from">From:</label>
                            </td>
                            <td>
                                <input
                                    id="from"
                                    style={{ fontSize: '0.6rem' }}
                                    type="date"
                                    defaultValue={from?.toFormat('yyyy-MM-dd')}
                                    max={to?.toFormat('yyyy-MM-dd')}
                                    onChange={(event) => {
                                        const updatedFrom = DateTime.fromFormat(event.target.value, 'yyyy-MM-dd');
                                        updateFilteredColumns(dataToFilter, updatedFrom, to);
                                    }}
                                ></input>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <label htmlFor="to">To:</label>
                            </td>
                            <td>
                                <input
                                    id="to"
                                    style={{ fontSize: '0.6rem' }}
                                    type="date"
                                    defaultValue={to?.toFormat('yyyy-MM-dd')}
                                    min={from?.toFormat('yyyy-MM-dd')}
                                    onChange={(event) => {
                                        const updatedTo = DateTime.fromFormat(event.target.value, 'yyyy-MM-dd');
                                        updateFilteredColumns(dataToFilter, from, updatedTo);
                                    }}
                                ></input>
                            </td>
                        </tr>
                    </tbody>
                </table>
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
                        'Filtered data'
                    )}
                </span>
            </div>
            {filteredColumns && <Collapse isOpened={!isCollapsed}>{collapsibleHandles}</Collapse>}
        </div>
    );
};

export default memo(DateFilterNode);
