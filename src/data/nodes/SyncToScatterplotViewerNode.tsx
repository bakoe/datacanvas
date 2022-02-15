import { FC, memo, useEffect } from 'react';
import { Connection, Edge, Handle, Node, Position } from 'react-flow-renderer/nocss';

import { Column as CSVColumn } from '@lukaswagner/csv-parser';

import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import { serializeColumnInfo } from './util/serializeColumnInfo';
import { ColorPalette } from './util/EditableColorGradient';

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
    const { isPending = true, xColumn = undefined, yColumn = undefined, zColumn = undefined } = { ...defaultState, ...state };

    useEffect(() => {
        if (xColumn && yColumn) {
            onChangeState({
                isPending: false,
            });
        }
    }, [serializeColumnInfo(xColumn), serializeColumnInfo(yColumn), serializeColumnInfo(zColumn)]);

    return (
        <div className={`react-flow__node-default node ${selected && 'selected'} ${isPending && 'pending'}`}>
            <div className="title-wrapper">
                <div className="title">⎋ Scatterplot</div>
                <div className="title-actions">
                    <span>
                        <a onPointerUp={onDeleteNode}>✕</a>
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
