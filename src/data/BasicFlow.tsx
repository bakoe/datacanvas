import { DateTime } from 'luxon';
import { MouseEvent, useMemo, useState, DragEvent, useEffect, useCallback } from 'react';
import { updateEdge } from 'react-flow-renderer';

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
} from './nodes/DateFilterNode';
import { NodeTypes } from './nodes/enums/NodeTypes';
import PointPrimitiveNode, {
    defaultState as PointPrimitiveNodeDefaultState,
    PointPrimitiveNodeData,
    PointPrimitiveNodeState,
    PointPrimitiveNodeTargetHandles,
} from './nodes/PointPrimitiveNode';

const onNodeDragStop = (_: MouseEvent, node: Node) => undefined;
const onNodeClick = (_: MouseEvent, node: Node) => undefined;

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

let id = 2;
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
            type: NodeTypes.DateFilter,
            id: '0',
            data: {
                state: {
                    ...DateFilterNodeDefaultState,
                    from: DateTime.fromISO('2021-11-15'),
                    to: DateTime.fromISO('2021-12-19'),
                },
                onChangeState: (newState) => updateNodeState('0', newState),
                isValidConnection,
            },
            position: { x: 400, y: 40 },
        } as Node<DateFilterNodeData>,

        {
            type: NodeTypes.PointPrimitive,
            id: '1',
            data: {
                state: {
                    ...PointPrimitiveNodeDefaultState,
                },
                onChangeState: (newState) => updateNodeState('1', newState),
                isValidConnection,
            },
            position: { x: 700, y: 40 },
        } as Node<PointPrimitiveNodeData>,
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
        const nodes = Array.from(nodeInternals.values());
        const updatedNodes = applyNodeChanges(changes, nodes);
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
        setNodes(updatedNodes);
        propagateNodeChanges(nodeId);
    };

    // Count drag events to be able to detect drag event leaving the flow's DOM element
    // See https://github.com/leonadler/drag-and-drop-across-browsers/blob/master/README.md
    const [eventCounter, setEventCounter] = useState(0);
    const [draggingInPage, setDraggingInPage] = useState(false);

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
            }
            if (stateKey) {
                const updatedState = {} as Partial<PointPrimitiveNodeState>;
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
            }
            if (stateKey) {
                let sourceColumn;
                switch (sourceNode.type as NodeTypes) {
                    case NodeTypes.Dataset:
                        sourceColumn = (sourceNode as Node<DatasetNodeData>).data.state?.columns?.find(
                            (column) => column.name === params.sourceHandle,
                        );
                        break;
                    case NodeTypes.DateFilter:
                        sourceColumn = (sourceNode as Node<DateFilterNodeData>).data.state?.filteredColumns?.find(
                            (column) => column.name === params.sourceHandle,
                        );
                        break;
                }
                if (sourceColumn) {
                    const updatedState = {} as Partial<PointPrimitiveNodeState>;
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
        mapping['dataset'] = DatasetNode;
        mapping[NodeTypes.PointPrimitive] = PointPrimitiveNode;
        mapping[NodeTypes.DateFilter] = DateFilterNode;
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

        if (dragInProgress) {
            setDragCoords(reactFlowInstance.project({ x: event.clientX, y: event.clientY - 40 }));
            return;
        }

        const creatingNewNode = !dragInProgress;

        const nodeId = getId();
        const fileMimetype = getFileMimetypes(event.dataTransfer)[0];
        const type = mapMimetypeToNodeFiletype(fileMimetype);
        const position = reactFlowInstance.project({ x: event.clientX, y: event.clientY - 40 });

        const newNode: Node = {
            id: nodeId,
            type: 'dataset',
            position,
            data: {
                type,
                label: `${type} node`,
                columns: [],
                filename: `Loading ${type?.toUpperCase() ?? ''}…`,
                onChangeState: (newState: DatasetNodeState) => updateNodeState(nodeId, newState),
                state: {
                    ...DatasetNodeDefaultState,
                },
            },
        } as Node<DatasetNodeData>;

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

    const onDrop = (event: DragEvent) => {
        event.preventDefault();

        setEventCounter(0);
        setDraggingInPage(false);

        const fileName = getFileNames(event.dataTransfer)[0];
        const fileMimetype = getFileMimetypes(event.dataTransfer)[0];
        const type = mapMimetypeToNodeFiletype(fileMimetype);
        const file = getFiles(event.dataTransfer)[0];

        setNodes((nds) => {
            return nds.map((node, index) => {
                if (index === nds.length - 1) {
                    (node as Node<DatasetNodeData>).data = {
                        ...(node as Node<DatasetNodeData>).data,
                        filename: fileName,
                        type,
                        file,
                    };
                }
                return node;
            });
        });

        setDragInProgress(false);
        setDragCoords(undefined);
        id++;
    };

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
            onPaneClick={() => {
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
            attributionPosition="top-right"
        >
            <Background variant={BackgroundVariant.Lines} />

            <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 4 }}></div>
        </ReactFlow>
    );
};

export default BasicFlow;
