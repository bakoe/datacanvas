import { DateTime } from 'luxon';
import { MouseEvent, useMemo, useState, DragEvent, useEffect } from 'react';

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
import PointPrimitiveNode, { defaultState as PointPrimitiveNodeDefaultState, PointPrimitiveNodeData } from './nodes/PointPrimitiveNode';
import { sourceHandleDatatype, targetHandleDatatype } from './nodes/sourceHandleDatatype';

const onNodeDragStop = (_: MouseEvent, node: Node) => console.log('drag stop', node);
const onNodeClick = (_: MouseEvent, node: Node) => console.log('click', node);

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
    const updateNodeState = <NodePropsType extends NodeWithStateProps<NodeStateType>, NodeStateType>(
        nodeId: string,
        newState: NodeStateType,
    ) => {
        setNodes((nds) => {
            return nds.map((node) => {
                if (node.id === nodeId) {
                    (node as Node<NodePropsType>).data = {
                        ...(node as Node<NodePropsType>).data,
                        state: {
                            ...(node as Node<NodePropsType>).data.state,
                            ...newState,
                        },
                    };
                }
                return node;
            });
        });
    };

    const isValidConnection = (connection: Connection): boolean => {
        if (connection.source && connection.target) {
            const sourceNode = nodes.find((node) => node.id === connection.source);
            const targetNode = nodes.find((node) => node.id === connection.target);

            if (!targetNode || !connection.targetHandle || !sourceNode || !connection.sourceHandle) {
                return false;
            }

            if (targetHandleDatatype(targetNode, connection.targetHandle) === sourceHandleDatatype(sourceNode, connection.sourceHandle)) {
                return true;
            }
        }
        return false;
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
                isValidConnection,
            },
            position: { x: 700, y: 40 },
        } as Node<PointPrimitiveNodeData>,
    ];

    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance>();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [dragInProgress, setDragInProgress] = useState(false);
    const [dragCoords, setDragCoords] = useState<XYPosition | undefined>(undefined);

    // Count drag events to be able to detect drag event leaving the flow's DOM element
    // See https://github.com/leonadler/drag-and-drop-across-browsers/blob/master/README.md
    const [eventCounter, setEventCounter] = useState(0);
    const [draggingInPage, setDraggingInPage] = useState(false);

    const onConnect = (params: Edge | Connection) => {
        const sourceNode = nodes.find((n) => n.id === params.source);
        const targetNode = nodes.find((n) => n.id === params.target);
        console.log(sourceNode, targetNode);

        if (!sourceNode || !targetNode) return;

        if (sourceNode.type === 'dataset' && targetNode.type === NodeTypes.DateFilter) {
            const edgePreviouslyConnectedToTarget = edges.find((e) => e.target === targetNode.id);
            if (edgePreviouslyConnectedToTarget) {
                setEdges((edges) => edges.filter((edge) => edge.id !== edgePreviouslyConnectedToTarget.id));
            }
            const sourceColumns = (sourceNode as Node<DatasetNodeData>).data.state?.columns;
            if (sourceColumns) {
                updateNodeState(targetNode.id, {
                    dataToFilter: sourceColumns,
                } as Partial<DateFilterNodeState>);
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
            onEdgesChange={onEdgesChange}
            onInit={onPaneReady}
            onNodeClick={onNodeClick}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            className="react-flow-basic-example"
            defaultZoom={1.5}
            minZoom={0.2}
            maxZoom={4}
        >
            <Background variant={BackgroundVariant.Lines} />

            <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 4 }}></div>
        </ReactFlow>
    );
};

export default BasicFlow;
