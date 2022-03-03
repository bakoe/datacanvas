import { FC, memo, useEffect } from 'react';
import { Connection, Edge, Handle, Node, Position } from 'react-flow-renderer/nocss';

import { Column as CSVColumn } from '@lukaswagner/csv-parser';

import { NodeWithStateProps } from '../BasicFlow';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import { serializeColumnInfo } from './util/serializeColumnInfo';
import { ColorPalette } from './util/EditableColorGradient';
import { GltfAsset } from 'gltf-loader-ts';

export function isMeshPrimitiveNode(node: Node<unknown>): node is Node<MeshPrimitiveNodeData> {
    return node.type === NodeTypes.MeshPrimitive;
}

export enum MeshPrimitiveNodeTargetHandles {
    X = 'x coordinate',
    Y = 'y coordinate (optional)',
    Z = 'z coordinate (optional)',
    Size = 'size (optional)',
    Color = 'color (optional)',
}

export const MeshPrimitiveNodeTargetHandlesDatatypes: Map<MeshPrimitiveNodeTargetHandles, Datatypes> = new Map([
    [MeshPrimitiveNodeTargetHandles.X, Datatypes.Column],
    [MeshPrimitiveNodeTargetHandles.Y, Datatypes.Column],
    [MeshPrimitiveNodeTargetHandles.Z, Datatypes.Column],
    [MeshPrimitiveNodeTargetHandles.Size, Datatypes.Column],
    [MeshPrimitiveNodeTargetHandles.Color, Datatypes.Color],
]);

export interface MeshPrimitiveNodeState {
    isPending: boolean;
    scale: number;
    xColumn?: CSVColumn;
    yColumn?: CSVColumn;
    zColumn?: CSVColumn;
    sizeColumn?: CSVColumn;
    colors?: {
        column: CSVColumn;
        colorPalette: ColorPalette;
    };
}

export const defaultState = { isPending: true, scale: 1.0 } as MeshPrimitiveNodeState;

export interface MeshPrimitiveNodeData {
    onChangeState: (state: Partial<MeshPrimitiveNodeState>) => void;
    onDeleteNode: () => void;
    state?: MeshPrimitiveNodeState;
    // TODO: Make gltfloader's loadAsset method accept File objects (as gltf-loader's load method accepts either way) to pass File instead of data URL
    // gltfAssetFile?: File;
    gltfAssetUri?: string;
    isValidConnection?: (connection: Connection) => boolean;
}

type MeshPrimitiveNodeProps = NodeWithStateProps<MeshPrimitiveNodeData>;

const onConnect = (params: Connection | Edge) => console.log('handle onConnect on MeshPrimitiveNode', params);

const MeshPrimitiveNode: FC<MeshPrimitiveNodeProps> = ({ isConnectable, selected, data }) => {
    const { state, onChangeState, onDeleteNode, isValidConnection } = data;
    const {
        isPending = true,
        scale,
        xColumn = undefined,
        yColumn = undefined,
        zColumn = undefined,
    } = { ...defaultState, ...state } as MeshPrimitiveNodeState;

    useEffect(() => {
        if (xColumn) {
            onChangeState({
                isPending: false,
            });
            return;
        }
        onChangeState({
            isPending: true,
        });
    }, [serializeColumnInfo(xColumn), serializeColumnInfo(yColumn), serializeColumnInfo(zColumn)]);

    return (
        <div className={`react-flow__node-default node ${selected && 'selected'} ${isPending && 'pending'} category-rendering`}>
            <div className="title-wrapper">
                <div className="title">Mesh Primitive{isPending ? ' …' : ''}</div>
                <div className="title-actions">
                    <span>
                        <a onPointerUp={onDeleteNode}>✕</a>
                    </span>
                </div>
            </div>
            {Array.from(MeshPrimitiveNodeTargetHandlesDatatypes).map(([targetHandle, datatype]) => {
                return (
                    <div className="handle-wrapper" key={targetHandle}>
                        <Handle
                            type="target"
                            position={Position.Left}
                            id={targetHandle}
                            className={`target-handle ${datatype === Datatypes.Dataset ? 'handle-dataset' : ''}`}
                            isConnectable={isConnectable}
                            onConnect={onConnect}
                            isValidConnection={isValidConnection}
                            data-invalid-connection-tooltip={`You have to connect an output of type “${datatype}” here.`}
                        ></Handle>
                        <span className="target-handle-label">{targetHandle}</span>
                    </div>
                );
            })}

            <hr className="divider" />

            <div className="nodrag">
                <table style={{ textAlign: 'right', width: 'calc(100% + 2px)', borderSpacing: '2px' }}>
                    <tbody>
                        <tr>
                            <td>
                                <label htmlFor="scale">Scale:</label>
                            </td>
                            <td>
                                <input
                                    id="scale"
                                    type="number"
                                    step={0.05}
                                    value={scale}
                                    onChange={(event) => {
                                        onChangeState({
                                            scale: event.target.valueAsNumber,
                                        });
                                    }}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default memo(MeshPrimitiveNode);
