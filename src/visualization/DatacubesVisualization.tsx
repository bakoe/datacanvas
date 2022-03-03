import React, { PropsWithChildren } from 'react';

import { distinctUntilChanged } from 'rxjs/operators';

import { ReactFlowState, useStore, XYPosition, useStoreApi, NodeDiffUpdate } from 'react-flow-renderer/nocss';

import shallow from 'zustand/shallow';

import { DatacubesApplication } from './DatacubesApplication';

import { isDatasetNode, makeTypeHumanReadable } from '../data/nodes/DatasetNode';
import { isDateFilterNode } from '../data/nodes/DateFilterNode';
import { isPointPrimitiveNode } from '../data/nodes/PointPrimitiveNode';
import { NodeTypes } from '../data/nodes/enums/NodeTypes';
import { Column as CSVColumn } from '@lukaswagner/csv-parser';
import { ColorPalette } from '../data/nodes/util/EditableColorGradient';
import { serializeColumnInfo } from '../data/nodes/util/serializeColumnInfo';
import { isColorMappingNode } from '../data/nodes/ColorMappingNode';
import { isSyncToScatterplotViewerNode } from '../data/nodes/SyncToScatterplotViewerNode';
import { isFixedTextNode } from '../data/nodes/FixedTextNode';
import { isMeshPrimitiveNode } from '../data/nodes/MeshPrimitiveNode';
import { isCubePrimitiveNode } from '../data/nodes/CubePrimitiveNode';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DatacubesProps {}

const SET_CUBOID_EXTENT_FROM_FLOW_EDITOR_NODE_SIZE = false;

export interface DatacubeInformation {
    id: number;
    position?: XYPosition;
    relativeHeight: number;
    type: NodeTypes;
    extent: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
    };
    isPending?: boolean;
    isErroneous?: boolean;
    isSelected?: boolean;
    isFocused?: boolean;
    xColumn?: CSVColumn;
    yColumn?: CSVColumn;
    zColumn?: CSVColumn;
    sizeColumn?: CSVColumn;
    colors?: {
        column: CSVColumn;
        colorPalette: ColorPalette;
    };
    // TODO: Make gltfloader's loadAsset method accept File objects (as gltf-loader's load method accepts either way) to pass File instead of data URL
    // gltfAssetFile?: File;
    gltfAssetUri?: string;
    gltfAssetScale?: number;
    labelString?: string;
}

const selector = (s: ReactFlowState) => ({
    updateNodePosition: s.updateNodePosition,
    unselectNodesAndEdges: s.unselectNodesAndEdges,
    nodeInternals: s.nodeInternals,
});

export const DatacubesVisualization: React.FC<DatacubesProps> = ({ ...props }: PropsWithChildren<DatacubesProps>) => {
    const store = useStoreApi();
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const spinnerRef = React.useRef<HTMLDivElement | null>(null);
    const [application, setApplication] = React.useState<DatacubesApplication | undefined>(undefined);

    const { updateNodePosition, unselectNodesAndEdges } = useStore(selector, shallow);

    const [nodeIdSelectedFromWebGL, setNodeIdSelectedFromWebGL] = React.useState(undefined);

    // Initialization -- runs only once (due to the empty list of dependencies passed to useEffect as its 2nd parameter)
    React.useEffect(() => {
        if (canvasRef.current) {
            const exampleInstance = new DatacubesApplication();
            exampleInstance.initialize(canvasRef.current, spinnerRef.current || undefined);
            setApplication(exampleInstance);
            exampleInstance.datacubes$?.subscribe((datacubes: Array<DatacubeInformation>) => {
                if (!nodeIdSelectedFromWebGL) {
                    unselectNodesAndEdges();
                }

                const nodeInternals = store.getState().nodeInternals;
                nodeInternals.forEach((node) => {
                    const id = parseInt(node.id, 10);
                    const datacube = datacubes.find((dc) => dc.id === id);
                    if (datacube && datacube.position) {
                        const newX = datacube.position.x * REACT_FLOW_CANVAS_STEP + REACT_FLOW_CANVAS_MIN_X;
                        const newY = datacube.position.y * REACT_FLOW_CANVAS_STEP + REACT_FLOW_CANVAS_MIN_Y;

                        const deltaX = newX - node.position.x;
                        const deltaY = newY - node.position.y;

                        if (Math.abs(deltaX) < 1e-3 && Math.abs(deltaY) < 1e-3) {
                            return;
                        }

                        updateNodePosition({
                            id: node.id,
                            diff: { x: deltaX, y: deltaY },
                        } as NodeDiffUpdate);
                    }
                    if (datacube && datacube.extent) {
                        store.setState({
                            nodeInternals: store.getState().nodeInternals.set(`${id}`, {
                                ...(store.getState().nodeInternals.get(`${id}`) as any),
                                data: {
                                    ...(store.getState().nodeInternals.get(`${id}`) as any).data,
                                    state: {
                                        ...(store.getState().nodeInternals.get(`${id}`) as any).data.state,
                                        extent: {
                                            ...(store.getState().nodeInternals.get(`${id}`) as any).data.state.extent,
                                            ...datacube.extent,
                                        },
                                    },
                                },
                            }),
                        });
                    }
                });
            });

            exampleInstance.datacubesPointerUpEvents$?.subscribe((event: PointerEvent) => {
                if ((event as any).data !== undefined && (event as any).data.datacubeID !== undefined) {
                    setNodeIdSelectedFromWebGL((event as any).data.datacubeID);
                } else {
                    setNodeIdSelectedFromWebGL(undefined);
                }
            });

            exampleInstance.datacubesPointerMoveEvents$
                ?.pipe(distinctUntilChanged((prev: any, curr: any) => prev.data === curr.data))
                .subscribe((event: PointerEvent) => {
                    let cursorSet = false;

                    if ((event as any).data !== undefined && (event as any).data.datacubeID !== undefined) {
                        setNodeIdSelectedFromWebGL((event as any).data.datacubeID);
                    } else {
                        setNodeIdSelectedFromWebGL(undefined);
                    }

                    if ((event as any).data !== undefined && (event as any).data.cuboidBboxHovered !== undefined) {
                        const datacubeId = (event as any).data.datacubeID;
                        const matchingDatacube = store.getState().nodeInternals.get(`${datacubeId}`);
                        if (matchingDatacube?.type === NodeTypes.PointPrimitive) {
                            const cuboidBboxHovered = (event as any).data.cuboidBboxHovered as {
                                xMin: boolean;
                                xMax: boolean;
                                yMin: boolean;
                                yMax: boolean;
                                zMin: boolean;
                                zMax: boolean;
                            };

                            const { xMin, xMax, yMin, yMax, zMin, zMax } = cuboidBboxHovered;

                            if (yMin || yMax) {
                                if ((xMax && zMax) || (xMin && zMin)) {
                                    document.body.style.cursor = 'nwse-resize';
                                    cursorSet = true;
                                } else if ((xMax && zMin) || (xMin && zMax)) {
                                    document.body.style.cursor = 'nesw-resize';
                                    cursorSet = true;
                                } else if (xMax || xMin) {
                                    document.body.style.cursor = 'ew-resize';
                                    cursorSet = true;
                                } else if (zMin || zMax) {
                                    document.body.style.cursor = 'ns-resize';
                                    cursorSet = true;
                                }
                            }
                        }
                    }

                    if (!cursorSet) {
                        document.body.style.cursor = 'unset';
                    }
                });
        }

        // Commented-out to avoid infinite recursion in application's uninitialization(?)
        // return () => {
        //     if (application) {
        //         application.uninitialize();
        //     }
        // };
    }, []);

    React.useEffect(() => {
        unselectNodesAndEdges();

        if (nodeIdSelectedFromWebGL === undefined) {
            return;
        }

        store.setState({
            nodeInternals: store.getState().nodeInternals.set(`${nodeIdSelectedFromWebGL}`, {
                ...(store.getState().nodeInternals.get(`${nodeIdSelectedFromWebGL}`) as any),
                selected: true,
            }),
        });
    }, [nodeIdSelectedFromWebGL]);

    const nodeInformations = useStore((state: ReactFlowState) => {
        const maxRowCounts = Array.from(state.nodeInternals)
            .filter(([, node]) => isDatasetNode(node) || isDateFilterNode(node))
            .map(([, node]) => {
                if (isDatasetNode(node)) {
                    const colRowCounts = node.data.state?.columns?.map((col) => col.length);
                    return Math.max(...(colRowCounts || [0.0]));
                }
                if (isDateFilterNode(node)) {
                    const colRowCounts = node.data.state?.filteredColumns?.map((col) => col.length);
                    return Math.max(...(colRowCounts || [0.0]));
                }
                return 0;
            })
            .filter((maxRowCount) => maxRowCount !== 0);
        const overallMaxRowCount = maxRowCounts.length > 0 ? Math.max(...maxRowCounts) : undefined;
        return Array.from(state.nodeInternals)
            .map(([, node]) => {
                let relativeHeight = 1.0;

                let defaultExtent = {
                    minX: -0.25,
                    maxX: 0.25,
                    minZ: -0.25,
                    maxZ: 0.25,
                };

                if (SET_CUBOID_EXTENT_FROM_FLOW_EDITOR_NODE_SIZE) {
                    const width = (node as any).width;
                    const height = (node as any).height;

                    if (width && height) {
                        let relativeX = width / (272 - 172);
                        let relativeZ = height / (211 - 95);

                        relativeX = Math.max(1.0, Math.min(8.0, relativeX));
                        relativeZ = Math.max(1.0, Math.min(8.0, relativeZ));
                        relativeX *= 0.5;
                        relativeZ *= 0.5;

                        defaultExtent = {
                            minX: -0.25,
                            maxX: relativeX * 0.5 - 0.25,
                            minZ: -0.25,
                            maxZ: relativeZ * 0.5 - 0.25,
                        };
                    }
                }

                const extent = (node as any).data?.state?.extent || defaultExtent;
                let isErroneous = false;
                let isPending: undefined | boolean = false;
                let xColumn = undefined as undefined | CSVColumn;
                let yColumn = undefined as undefined | CSVColumn;
                let zColumn = undefined as undefined | CSVColumn;
                let sizeColumn = undefined as undefined | CSVColumn;
                let colors = undefined as undefined | { column: CSVColumn; colorPalette: ColorPalette };
                let gltfAssetUri = undefined as undefined | string;
                let gltfAssetScale = 1.0;
                let labelString = '';
                const isSelected = node.selected;
                if (isFixedTextNode(node)) {
                    return undefined;
                }
                if (
                    isDatasetNode(node) ||
                    isDateFilterNode(node) ||
                    isPointPrimitiveNode(node) ||
                    isCubePrimitiveNode(node) ||
                    isMeshPrimitiveNode(node) ||
                    isColorMappingNode(node) ||
                    isSyncToScatterplotViewerNode(node)
                ) {
                    if (isDatasetNode(node)) {
                        // labelString += node.data.filename;
                        const typeString = makeTypeHumanReadable(node.data.type);
                        labelString += (typeString ? typeString + ' ' : '') + 'Dataset';
                        if (overallMaxRowCount) {
                            const colRowCounts = node.data.state?.columns?.map((col) => col.length);
                            if (colRowCounts) {
                                relativeHeight = Math.max(...colRowCounts) / overallMaxRowCount;
                                labelString += `\n${node.data.state?.columns?.length} columns • ${colRowCounts[0]} rows`;
                            }
                        }
                        isPending = node.data.state?.isLoading;
                    }
                    if (isDateFilterNode(node)) {
                        labelString += 'Filter: Date Range';
                        if (overallMaxRowCount) {
                            const colRowCounts = node.data.state?.filteredColumns?.map((col) => col.length);
                            if (colRowCounts) {
                                relativeHeight = Math.max(...colRowCounts) / overallMaxRowCount;
                            }
                        }
                        isErroneous = node.data.state?.errorMessage !== undefined;
                        isPending = node.data.state?.isPending;
                    }
                    if (isColorMappingNode(node)) {
                        labelString += 'Mapping: Color Mapping';
                        isPending = node.data.state?.isPending;
                    }
                    if (isPointPrimitiveNode(node)) {
                        labelString += 'Rendering: Point Primitive';
                        isPending = node.data.state?.isPending;
                        xColumn = node.data.state?.xColumn;
                        yColumn = node.data.state?.yColumn;
                        zColumn = node.data.state?.zColumn;
                        sizeColumn = node.data.state?.sizeColumn;
                        colors = node.data.state?.colors;
                    }
                    if (isCubePrimitiveNode(node)) {
                        labelString += 'Rendering: Cube Primitive';
                        isPending = node.data.state?.isPending;
                        xColumn = node.data.state?.xColumn;
                        yColumn = node.data.state?.yColumn;
                        zColumn = node.data.state?.zColumn;
                        sizeColumn = node.data.state?.sizeColumn;
                        colors = node.data.state?.colors;
                    }
                    if (isMeshPrimitiveNode(node)) {
                        labelString += 'Rendering: Mesh Primitive';
                        gltfAssetUri = node.data.gltfAssetUri;
                        gltfAssetScale = node.data.state?.scale || gltfAssetScale;
                        xColumn = node.data.state?.xColumn;
                        yColumn = node.data.state?.yColumn;
                        zColumn = node.data.state?.zColumn;
                        sizeColumn = node.data.state?.sizeColumn;
                        colors = node.data.state?.colors;
                    }
                    if (isSyncToScatterplotViewerNode(node)) {
                        labelString += 'Rendering: Sync to Scatterplot Viewer';
                        isPending = node.data.state?.isPending;
                    }
                }
                return {
                    position: node.position,
                    extent,
                    id: parseInt(node.id, 10),
                    relativeHeight,
                    type: node.type,
                    isErroneous,
                    isPending,
                    isFocused: node.data?.state?.isFocused ?? false,
                    xColumn,
                    yColumn,
                    zColumn,
                    sizeColumn,
                    colors,
                    gltfAssetUri,
                    gltfAssetScale,
                    labelString: isSelected ? labelString : '',
                    isSelected,
                } as DatacubeInformation;
            })
            .filter((datacube) => datacube !== undefined) as DatacubeInformation[];
    });

    const REACT_FLOW_CANVAS_MIN_X = 400;
    const REACT_FLOW_CANVAS_MIN_Y = 20;
    const REACT_FLOW_CANVAS_STEP = 300;

    React.useEffect(() => {
        if (application) {
            (application as DatacubesApplication).datacubes = nodeInformations;
        }
    }, [
        application,
        JSON.stringify(
            nodeInformations.map((nodeInfo) => ({
                // Caution: No nodeInfo.position here -> this update is handled in 2nd useEffect hook below!
                id: nodeInfo.id,
                extent: nodeInfo.extent,
                relativeHeight: nodeInfo.relativeHeight,
                type: nodeInfo.type,
                isErroneous: nodeInfo.isErroneous,
                isPending: nodeInfo.isPending,
                isFocused: nodeInfo.isFocused,
                xColumn: serializeColumnInfo(nodeInfo.xColumn),
                yColumn: serializeColumnInfo(nodeInfo.yColumn),
                zColumn: serializeColumnInfo(nodeInfo.zColumn),
                sizeColumn: serializeColumnInfo(nodeInfo.sizeColumn),
                colorsLengthAndPalette: nodeInfo.colors
                    ? `${serializeColumnInfo(nodeInfo.colors.column)}_${JSON.stringify(nodeInfo.colors.colorPalette)}`
                    : undefined,
                gltfAssetUri: nodeInfo.gltfAssetUri,
                gltfAssetScale: nodeInfo.gltfAssetScale,
                labelString: nodeInfo.labelString,
                isSelected: nodeInfo.isSelected,
            })),
        ),
    ]);

    React.useEffect(() => {
        if (application) {
            const nodeIdToPositionMap = new Map<number, XYPosition>();
            for (const { position, id } of nodeInformations) {
                if (position) {
                    nodeIdToPositionMap.set(id, {
                        x: (position.x - REACT_FLOW_CANVAS_MIN_X) / REACT_FLOW_CANVAS_STEP,
                        y: (position.y - REACT_FLOW_CANVAS_MIN_Y) / REACT_FLOW_CANVAS_STEP,
                    });
                }
            }
            (application as DatacubesApplication).datacubePositions = nodeIdToPositionMap;
        }
    }, [
        application,
        JSON.stringify(
            nodeInformations.map((nodeInfo) => ({
                id: nodeInfo.id,
                position: nodeInfo.position,
            })),
        ),
    ]);

    return (
        <div className="canvas-container">
            <canvas className="canvas" ref={canvasRef} data-clear-color="0.20392157, 0.22745098, 0.25098039, 1.0" />
            <div className="spinner" ref={spinnerRef}>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
            <div className="canvas-overlay">{props.children}</div>
        </div>
    );
};
