import { MouseEvent, useMemo, useState, DragEvent, useEffect, useCallback, ChangeEvent, useRef } from 'react';
import { createPortal } from 'react-dom';

import ReactFlow, {
    addEdge,
    Background,
    BackgroundVariant,
    Node,
    Edge,
    Connection,
    useNodesState,
    useEdgesState,
    ReactFlowInstance,
    XYPosition,
    NodeProps,
    NodeTypesType,
    useStoreApi,
    NodeChange,
    applyNodeChanges,
    StartHandle,
} from 'react-flow-renderer/nocss';
import ColorMappingNode, {
    ColorMappingNodeData,
    ColorMappingNodeSourceHandles,
    ColorMappingNodeState,
    ColorMappingNodeTargetHandles,
    defaultState as ColorMappingNodeDefaultState,
} from './nodes/ColorMappingNode';

import { usePopper } from 'react-popper';

import DatasetNode, {
    DatasetNodeData,
    DatasetNodeState,
    defaultState as DatasetNodeDefaultState,
    mapMimetypeToNodeFiletype,
} from './nodes/DatasetNode';
import DateFilterNode, {
    DateFilterNodeData,
    DateFilterNodeState,
    defaultState as DateFilterNodeDefaultState,
    guessDateColumn,
} from './nodes/DateFilterNode';
import { NodeTypes } from './nodes/enums/NodeTypes';
import PointPrimitiveNode, {
    defaultState as PointPrimitiveNodeDefaultState,
    PointPrimitiveNodeData,
    PointPrimitiveNodeState,
    PointPrimitiveNodeTargetHandles,
} from './nodes/PointPrimitiveNode';
import LinePrimitiveNode, {
    defaultState as LinePrimitiveNodeDefaultState,
    LinePrimitiveNodeData,
    LinePrimitiveNodeState,
    LinePrimitiveNodeTargetHandles,
} from './nodes/LinePrimitiveNode';
import CubePrimitiveNode, {
    defaultState as CubePrimitiveNodeDefaultState,
    CubePrimitiveNodeData,
    CubePrimitiveNodeState,
    CubePrimitiveNodeTargetHandles,
} from './nodes/CubePrimitiveNode';
import { vec2 } from 'webgl-operate';
import SyncToScatterplotViewerNode, {
    defaultState as SyncToScatterplotViewerNodeDefaultState,
    SyncToScatterplotViewerNodeData,
    SyncToScatterplotViewerNodeState,
    SyncToScatterplotViewerNodeTargetHandles,
} from './nodes/SyncToScatterplotViewerNode';
import FixedTextNode, { FixedTextNodeData } from './nodes/FixedTextNode';
import MeshPrimitiveNode, {
    defaultState as MeshPrimitiveNodeDefaultState,
    MeshPrimitiveNodeData,
    MeshPrimitiveNodeState,
    MeshPrimitiveNodeTargetHandles,
} from './nodes/MeshPrimitiveNode';

const onNodeDragStop = (_: MouseEvent, node: Node) => undefined;
const onNodeClick = (_: MouseEvent, node: Node) => undefined;

const findSourceColumn = (sourceNode: Node<any>, params: Edge<any> | Connection) => {
    let sourceColumn;
    switch (sourceNode.type as NodeTypes) {
        case NodeTypes.Dataset:
            sourceColumn = (sourceNode as Node<DatasetNodeData>).data.state?.columns?.find((column) => column.name === params.sourceHandle);
            break;
        case NodeTypes.DateFilter:
            sourceColumn = (sourceNode as Node<DateFilterNodeData>).data.state?.filteredColumns?.find(
                (column) => column.name === params.sourceHandle,
            );
            break;
        case NodeTypes.SyncToScatterplotViewer:
            // TODO: Find a cleaner solution here, e.g., taking the Datatypes.Color enum value into account
            if (params.targetHandle?.includes('color')) {
                sourceColumn = {
                    column: (sourceNode as Node<SyncToScatterplotViewerNodeData>).data.state?.filteredColorColumn,
                    colorPalette: (sourceNode as Node<SyncToScatterplotViewerNodeData>).data.state?.colors?.colorPalette,
                };
            } else {
                sourceColumn = (sourceNode as Node<SyncToScatterplotViewerNodeData>).data.state?.filteredColumns?.find(
                    (column) => column.name === params.sourceHandle,
                );
            }

            break;
        case NodeTypes.ColorMapping:
            sourceColumn = {
                column: (sourceNode as Node<ColorMappingNodeData>).data.state?.column,
                colorPalette: (sourceNode as Node<ColorMappingNodeData>).data.state?.colorPalette,
            };
            break;
    }
    return sourceColumn;
};

const getFileMimetypes = (dataTransfer: DataTransfer): string[] => {
    const fileMimeTypes = [] as string[];
    if (dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for (let i = 0; i < dataTransfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (dataTransfer.items[i].kind === 'file') {
                fileMimeTypes.push(dataTransfer.items[i].type);
            }
        }
    } else {
        // Use DataTransfer interface to access the file(s)
        for (let i = 0; i < dataTransfer.files.length; i++) {
            fileMimeTypes.push(dataTransfer.files[i].type);
        }
    }
    return fileMimeTypes;
};

const getFileNames = (dataTransfer: DataTransfer): string[] => {
    const fileNames = [] as string[];
    if (dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for (let i = 0; i < dataTransfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (dataTransfer.items[i].kind === 'file') {
                const file = dataTransfer.items[i].getAsFile();
                fileNames.push(file?.name || '(invalid)');
            }
        }
    } else {
        // Use DataTransfer interface to access the file(s)
        for (let i = 0; i < dataTransfer.files.length; i++) {
            fileNames.push(dataTransfer.files[i].name);
        }
    }
    return fileNames;
};

const getFiles = (dataTransfer: DataTransfer): File[] => {
    const files = [] as File[];
    if (dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for (let i = 0; i < dataTransfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (dataTransfer.items[i].kind === 'file') {
                const file = dataTransfer.items[i].getAsFile();
                if (file) {
                    files.push(file);
                }
            }
        }
    } else {
        // Use DataTransfer interface to access the file(s)
        for (let i = 0; i < dataTransfer.files.length; i++) {
            if (dataTransfer.files[i]) {
                files.push(dataTransfer.files[i]);
            }
        }
    }
    return files;
};

const getValidXPositionRangeByNodeType = (nodeType: NodeTypes): [number, number] => {
    const GROUP_COLUMNS_START_AT = 0;

    const columnWidthsAndGutters = [
        {
            width: 0,
            gutter: 300,
        },
        {
            width: 0,
            gutter: 300,
        },
        {
            width: 0,
            gutter: 200,
        },
        {
            width: 0,
            gutter: 200,
        },
    ];

    switch (nodeType as NodeTypes) {
        case NodeTypes.FixedText:
            return [-Infinity, Infinity];
        case NodeTypes.Dataset:
            return [-Infinity, GROUP_COLUMNS_START_AT + columnWidthsAndGutters[0].width];
        case NodeTypes.DateFilter:
            return [
                GROUP_COLUMNS_START_AT + columnWidthsAndGutters[0].width + columnWidthsAndGutters[0].gutter,
                GROUP_COLUMNS_START_AT +
                    columnWidthsAndGutters[0].width +
                    columnWidthsAndGutters[0].gutter +
                    columnWidthsAndGutters[1].width,
            ];
        case NodeTypes.ColorMapping:
            return [
                GROUP_COLUMNS_START_AT +
                    columnWidthsAndGutters[0].width +
                    columnWidthsAndGutters[0].gutter +
                    columnWidthsAndGutters[1].width +
                    columnWidthsAndGutters[1].gutter,
                GROUP_COLUMNS_START_AT +
                    GROUP_COLUMNS_START_AT +
                    columnWidthsAndGutters[0].width +
                    columnWidthsAndGutters[0].gutter +
                    columnWidthsAndGutters[1].width +
                    columnWidthsAndGutters[1].gutter +
                    columnWidthsAndGutters[2].width,
            ];
        case NodeTypes.PointPrimitive:
        case NodeTypes.LinePrimitive:
        case NodeTypes.CubePrimitive:
        case NodeTypes.MeshPrimitive:
        case NodeTypes.SyncToScatterplotViewer:
            return [
                GROUP_COLUMNS_START_AT +
                    columnWidthsAndGutters[0].width +
                    columnWidthsAndGutters[0].gutter +
                    columnWidthsAndGutters[1].width +
                    columnWidthsAndGutters[1].gutter +
                    columnWidthsAndGutters[2].width +
                    columnWidthsAndGutters[2].gutter,
                Infinity,
            ];
        default:
            return [-Infinity, Infinity];
    }
};

const getNextXYPositionForNodeType = (nodeType: NodeTypes): XYPosition => {
    // TODO: Implement, based on either nodeInternals or useState-kept look-up table
    return { x: 100, y: 100 } as XYPosition;
};

const clampXYPositionByNodeType = (xyPosition: XYPosition, nodeType: NodeTypes): XYPosition => {
    const [minX, maxX] = getValidXPositionRangeByNodeType(nodeType);
    return {
        x: Math.max(minX, Math.min(maxX, xyPosition.x)),
        y: Math.max(60, xyPosition.y),
    } as XYPosition;
};

let id = 4;
const getId = () => `${id}`;

const initialEdges: Edge[] = [];

export interface NodeWithStateProps<T> extends NodeProps {
    state: T;
}

const BasicFlow = () => {
    const store = useStoreApi();

    const isValidConnection = (): boolean => {
        return true;
    };

    const initialNodes: Node[] = [
        {
            type: NodeTypes.FixedText,
            id: '-4',
            data: {
                text: '1: Data Sources',
                align: 'left',
            },
            selectable: false,
            draggable: false,
            position: {
                x: 0,
                y: 0,
            },
        } as Node<FixedTextNodeData>,
        {
            type: NodeTypes.FixedText,
            id: '-3',
            data: {
                text: '2: Filtering',
                align: 'left',
            },
            selectable: false,
            draggable: false,
            position: {
                x: 300,
                y: 0,
            },
        } as Node<FixedTextNodeData>,
        {
            type: NodeTypes.FixedText,
            id: '-2',
            data: {
                text: '3: Mapping',
                align: 'left',
            },
            selectable: false,
            draggable: false,
            position: {
                x: 600,
                y: 0,
            },
        } as Node<FixedTextNodeData>,
        {
            type: NodeTypes.FixedText,
            id: '-1',
            data: {
                text: '4: Rendering',
                align: 'left',
            },
            selectable: false,
            draggable: false,
            position: {
                x: 800,
                y: 0,
            },
        } as Node<FixedTextNodeData>,
    ];

    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance>();
    const [nodes] = useNodesState(initialNodes);
    const [edges] = useEdgesState(initialEdges);
    const [dragInProgress, setDragInProgress] = useState(false);
    const [dragCoords, setDragCoords] = useState<XYPosition | undefined>(undefined);

    // Triggered if a handle is dragged out of its connection and dropped somewhere outside a handle (i.e., on the blank canvas)
    const onEdgeUpdateEnd = (_event: any, updatedEdge: Edge) => {
        onDisconnect(updatedEdge);

        const connectedNodes = Array.from(store.getState().nodeInternals)
            .filter(([nodeId]) => updatedEdge.target === nodeId || updatedEdge.source === nodeId)
            .map(([, node]) => node);
        if (connectedNodes.length > 0) {
            for (const connectedNode of connectedNodes) {
                console.log(`Updating node ${connectedNode.id} because of edge disconnection`);
                propagateNodeChanges(connectedNode.id);
            }
        }
    };

    const setNodes = useCallback((payload: Node<any>[] | ((nodes: Node<any>[]) => Node<any>[])) => {
        // TODO: Find out why using the following onNodesChange method apparently does not update the internal state properly
        // const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

        // Copied from react-flow: src/hooks/useReactFlow.ts
        const { nodeInternals, setNodes } = store.getState();
        const nodes = Array.from(nodeInternals.values());
        const nextNodes = typeof payload === 'function' ? payload(nodes) : payload;

        setNodes(nextNodes);
    }, []);

    const setEdges = useCallback((payload: Edge<any>[] | ((edges: Edge<any>[]) => Edge<any>[])) => {
        const { edges = [], setEdges } = store.getState();
        const nextEdges = typeof payload === 'function' ? payload(edges) : payload;
        setEdges(nextEdges);
    }, []);

    const onNodesChange = useCallback((changes: NodeChange[]) => {
        const { nodeInternals } = store.getState();
        const filteredChanges = changes
            .map((change) => {
                if (change.type !== 'position' || change.position === undefined) {
                    return change;
                }
                const node = nodeInternals.get(change.id);

                if (!node) {
                    return change;
                }

                const nodeType = node.type;

                if (!nodeType) {
                    return change;
                }

                let updatedChange = change;
                const [minX, maxX] = getValidXPositionRangeByNodeType(nodeType as NodeTypes);

                switch (nodeType as NodeTypes) {
                    case NodeTypes.FixedText:
                        // Prevent changes on the fixed text elements (extra check -- they have `draggable: false` set either way)
                        return undefined;
                    default:
                        if (!(change.position.x >= minX && change.position.x <= maxX)) {
                            updatedChange = {
                                ...change,
                                position: {
                                    ...change.position,
                                    x: Math.max(minX, Math.min(maxX, change.position.x)),
                                },
                            };
                        }
                }

                if (updatedChange.position && updatedChange.position.y <= 60) {
                    updatedChange = {
                        ...updatedChange,
                        position: {
                            ...updatedChange.position,
                            y: 60,
                        },
                    };
                }

                return updatedChange;
            })
            .filter((change) => change !== undefined) as NodeChange[];
        const nodes = Array.from(nodeInternals.values());
        const updatedNodes = applyNodeChanges(filteredChanges, nodes);
        setNodes(updatedNodes);
    }, []);

    const propagateNodeChanges = (nodeId: string) => {
        // Recursively propagate node changes to all following nodes of a given, updated node
        const updatedNode = store.getState().nodeInternals.get(nodeId);
        const outgoingEdges = store.getState().edges.filter((edge) => edge.source === nodeId);
        const followingNodes = Array.from(store.getState().nodeInternals)
            .filter(([nodeId]) => outgoingEdges?.map((edge) => edge.target).includes(nodeId))
            .map(([, node]) => node);

        if (updatedNode && followingNodes.length > 0) {
            for (const followingNode of followingNodes) {
                const matchingEdges = outgoingEdges.filter((edge) => edge.target === followingNode.id);
                if (matchingEdges.length > 0) {
                    for (const matchingEdge of matchingEdges) {
                        onConnect(matchingEdge);
                    }
                }
                propagateNodeChanges(followingNode.id);
            }
        }
    };

    const deleteNode = useCallback((nodeId: string) => {
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    }, []);

    const updateNodeState = <NodePropsType extends NodeWithStateProps<NodeStateType>, NodeStateType>(
        nodeId: string,
        newState: NodeStateType,
    ) => {
        const { nodeInternals, setNodes } = store.getState();
        const nodes = Array.from(nodeInternals.values());
        const updatedNodes = nodes.map((node) => {
            if (node.id === nodeId) {
                // Deep update of the __whole__ node object to trigger react-flow's internal re-rendering
                (node as Node<NodePropsType>) = {
                    ...node,
                    data: {
                        ...(node as Node<NodePropsType>).data,
                        state: {
                            ...(node as Node<NodePropsType>).data.state,
                            ...newState,
                        },
                    },
                };
            }
            return node;
        });
        const newlyInitializedDatasetNodes = updatedNodes.filter(
            (node) =>
                // Dataset node that ...
                node.type === NodeTypes.Dataset &&
                // // ... previously had no columns yet ...
                // (nodeInternals.get(node.id)?.data as DatasetNodeData).state?.columns === undefined &&
                // // ... and now got its columns set (i.e., has successfully loaded data)
                // (node.data as DatasetNodeData).state?.columns !== undefined &&
                // ((node.data as DatasetNodeData).state?.columns as CSVColumn[]).length > 0,
                // ... previously was loading ...
                (nodeInternals.get(node.id)?.data as DatasetNodeData).state?.isLoading === true &&
                // ... and now is not loading anymore
                (node.data as DatasetNodeData).state?.isLoading === false,
        );
        setNodes(updatedNodes);
        propagateNodeChanges(nodeId);
        if (newlyInitializedDatasetNodes.length > 0) {
            for (const newlyInitializedDatasetNode of newlyInitializedDatasetNodes) {
                autoCreateFlowForDatasetNode(newlyInitializedDatasetNode);
            }
        }
    };

    const autoCreateFlowForDatasetNode = (node: Node<DatasetNodeData>): void => {
        // const addedNodes = [] as Node<any>[];
        let dateFilterNode = undefined as Node<DateFilterNodeData> | undefined;
        let pointPrimitiveNode = undefined as Node<PointPrimitiveNodeData> | undefined;
        let colorMappingNode = undefined as Node<ColorMappingNodeData> | undefined;
        const addedConnections = [] as Connection[];

        const potentialDateColumnName =
            node.data.state!.columnHeaders!.find((columnHeader) => columnHeader.type === 'date')?.name ||
            guessDateColumn(node.data.state!.columnHeaders!);
        if (potentialDateColumnName !== undefined) {
            const nodeId = getId();
            const nodeData = {
                state: {
                    ...DateFilterNodeDefaultState,
                    from: undefined,
                    to: undefined,
                },
                onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                onDeleteNode: () => deleteNode(`${nodeId}`),
                isValidConnection,
            } as DateFilterNodeData;
            id++;
            // const xyPosition = getNextXYPositionForNodeType(NodeTypes.DateFilter);
            const xyPosition = node.position;
            const clampedPosition = clampXYPositionByNodeType(xyPosition, NodeTypes.DateFilter);
            dateFilterNode = {
                type: NodeTypes.DateFilter,
                id: `${nodeId}`,
                position: clampedPosition,
                data: nodeData,
            };
            addedConnections.push({
                source: node.id,
                target: `${nodeId}`,
                // TODO: Extract and use enum entries here and in DatasetNode.tsx and DateFilterNode.tsx (instead of magic strings)
                sourceHandle: 'dataset',
                targetHandle: 'x',
            });
        }

        if (dateFilterNode !== undefined) {
            setNodes((nds) => {
                return nds.concat(dateFilterNode!);
            });
        }

        const potentialDataColumns = [];
        for (const columnHeader of node.data.state!.columnHeaders!) {
            if ((columnHeader.type === 'number' || columnHeader.type === 'date') && potentialDataColumns.length < 5) {
                potentialDataColumns.push(columnHeader.name);
            }
        }

        if (potentialDataColumns.length > 0) {
            const nodeId = getId();
            const nodeData = {
                state: {
                    ...PointPrimitiveNodeDefaultState,
                    extent: {
                        minX: -0.25,
                        maxX: 0.75,
                        minZ: -0.25,
                        maxZ: 0.75,
                    },
                },
                gltfAssetUri:
                    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxTextured/glTF/BoxTextured.gltf',
                onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                onDeleteNode: () => deleteNode(`${nodeId}`),
                isValidConnection,
            } as PointPrimitiveNodeData;
            id++;
            // const xyPosition = getNextXYPositionForNodeType(NodeTypes.DateFilter);
            const xyPosition = node.position;
            const clampedPosition = clampXYPositionByNodeType(xyPosition, NodeTypes.PointPrimitive);
            pointPrimitiveNode = {
                type: NodeTypes.PointPrimitive,
                id: `${nodeId}`,
                position: clampedPosition,
                data: nodeData,
            };

            let connectionsSource = node.id;
            if (dateFilterNode !== undefined) {
                connectionsSource = dateFilterNode.id;
            }

            if (potentialDataColumns.length > 3) {
                const nodeId = getId();
                const nodeData = {
                    state: {
                        ...ColorMappingNodeDefaultState,
                    },
                    onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                    onDeleteNode: () => deleteNode(`${nodeId}`),
                    isValidConnection,
                } as ColorMappingNodeData;
                id++;
                // const xyPosition = getNextXYPositionForNodeType(NodeTypes.DateFilter);
                const xyPosition = node.position;
                const clampedPosition = clampXYPositionByNodeType(xyPosition, NodeTypes.ColorMapping);
                colorMappingNode = {
                    type: NodeTypes.ColorMapping,
                    id: `${nodeId}`,
                    position: clampedPosition,
                    data: nodeData,
                };
            }

            if (colorMappingNode !== undefined) {
                addedConnections.push({
                    source: dateFilterNode ? dateFilterNode.id : node.id,
                    target: `${colorMappingNode.id}`,
                    sourceHandle: potentialDataColumns[3],
                    targetHandle: ColorMappingNodeTargetHandles.Column,
                });

                setNodes((nds) => {
                    return nds.concat(colorMappingNode!);
                });
            }

            for (let dataColumnIndex = 0; dataColumnIndex < potentialDataColumns.length; dataColumnIndex++) {
                const dataColumn = potentialDataColumns[dataColumnIndex];
                let targetHandle =
                    dataColumnIndex === 0
                        ? PointPrimitiveNodeTargetHandles.X
                        : dataColumnIndex === 1
                        ? PointPrimitiveNodeTargetHandles.Z
                        : dataColumnIndex === 2
                        ? PointPrimitiveNodeTargetHandles.Y
                        : dataColumnIndex === 3
                        ? PointPrimitiveNodeTargetHandles.Color
                        : PointPrimitiveNodeTargetHandles.Size;
                if (dataColumn.toLowerCase() === 'x') {
                    targetHandle = PointPrimitiveNodeTargetHandles.X;
                }
                if (dataColumn.toLowerCase() === 'y') {
                    targetHandle = PointPrimitiveNodeTargetHandles.Y;
                }
                if (dataColumn.toLowerCase() === 'z') {
                    targetHandle = PointPrimitiveNodeTargetHandles.Z;
                }
                addedConnections.push({
                    source: dataColumnIndex < 3 || dataColumnIndex > 3 ? connectionsSource : colorMappingNode!.id,
                    target: `${nodeId}`,
                    // TODO: Extract and use enum entries here and in DatasetNode.tsx and DateFilterNode.tsx (instead of magic strings)
                    sourceHandle: dataColumnIndex < 3 || dataColumnIndex > 3 ? dataColumn : ColorMappingNodeSourceHandles.Color,
                    targetHandle: targetHandle,
                });
            }
        }

        if (pointPrimitiveNode !== undefined) {
            setNodes((nds) => {
                return nds.concat(pointPrimitiveNode!);
            });
        }

        for (const connection of addedConnections) {
            onConnect(connection);
        }

        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === (pointPrimitiveNode ? pointPrimitiveNode.id : node.id)
                    ? { ...node, data: { ...node.data, state: { ...node.data.state, isFocused: true } } }
                    : { ...node, data: { ...node.data, state: { ...node.data.state, isFocused: false } } },
            ),
        );

        setTimeout(() => {
            reactFlowInstance?.fitView();
            setNodes((nodes) =>
                nodes.map((node) => ({ ...node, data: { ...node.data, state: { ...node.data.state, isFocused: false } } })),
            );
        }, 100);
    };

    // Count drag events to be able to detect drag event leaving the flow's DOM element
    // See https://github.com/leonadler/drag-and-drop-across-browsers/blob/master/README.md
    const [eventCounter, setEventCounter] = useState(0);
    const [draggingInPage, setDraggingInPage] = useState(false);

    const [pointerDownStart, setPointerDownStart] = useState(undefined as undefined | number);
    const [pointerDownStartPosition, setPointerDownStartPosition] = useState(undefined as undefined | vec2);

    const onDisconnect = (params: Edge | Connection) => {
        if (!params.source || !params.target) return;

        const sourceNode = store.getState().nodeInternals.get(params.source);
        const targetNode = store.getState().nodeInternals.get(params.target);

        if (!sourceNode || !targetNode) return;

        // Disconnect previous connection to target (if one exists)
        const edgesPreviouslyConnectedToTarget = store
            .getState()
            .edges.filter((e) => e.target === targetNode.id && e.targetHandle === params.targetHandle)
            .map((edge) => edge.id);
        if (edgesPreviouslyConnectedToTarget.length > 0) {
            setEdges((edges) => edges.filter((edge) => !edgesPreviouslyConnectedToTarget.includes(edge.id)));
        }

        if (sourceNode.type === 'dataset' && targetNode.type === NodeTypes.DateFilter) {
            const sourceColumns = (sourceNode as Node<DatasetNodeData>).data.state?.columns;
            if (sourceColumns) {
                updateNodeState(targetNode.id, {
                    dataToFilter: sourceColumns,
                } as Partial<DateFilterNodeState>);
            }
        }

        if (targetNode.type === NodeTypes.PointPrimitive) {
            let stateKey;
            switch (params.targetHandle as PointPrimitiveNodeTargetHandles) {
                case PointPrimitiveNodeTargetHandles.X:
                    stateKey = 'xColumn';
                    break;
                case PointPrimitiveNodeTargetHandles.Y:
                    stateKey = 'yColumn';
                    break;
                case PointPrimitiveNodeTargetHandles.Z:
                    stateKey = 'zColumn';
                    break;
                case PointPrimitiveNodeTargetHandles.Size:
                    stateKey = 'sizeColumn';
                    break;
                case PointPrimitiveNodeTargetHandles.Color:
                    stateKey = 'colors';
                    break;
            }
            if (stateKey) {
                const updatedState = {} as Partial<PointPrimitiveNodeState>;
                (updatedState as any)[stateKey] = undefined;
                updateNodeState(targetNode.id, updatedState);
            }
        }

        if (targetNode.type === NodeTypes.SyncToScatterplotViewer) {
            let stateKey;
            switch (params.targetHandle as SyncToScatterplotViewerNodeTargetHandles) {
                case SyncToScatterplotViewerNodeTargetHandles.X:
                    stateKey = 'xColumn';
                    break;
                case SyncToScatterplotViewerNodeTargetHandles.Y:
                    stateKey = 'yColumn';
                    break;
                case SyncToScatterplotViewerNodeTargetHandles.Z:
                    stateKey = 'zColumn';
                    break;
                case SyncToScatterplotViewerNodeTargetHandles.Size:
                    stateKey = 'sizeColumn';
                    break;
                case SyncToScatterplotViewerNodeTargetHandles.Color:
                    stateKey = 'colors';
                    break;
            }
            if (stateKey) {
                const updatedState = {} as Partial<SyncToScatterplotViewerNodeState>;
                (updatedState as any)[stateKey] = undefined;
                updateNodeState(targetNode.id, updatedState);
            }
        }
    };

    const onConnect = (params: Edge | Connection) => {
        if (!params.source || !params.target) return;

        const sourceNode = store.getState().nodeInternals.get(params.source);
        const targetNode = store.getState().nodeInternals.get(params.target);

        if (!sourceNode || !targetNode) return;

        // Disconnect previous connection to target (if one exists)
        const edgesPreviouslyConnectedToTarget = store
            .getState()
            .edges.filter((e) => e.target === targetNode.id && e.targetHandle === params.targetHandle)
            .map((edge) => edge.id);
        if (edgesPreviouslyConnectedToTarget.length > 0) {
            setEdges((edges) => edges.filter((edge) => !edgesPreviouslyConnectedToTarget.includes(edge.id)));
        }

        if (sourceNode.type === 'dataset' && targetNode.type === NodeTypes.DateFilter) {
            const sourceColumns = (sourceNode as Node<DatasetNodeData>).data.state?.columns;
            if (sourceColumns) {
                updateNodeState(targetNode.id, {
                    dataToFilter: sourceColumns,
                } as Partial<DateFilterNodeState>);
            }
        }

        if (targetNode.type === NodeTypes.ColorMapping) {
            const sourceColumn = findSourceColumn(sourceNode, params);
            if (sourceColumn) {
                updateNodeState(targetNode.id, {
                    column: sourceColumn,
                } as Partial<ColorMappingNodeState>);
            }
        }

        if (targetNode.type === NodeTypes.PointPrimitive) {
            let stateKey;
            switch (params.targetHandle as PointPrimitiveNodeTargetHandles) {
                case PointPrimitiveNodeTargetHandles.X:
                    stateKey = 'xColumn';
                    break;
                case PointPrimitiveNodeTargetHandles.Y:
                    stateKey = 'yColumn';
                    break;
                case PointPrimitiveNodeTargetHandles.Z:
                    stateKey = 'zColumn';
                    break;
                case PointPrimitiveNodeTargetHandles.Size:
                    stateKey = 'sizeColumn';
                    break;
                case PointPrimitiveNodeTargetHandles.Color:
                    stateKey = 'colors';
                    break;
            }
            if (stateKey) {
                const sourceColumn = findSourceColumn(sourceNode, params);
                if (sourceColumn) {
                    const updatedState = {} as Partial<PointPrimitiveNodeState>;
                    (updatedState as any)[stateKey] = sourceColumn;
                    updateNodeState(targetNode.id, updatedState);
                }
            }
        }

        if (targetNode.type === NodeTypes.LinePrimitive) {
            let stateKey;
            switch (params.targetHandle as LinePrimitiveNodeTargetHandles) {
                case LinePrimitiveNodeTargetHandles.X:
                    stateKey = 'xColumn';
                    break;
                case LinePrimitiveNodeTargetHandles.Y:
                    stateKey = 'yColumn';
                    break;
                case LinePrimitiveNodeTargetHandles.Z:
                    stateKey = 'zColumn';
                    break;
                case LinePrimitiveNodeTargetHandles.Size:
                    stateKey = 'sizeColumn';
                    break;
                case LinePrimitiveNodeTargetHandles.Color:
                    stateKey = 'colors';
                    break;
            }
            if (stateKey) {
                const sourceColumn = findSourceColumn(sourceNode, params);
                if (sourceColumn) {
                    const updatedState = {} as Partial<LinePrimitiveNodeState>;
                    (updatedState as any)[stateKey] = sourceColumn;
                    updateNodeState(targetNode.id, updatedState);
                }
            }
        }

        if (targetNode.type === NodeTypes.CubePrimitive) {
            let stateKey;
            switch (params.targetHandle as CubePrimitiveNodeTargetHandles) {
                case CubePrimitiveNodeTargetHandles.X:
                    stateKey = 'xColumn';
                    break;
                case CubePrimitiveNodeTargetHandles.Y:
                    stateKey = 'yColumn';
                    break;
                case CubePrimitiveNodeTargetHandles.Z:
                    stateKey = 'zColumn';
                    break;
                case CubePrimitiveNodeTargetHandles.Size:
                    stateKey = 'sizeColumn';
                    break;
                case CubePrimitiveNodeTargetHandles.Color:
                    stateKey = 'colors';
                    break;
            }
            if (stateKey) {
                const sourceColumn = findSourceColumn(sourceNode, params);
                if (sourceColumn) {
                    const updatedState = {} as Partial<CubePrimitiveNodeState>;
                    (updatedState as any)[stateKey] = sourceColumn;
                    updateNodeState(targetNode.id, updatedState);
                }
            }
        }

        if (targetNode.type === NodeTypes.MeshPrimitive) {
            let stateKey;
            switch (params.targetHandle as MeshPrimitiveNodeTargetHandles) {
                case MeshPrimitiveNodeTargetHandles.X:
                    stateKey = 'xColumn';
                    break;
                case MeshPrimitiveNodeTargetHandles.Y:
                    stateKey = 'yColumn';
                    break;
                case MeshPrimitiveNodeTargetHandles.Z:
                    stateKey = 'zColumn';
                    break;
                case MeshPrimitiveNodeTargetHandles.Size:
                    stateKey = 'sizeColumn';
                    break;
                case MeshPrimitiveNodeTargetHandles.Color:
                    stateKey = 'colors';
                    break;
            }
            if (stateKey) {
                const sourceColumn = findSourceColumn(sourceNode, params);
                if (sourceColumn) {
                    const updatedState = {} as Partial<MeshPrimitiveNodeState>;
                    (updatedState as any)[stateKey] = sourceColumn;
                    updateNodeState(targetNode.id, updatedState);
                }
            }
        }

        if (targetNode.type === NodeTypes.SyncToScatterplotViewer) {
            let stateKey;
            switch (params.targetHandle as SyncToScatterplotViewerNodeTargetHandles) {
                case SyncToScatterplotViewerNodeTargetHandles.X:
                    stateKey = 'xColumn';
                    break;
                case SyncToScatterplotViewerNodeTargetHandles.Y:
                    stateKey = 'yColumn';
                    break;
                case SyncToScatterplotViewerNodeTargetHandles.Z:
                    stateKey = 'zColumn';
                    break;
                case SyncToScatterplotViewerNodeTargetHandles.Size:
                    stateKey = 'sizeColumn';
                    break;
                case SyncToScatterplotViewerNodeTargetHandles.Color:
                    stateKey = 'colors';
                    break;
            }
            if (stateKey) {
                const sourceColumn = findSourceColumn(sourceNode, params);
                if (sourceColumn) {
                    const updatedState = {} as Partial<SyncToScatterplotViewerNodeState>;
                    (updatedState as any)[stateKey] = sourceColumn;
                    updateNodeState(targetNode.id, updatedState);
                }
            }
        }

        setEdges((els) => addEdge(params, els));
    };
    const onPaneReady = (rfi: ReactFlowInstance) => setReactFlowInstance(rfi);

    // This memoization is important to avoid the ReactFlow component to re-render continuously
    // See https://github.com/wbkd/react-flow/pull/1555#issue-1016332917 (section "nodeTypes and edgeTypes")
    const nodeTypes = useMemo(() => {
        const mapping = {} as NodeTypesType;
        mapping[NodeTypes.FixedText] = FixedTextNode;
        mapping[NodeTypes.Dataset] = DatasetNode;
        mapping[NodeTypes.PointPrimitive] = PointPrimitiveNode;
        mapping[NodeTypes.LinePrimitive] = LinePrimitiveNode;
        mapping[NodeTypes.CubePrimitive] = CubePrimitiveNode;
        mapping[NodeTypes.MeshPrimitive] = MeshPrimitiveNode;
        mapping[NodeTypes.DateFilter] = DateFilterNode;
        mapping[NodeTypes.ColorMapping] = ColorMappingNode;
        mapping[NodeTypes.SyncToScatterplotViewer] = SyncToScatterplotViewerNode;
        return mapping;
    }, []);

    useEffect(() => {
        if (!dragInProgress || !dragCoords) return;

        // If dragging (a drag-and-dropped file), update the last node's position
        setNodes((nds) => {
            return nds.map((node, index) => {
                if (index === nds.length - 1) {
                    node.position = { ...node.position, ...dragCoords };
                }
                return node;
            });
        });
    }, [dragInProgress, dragCoords?.x, dragCoords?.y]);

    const onDragOver = (event: DragEvent) => {
        event.preventDefault();

        if (!event.dataTransfer) return;
        if (!reactFlowInstance) return;

        const fileMimetype = getFileMimetypes(event.dataTransfer)[0];
        const nodeType = fileMimetype === 'text/csv' ? NodeTypes.Dataset : NodeTypes.MeshPrimitive;

        if (dragInProgress) {
            setDragCoords(clampXYPositionByNodeType(reactFlowInstance.project({ x: event.clientX, y: event.clientY - 40 }), nodeType));
            return;
        }

        const creatingNewNode = !dragInProgress;

        const nodeId = getId();
        const type = mapMimetypeToNodeFiletype(fileMimetype);
        const position = clampXYPositionByNodeType(reactFlowInstance.project({ x: event.clientX, y: event.clientY - 40 }), nodeType);

        const newNode: Node =
            nodeType === NodeTypes.Dataset
                ? ({
                      id: nodeId,
                      type: 'dataset',
                      position,
                      data: {
                          type,
                          label: `${type} node`,
                          columns: [],
                          filename: `Loading ${type?.toUpperCase() ?? ''}…`,
                          onChangeState: (newState: DatasetNodeState) => updateNodeState(nodeId, newState),
                          onDeleteNode: () => deleteNode(nodeId),
                          state: {
                              ...DatasetNodeDefaultState,
                          },
                      },
                  } as Node<DatasetNodeData>)
                : ({
                      id: nodeId,
                      type: 'mesh-primitive',
                      position,
                      data: {
                          onChangeState: (newState: MeshPrimitiveNodeState) => updateNodeState(nodeId, newState),
                          onDeleteNode: () => deleteNode(nodeId),
                          state: {
                              ...MeshPrimitiveNodeDefaultState,
                          },
                      },
                  } as Node<MeshPrimitiveNodeData>);

        setNodes((nds) => {
            if (creatingNewNode) {
                return nds.concat(newNode);
            }
            return nds.map((item) => {
                if (item.id === nodeId) {
                    return newNode;
                }
                return item;
            });
        });

        setDragInProgress(true);

        id++;
    };

    const onDrop = (event: DragEvent) => {
        reactFlowInstance?.fitView();

        event.preventDefault();

        setEventCounter(0);
        setDraggingInPage(false);

        const fileName = getFileNames(event.dataTransfer)[0];
        const fileMimetype = getFileMimetypes(event.dataTransfer)[0];
        const nodeType = fileMimetype === 'text/csv' ? NodeTypes.Dataset : NodeTypes.MeshPrimitive;

        const type = mapMimetypeToNodeFiletype(fileMimetype);
        const file = getFiles(event.dataTransfer)[0];

        if (nodeType === NodeTypes.Dataset) {
            setNodes((nds) => {
                return nds.map((node, index) => {
                    if (index === nds.length - 1) {
                        (node as Node<DatasetNodeData>).data = {
                            ...(node as Node<DatasetNodeData>).data,
                            filename: fileName,
                            file,
                            state: {
                                type,
                            },
                        };
                    }
                    return node;
                });
            });
        } else {
            setNodes((nds) => {
                return nds.map((node, index) => {
                    if (index === nds.length - 1) {
                        const URLObj = window.URL || window.webkitURL;
                        const source = URLObj.createObjectURL(file);
                        (node as Node<MeshPrimitiveNodeData>).data = {
                            ...(node as Node<MeshPrimitiveNodeData>).data,
                            // TODO: Make gltfloader's loadAsset method accept File objects (as gltf-loader's load method accepts either way) to pass File instead of data URL
                            // gltfAssetFile: file,
                            gltfAssetUri: source,
                            // gltfAssetUri:
                            // 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxTextured/glTF/BoxTextured.gltf',
                        };
                    }
                    return node;
                });
            });
        }

        setDragInProgress(false);
        setDragCoords(undefined);
        id++;
    };

    const onDragEnter = (event: DragEvent) => {
        event.preventDefault();
        setEventCounter(eventCounter + 1);
        setDraggingInPage(true);
    };

    const onDragLeave = (event: DragEvent) => {
        event.preventDefault();
        const newEventCounter = eventCounter - 1;
        const newDraggingInPage = newEventCounter > 0;
        setDraggingInPage(newDraggingInPage);
        setEventCounter(newEventCounter);
    };

    useEffect(() => {
        if (!draggingInPage && dragInProgress) {
            setDragInProgress(false);
            setDragCoords(undefined);
            setNodes((nds) => nds.slice(0, nds.length - 1));
        }
    }, [draggingInPage]);

    const [contextMenuPopperElement, setContextMenuPopperElement] = useState(null as HTMLElement | null);
    const [contextMenuVirtualReference, setContextMenuVirtualReference] = useState(null as any);

    const { styles, attributes } = usePopper(contextMenuVirtualReference, contextMenuPopperElement, {
        placement: 'right-start',
    });

    const onContextMenuOpen = useCallback((event: MouseEvent) => {
        event.preventDefault();

        const virtualReference = {
            getBoundingClientRect() {
                return {
                    top: Math.round(event.clientY),
                    left: Math.round(event.clientX),
                    bottom: Math.round(event.clientY),
                    right: Math.round(event.clientX),
                    width: 0,
                    height: 0,
                };
            },
        };

        setContextMenuVirtualReference(virtualReference);
        setFocusedContextMenuEntry(0);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                onContextMenuClose();
            }
        });
    }, []);

    const onContextMenuClose = useCallback(() => {
        setFilteredNodesThatCanBeAddedViaContextMenu(nodesThatCanBeAddedViaContextMenu);
        setContextMenuVirtualReference(null);
        setFocusedContextMenuEntry(0);
    }, []);

    const addNodeFromContextMenu = useCallback(
        (nodeType: NodeTypes) => {
            if (!contextMenuVirtualReference) return;
            if (!reactFlowInstance) return;

            onContextMenuClose();

            const { top, left } = contextMenuVirtualReference.getBoundingClientRect();

            const xyPosition = reactFlowInstance.project({ x: left, y: top });

            onAddNode(nodeType, xyPosition);
        },
        [contextMenuVirtualReference],
    );

    const onAddNode = useCallback((nodeType: NodeTypes, xyPosition: XYPosition) => {
        let nodeData: any;
        const nodeId = getId();

        switch (nodeType) {
            case 'filter-date':
                nodeData = {
                    state: {
                        ...DateFilterNodeDefaultState,
                        from: undefined,
                        to: undefined,
                    },
                    onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                    onDeleteNode: () => deleteNode(`${nodeId}`),
                    isValidConnection,
                } as DateFilterNodeData;
                break;
            case 'point-primitive':
                nodeData = {
                    state: {
                        ...PointPrimitiveNodeDefaultState,
                    },
                    onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                    onDeleteNode: () => deleteNode(`${nodeId}`),
                    isValidConnection,
                } as PointPrimitiveNodeData;
                break;
            case 'line-primitive':
                nodeData = {
                    state: {
                        ...LinePrimitiveNodeDefaultState,
                    },
                    onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                    onDeleteNode: () => deleteNode(`${nodeId}`),
                    isValidConnection,
                } as LinePrimitiveNodeData;
                break;
            case 'cube-primitive':
                nodeData = {
                    state: {
                        ...CubePrimitiveNodeDefaultState,
                    },
                    onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                    onDeleteNode: () => deleteNode(`${nodeId}`),
                    isValidConnection,
                } as CubePrimitiveNodeData;
                break;
            case 'color-mapping':
                nodeData = {
                    state: {
                        ...ColorMappingNodeDefaultState,
                    },
                    onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                    onDeleteNode: () => deleteNode(`${nodeId}`),
                    isValidConnection,
                } as ColorMappingNodeData;
                break;
            case 'sync-to-scatterplot-viewer':
                nodeData = {
                    state: {
                        ...SyncToScatterplotViewerNodeDefaultState,
                    },
                    onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                    onDeleteNode: () => deleteNode(`${nodeId}`),
                    isValidConnection,
                } as SyncToScatterplotViewerNodeData;
                break;
            case 'dataset':
                nodeData = {
                    filename: '',
                    type: undefined,
                    state: {
                        ...DatasetNodeDefaultState,
                    },
                    onChangeState: (newState) => updateNodeState(`${nodeId}`, newState),
                    onDeleteNode: () => deleteNode(`${nodeId}`),
                    isValidConnection,
                } as DatasetNodeData;
                break;
            default:
                return;
        }

        id++;

        const clampedPosition = clampXYPositionByNodeType(xyPosition, nodeType);

        setNodes((nds) =>
            nds.concat({
                type: nodeType,
                id: `${nodeId}`,
                position: clampedPosition,
                data: nodeData,
            }),
        );
    }, []);

    const nodesThatCanBeAddedViaContextMenu = [
        {
            nodeType: NodeTypes.Dataset,
            label: 'Input: Dataset …',
            highlightString: undefined as undefined | string,
        },
        {
            nodeType: NodeTypes.DateFilter,
            label: 'Filtering: Date Filter',
            highlightString: undefined as undefined | string,
        },
        {
            nodeType: NodeTypes.ColorMapping,
            label: 'Mapping: Color Mapping',
            highlightString: undefined as undefined | string,
        },
        {
            nodeType: NodeTypes.PointPrimitive,
            label: 'Rendering: Point Primitive',
            highlightString: undefined as undefined | string,
        },
        {
            nodeType: NodeTypes.LinePrimitive,
            label: 'Rendering: Line Primitive',
            highlightString: undefined as undefined | string,
        },
        {
            nodeType: NodeTypes.CubePrimitive,
            label: 'Rendering: Cube Primitive',
            highlightString: undefined as undefined | string,
        },
        {
            nodeType: NodeTypes.SyncToScatterplotViewer,
            label: 'Rendering: Sync to Scatterplot Viewer',
            highlightString: undefined as undefined | string,
        },
    ];

    const [filteredNodesThatCanBeAddedViaContextMenu, setFilteredNodesThatCanBeAddedViaContextMenu] =
        useState(nodesThatCanBeAddedViaContextMenu);

    const [focusedContextMenuEntry, setFocusedContextMenuEntry] = useState(0);

    const contextMenuEntriesRef = useRef<Array<HTMLLIElement | null>>([]);

    // List of refs that works inside a loop
    // see: https://stackoverflow.com/a/56063129
    useEffect(() => {
        contextMenuEntriesRef.current = contextMenuEntriesRef.current.splice(0, filteredNodesThatCanBeAddedViaContextMenu.length);
    }, [filteredNodesThatCanBeAddedViaContextMenu]);

    return (
        <ReactFlow
            nodes={nodes}
            nodeTypes={nodeTypes}
            edges={edges}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragLeave={onDragLeave}
            onNodesChange={onNodesChange}
            // onEdgeUpdate is set to enable react-flow's support for updating handles (i.e., dragging them off their handles)
            onEdgeUpdate={() => undefined}
            onEdgeUpdateEnd={onEdgeUpdateEnd}
            onInit={onPaneReady}
            onNodeClick={onNodeClick}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            className="react-flow-basic-example"
            defaultZoom={1.5}
            onNodeDoubleClick={(_event, doubleClickedNode) => {
                setNodes((nodes) =>
                    nodes.map((node) =>
                        node.id === doubleClickedNode.id
                            ? { ...node, data: { ...node.data, state: { ...node.data.state, isFocused: true } } }
                            : { ...node, data: { ...node.data, state: { ...node.data.state, isFocused: false } } },
                    ),
                );
                setTimeout(() => {
                    setNodes((nodes) =>
                        nodes.map((node) => ({ ...node, data: { ...node.data, state: { ...node.data.state, isFocused: false } } })),
                    );
                }, 100);
            }}
            onPaneContextMenu={onContextMenuOpen}
            onPointerDown={(event) => {
                setPointerDownStartPosition(vec2.fromValues(event.clientX, event.clientY));
                setPointerDownStart(new Date().getTime());
            }}
            onPointerUp={(event) => {
                const LONG_PRESS_MIN_DURATION_IN_MILLISECONDS = 300;
                if (pointerDownStart !== undefined) {
                    const pointerDownEnd = new Date().getTime();
                    if (pointerDownEnd - pointerDownStart >= LONG_PRESS_MIN_DURATION_IN_MILLISECONDS) {
                        onContextMenuOpen(event);
                    }
                    setPointerDownStart(undefined);
                    setPointerDownStartPosition(undefined);
                }
            }}
            onPointerMove={(event) => {
                if (!pointerDownStartPosition || pointerDownStart === undefined) {
                    return;
                }
                // Long-press detection: If the pointer is moved after pointer-down and before pointer-up, cancel the long-press recording
                const distance = vec2.dist(vec2.fromValues(event.clientX, event.clientY), pointerDownStartPosition);
                // Keep track of the start position and allow for a small delta offset in moving the pointer before cancelling the long-press recording
                if (distance < 10) {
                    return;
                }
                if (pointerDownStart !== undefined) {
                    setPointerDownStart(undefined);
                    setPointerDownStartPosition(undefined);
                }
            }}
            onMoveStart={() => {
                if (contextMenuVirtualReference) onContextMenuClose();
            }}
            onPaneClick={() => {
                if (contextMenuVirtualReference) onContextMenuClose();

                if (store.getState().connectionStartHandle) {
                    // Delete the edge if clicking a connection first and then clicking onto the canvas (pane) background
                    const connectionStartHandle = store.getState().connectionStartHandle as StartHandle;
                    const deletedEdge = store.getState().edges.find((edge) => {
                        if (connectionStartHandle.type === 'source') {
                            if (connectionStartHandle.handleId) {
                                return edge.source === connectionStartHandle.nodeId && edge.sourceHandle === connectionStartHandle.handleId;
                            }
                            return edge.source === connectionStartHandle.nodeId;
                        } else {
                            if (connectionStartHandle.handleId) {
                                return edge.target === connectionStartHandle.nodeId && edge.targetHandle === connectionStartHandle.handleId;
                            }
                            return edge.target === connectionStartHandle.nodeId;
                        }
                    });
                    if (deletedEdge) {
                        onDisconnect(deletedEdge);
                    }
                }
                store.setState({ connectionStartHandle: null });
            }}
            minZoom={0.2}
            maxZoom={4}
            fitView={true}
            fitViewOptions={{ padding: 0.1 }}
            attributionPosition="top-right"
        >
            <Background variant={BackgroundVariant.Lines} />
            {contextMenuVirtualReference &&
                createPortal(
                    <div ref={setContextMenuPopperElement} style={styles.popper} {...attributes.popper}>
                        <div className="context-menu">
                            <input
                                type="text"
                                defaultValue={''}
                                placeholder={'Filter nodes …'}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                    let filterText = event.target.value;
                                    filterText = filterText.toLowerCase();
                                    if (filterText !== '') {
                                        const filteredNodes = nodesThatCanBeAddedViaContextMenu
                                            .filter(({ label }) => label.toLowerCase().includes(filterText))
                                            .map((node) => {
                                                // See: https://bitsofco.de/a-one-line-solution-to-highlighting-search-matches/
                                                const highlightString = node.label.replace(
                                                    new RegExp(filterText, 'gi'),
                                                    (match) => `<mark>${match}</mark>`,
                                                );
                                                return {
                                                    ...node,
                                                    highlightString,
                                                };
                                            });
                                        setFilteredNodesThatCanBeAddedViaContextMenu(filteredNodes);
                                    } else {
                                        setFilteredNodesThatCanBeAddedViaContextMenu(nodesThatCanBeAddedViaContextMenu);
                                    }
                                }}
                                autoFocus={true}
                                onKeyDown={(event) => {
                                    switch (event.key) {
                                        case 'ArrowDown':
                                            event.preventDefault();
                                            if (filteredNodesThatCanBeAddedViaContextMenu.length === 1) {
                                                setFocusedContextMenuEntry(0);
                                                contextMenuEntriesRef.current[0]?.focus();
                                            } else if (filteredNodesThatCanBeAddedViaContextMenu.length > 1) {
                                                setFocusedContextMenuEntry(1);
                                                contextMenuEntriesRef.current[1]?.focus();
                                            }
                                            break;
                                        case 'Enter':
                                            event.preventDefault();
                                            addNodeFromContextMenu(
                                                filteredNodesThatCanBeAddedViaContextMenu[focusedContextMenuEntry].nodeType,
                                            );
                                    }
                                }}
                            />
                            <ul
                                className="dropdown-list"
                                role="toolbar"
                                onKeyDown={(event) => {
                                    let focusedEntryIndex = undefined;
                                    switch (event.key) {
                                        case 'ArrowDown':
                                            event.preventDefault();
                                            focusedEntryIndex = Math.min(
                                                focusedContextMenuEntry + 1,
                                                filteredNodesThatCanBeAddedViaContextMenu.length - 1,
                                            );
                                            break;
                                        case 'ArrowUp':
                                            event.preventDefault();
                                            focusedEntryIndex = Math.max(focusedContextMenuEntry - 1, 0);
                                            break;
                                    }
                                    if (focusedEntryIndex !== undefined) {
                                        setFocusedContextMenuEntry(focusedEntryIndex);
                                        contextMenuEntriesRef.current[focusedEntryIndex]?.focus();
                                    }
                                }}
                            >
                                {filteredNodesThatCanBeAddedViaContextMenu.map(({ nodeType, label, highlightString }, index) => (
                                    <li
                                        key={index}
                                        // Use "roving tabindex" for accessibility
                                        // see: https://web.dev/control-focus-with-tabindex/#create-accessible-components-with-%22roving-tabindex%22
                                        tabIndex={focusedContextMenuEntry !== undefined ? (index === focusedContextMenuEntry ? 0 : -1) : 0}
                                        ref={(element) => (contextMenuEntriesRef.current[index] = element)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                addNodeFromContextMenu(nodeType);
                                            }
                                        }}
                                        onPointerOver={() => {
                                            setFocusedContextMenuEntry(index);
                                        }}
                                    >
                                        <a
                                            id={`${index}`}
                                            className="link"
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    addNodeFromContextMenu(nodeType);
                                                }
                                            }}
                                            onClick={() => addNodeFromContextMenu(nodeType)}
                                            dangerouslySetInnerHTML={highlightString ? { __html: highlightString } : undefined}
                                        >
                                            {!highlightString ? label : undefined}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>,
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    document.querySelector('#context-menu-destination')!,
                )}

            {store.getState().nodeInternals.size === 4 && (
                <div style={{ position: 'absolute', top: 0, marginLeft: '1rem', marginTop: '1rem', zIndex: 4 }}>
                    Right-click (or long-press on a mobile device) on the canvas to add a new node. You can also drag-and-drop datasets
                    (e.g., CSV files) here.
                </div>
            )}
        </ReactFlow>
    );
};

export default BasicFlow;
