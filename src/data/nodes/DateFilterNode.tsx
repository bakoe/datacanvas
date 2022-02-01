import { memo, FC, useEffect } from 'react';

import { Node, Handle, Position } from 'react-flow-renderer/nocss';

import {
    Column as CSVColumn,
    ColumnHeader as CSVColumnHeader,
    Float32Chunk,
    Float32Column,
    StringChunk,
    StringColumn,
} from '@lukaswagner/csv-parser';

export function isDateFilterNode(node: Node<unknown>): node is Node<DateFilterNodeData> {
    return node.type === 'filter-date';
}

import { DateTime } from 'luxon';
import { NodeWithStateProps } from '../BasicFlow';

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
    state?: DateFilterNodeState;
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

    // TODO: Find out why i = 0 and i = dateColumn.length < 1 do not work!
    for (let i = 1; i < dateColumn.length - 1; i++) {
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

        for (let i = 1; i < column.length - 1; i++) {
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
    const { state, onChangeState } = data;
    const { isPending, from, to, filteredColumns, dataToFilter, errorMessage } = { ...defaultState, ...state };

    useEffect(() => {
        if (dataToFilter && from && to) {
            try {
                const filteredColumns = filterColumnsByDate(dataToFilter, from, to);
                onChangeState({
                    filteredColumns,
                    isPending: false,
                    errorMessage: undefined,
                });
            } catch (_e: any) {
                const e: Error = _e;
                onChangeState({
                    errorMessage: e.message,
                    isPending: false,
                    filteredColumns: undefined,
                });
            }
        }
    }, [JSON.stringify(dataToFilter), from, to]);

    return (
        <div className={`react-flow__node-default ${selected && 'selected'} ${isPending && 'pending'} ${errorMessage && 'erroneous'} node`}>
            <div className="title" title={errorMessage}>
                Filter: Date Range{isPending ? ' …' : ''}
            </div>
            <div className="handle-wrapper">
                <Handle type="target" position={Position.Left} id="x" className="target-handle" isConnectable={isConnectable}></Handle>
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
                    onChange={(event) => onChangeState({ from: DateTime.fromFormat(event.target.value, 'yyyy-MM-dd') })}
                ></input>
            </div>
            <div className="handle-wrapper nodrag" style={{ alignItems: 'baseline' }}>
                <span style={{ marginRight: '0.5rem' }}>To:</span>
                <input
                    style={{ fontSize: '0.6rem' }}
                    type="date"
                    defaultValue={to.toFormat('yyyy-MM-dd')}
                    onChange={(event) => onChangeState({ to: DateTime.fromFormat(event.target.value, 'yyyy-MM-dd') })}
                ></input>
            </div>

            <hr className="divider" />

            <div className="handle-wrapper">
                <Handle type="source" position={Position.Right} id="out" className="source-handle" isConnectable={isConnectable}></Handle>
                <span className="source-handle-label">
                    {filteredColumns ? (
                        <>
                            <strong>{filteredColumns[0].length}</strong> Dates
                        </>
                    ) : (
                        <em>Filtered data</em>
                    )}
                </span>
            </div>
        </div>
    );
};

export default memo(DateFilterNode);
