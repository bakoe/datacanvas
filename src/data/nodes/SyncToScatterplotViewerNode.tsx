import { FC, memo, useCallback, useEffect, useState } from 'react';
import { Connection, Handle, Node, Position } from 'react-flow-renderer/nocss';

import { ColorChunk, ColorColumn, Column as CSVColumn, NumberColumn } from '@lukaswagner/csv-parser';

import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import { serializeColumnInfo } from './util/serializeColumnInfo';
import { ColorPalette } from './util/EditableColorGradient';
import { DataSource } from '@lukaswagner/csv-parser/lib/types/types/dataSource';
import { getColorForNormalizedValue } from './util/getColorForNormalizedValue';

export function isSyncToScatterplotViewerNode(node: Node<unknown>): node is Node<SyncToScatterplotViewerNodeData> {
    return node.type === NodeTypes.SyncToScatterplotViewer;
}

export enum SyncToScatterplotViewerNodeTargetHandles {
    X = 'x coordinate',
    Y = 'y coordinate',
    Z = 'z coordinate (optional)',
    Size = 'size (optional)',
    Color = 'color (optional)',
}

export const SyncToScatterplotViewerNodeTargetHandlesDatatypes: Map<SyncToScatterplotViewerNodeTargetHandles, Datatypes> = new Map([
    [SyncToScatterplotViewerNodeTargetHandles.X, Datatypes.Column],
    [SyncToScatterplotViewerNodeTargetHandles.Y, Datatypes.Column],
    [SyncToScatterplotViewerNodeTargetHandles.Z, Datatypes.Column],
    [SyncToScatterplotViewerNodeTargetHandles.Size, Datatypes.Column],
    [SyncToScatterplotViewerNodeTargetHandles.Color, Datatypes.Color],
]);

export interface SyncToScatterplotViewerNodeState {
    isPending: boolean;
    xColumn?: CSVColumn;
    yColumn?: CSVColumn;
    zColumn?: CSVColumn;
    sizeColumn?: CSVColumn;
    colors?: {
        column: CSVColumn;
        colorPalette: ColorPalette;
    };
}

export const defaultState = { isPending: true } as SyncToScatterplotViewerNodeState;

export interface SyncToScatterplotViewerNodeData {
    onChangeState: (state: Partial<SyncToScatterplotViewerNodeState>) => void;
    onDeleteNode: () => void;
    state?: SyncToScatterplotViewerNodeState;
    isValidConnection?: (connection: Connection) => boolean;
}

type SyncToScatterplotViewerNodeProps = NodeWithStateProps<SyncToScatterplotViewerNodeData>;

const SyncToScatterplotViewerNode: FC<SyncToScatterplotViewerNodeProps> = ({ isConnectable, selected, data }) => {
    const { state, onChangeState, onDeleteNode, isValidConnection } = data;
    const {
        isPending = defaultState.isPending,
        xColumn = defaultState.xColumn,
        yColumn = defaultState.yColumn,
        zColumn = defaultState.zColumn,
        sizeColumn = defaultState.sizeColumn,
        colors = defaultState.colors,
    } = { ...defaultState, ...state };

    const [childWindow, setChildWindow] = useState(null as Window | null);
    const [childWindowIsReady, setChildWindowIsReady] = useState(false);

    const onChildWindowClose = useCallback(() => {
        // TODO: Prevent automatic re-opening of closed tabs/windows on closing them (due to childWindowIsReady being changed)
        setChildWindow(null);
        setChildWindowIsReady(false);
    }, []);

    const closeChildWindow = () => {
        console.log(childWindow);
        console.log('Closing child window now');
        childWindow?.removeEventListener('beforeunload', onChildWindowClose);
        childWindow?.close();
    };

    useEffect(() => {
        const initializeWindow = () => {
            let child = childWindow;
            console.log(child);

            if (!child) {
                child = window.open('/external/scatterplot-viewer', undefined);
                if (child) {
                    child.addEventListener('message', (msg) => {
                        console.log('Message from sub window', msg);
                        if (msg.data.type === 'ready') {
                            child?.focus();
                            setChildWindowIsReady(true);
                            child?.addEventListener('beforeunload', onChildWindowClose);
                        }
                    });
                }
                setChildWindow(child);
            }
        };

        let columnsData = [] as CSVColumn[];
        const configuration = { axes: [], pointSize: 0.02 } as {
            axes: string[];
            name?: string;
            csv?: DataSource;
            delimiter?: string;
            pointSize?: number;
            colorMode?: number;
            colorMapping?: number;
            colorColumn?: string;
            variablePointSizeStrength?: number;
            variablePointSizeColumn?: string;
        };

        if (xColumn && yColumn && zColumn) {
            initializeWindow();
            if (!childWindowIsReady) return;
            columnsData = [xColumn, yColumn, zColumn];
            configuration.axes = [xColumn.name, yColumn.name, zColumn.name];
        } else if (xColumn && yColumn) {
            initializeWindow();
            if (!childWindowIsReady) return;
            columnsData = [xColumn, yColumn];
            configuration.axes = [xColumn.name, yColumn.name];
        }

        if (sizeColumn) {
            columnsData.push(sizeColumn);
            configuration.variablePointSizeStrength = 0.05;
            configuration.variablePointSizeColumn = sizeColumn.name;
        }

        if (colors && colors.column) {
            const minColorValue = (colors.column as NumberColumn).min;
            const maxColorValue = (colors.column as NumberColumn).max;

            const colorColumnName = `${colors.column.name}_color`;

            const column = new ColorColumn(colorColumnName);
            const chunk = new ColorChunk(colors.column.length, 0);
            for (let index = 0; index < colors.column.length; index++) {
                const colorValue = colors.column.get(index) as number;
                const normalizedColorValue = (colorValue - minColorValue) / (maxColorValue - minColorValue);
                let r = 1;
                let g = 1;
                let b = 1;
                if (normalizedColorValue !== undefined) {
                    [r, g, b] = getColorForNormalizedValue(normalizedColorValue, colors.colorPalette);
                }
                chunk.set(index, [r, g, b, 1.0]);
            }
            column.push(chunk);
            columnsData.push(column);
            // Vertex color mode
            configuration.colorMode = 2;
            configuration.colorColumn = colorColumnName;
        } else {
            // Position-based coloring
            configuration.colorMode = 1;
        }

        if (columnsData.length > 0) {
            childWindow?.postMessage({ type: 'columns', data: columnsData });
        }

        childWindow?.postMessage({ type: 'configuration', data: configuration });

        if (xColumn && yColumn) {
            onChangeState({
                isPending: false,
            });
            return;
        }

        closeChildWindow();
        onChildWindowClose();
        onChangeState({
            isPending: true,
        });
    }, [
        serializeColumnInfo(xColumn),
        serializeColumnInfo(yColumn),
        serializeColumnInfo(zColumn),
        serializeColumnInfo(sizeColumn),
        colors ? `${serializeColumnInfo(colors.column)}_${JSON.stringify(colors.colorPalette)}` : 'undefined',
        childWindowIsReady,
    ]);

    return (
        <div className={`react-flow__node-default node ${selected && 'selected'} ${isPending && 'pending'}`}>
            <div className="title-wrapper">
                <div className="title">
                    <a
                        onPointerDown={() => {
                            if (childWindow) childWindow.focus();
                        }}
                    >
                        ⎋
                    </a>{' '}
                    Scatterplot
                </div>
                <div className="title-actions">
                    <span>
                        <a
                            onPointerUp={() => {
                                closeChildWindow();
                                onDeleteNode();
                            }}
                        >
                            ✕
                        </a>
                    </span>
                </div>
            </div>
            {Array.from(SyncToScatterplotViewerNodeTargetHandlesDatatypes).map(([targetHandle, datatype]) => {
                return (
                    <div className="handle-wrapper" key={targetHandle}>
                        <Handle
                            type="target"
                            position={Position.Left}
                            id={targetHandle}
                            className={`target-handle ${datatype === Datatypes.Dataset ? 'handle-dataset' : ''}`}
                            isConnectable={isConnectable}
                            isValidConnection={isValidConnection}
                            data-invalid-connection-tooltip={`You have to connect an output of type “${datatype}” here.`}
                        ></Handle>
                        <span className="target-handle-label">{targetHandle}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default memo(SyncToScatterplotViewerNode);
