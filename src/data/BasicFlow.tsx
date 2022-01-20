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
} from 'react-flow-renderer';

import DatasetNode, { DatasetNodeData, mapMimetypeToNodeFiletype } from './nodes/DatasetNode';

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

const initialNodes: Node[] = [
    {
        type: 'dataset',
        id: '0',
        data: { filename: 'foo.csv', type: 'csv', columns: [{ type: 'number', name: 'col1' }] },
        position: { x: 400, y: 40 },
        className: 'light',
    } as Node<DatasetNodeData>,
    {
        type: 'dataset',
        id: '1',
        data: {
            filename: 'bar.json',
            type: 'json',
            columns: [
                { type: 'number', name: 'col1' },
                { type: 'string', name: 'col2' },
            ],
        },
        position: { x: 700, y: 40 },
        className: 'light',
    } as Node<DatasetNodeData>,
];

let id = 2;
const getId = () => `dndnode_${id}`;

const initialEdges: Edge[] = [];

const BasicFlow = () => {
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance>();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [dragInProgress, setDragInProgress] = useState(false);
    const [dragCoords, setDragCoords] = useState<XYPosition | undefined>(undefined);

    // Count drag events to be able to detect drag event leaving the flow's DOM element
    // See https://github.com/leonadler/drag-and-drop-across-browsers/blob/master/README.md
    const [eventCounter, setEventCounter] = useState(0);
    const [draggingInPage, setDraggingInPage] = useState(false);

    const onConnect = (params: Edge | Connection) => setEdges((els) => addEdge(params, els));
    const onPaneReady = (rfi: ReactFlowInstance) => setReactFlowInstance(rfi);

    // This memoization is important to avoid the ReactFlow component to re-render continuously
    // See https://github.com/wbkd/react-flow/pull/1555#issue-1016332917 (section "nodeTypes and edgeTypes")
    const nodeTypes = useMemo(() => ({ dataset: DatasetNode }), []);

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
            data: { type, label: `${type} node`, columns: [], filename: `Loading ${type?.toUpperCase() ?? ''}…` },
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

        setNodes((nds) => {
            return nds.map((node, index) => {
                if (index === nds.length - 1) {
                    (node as Node<DatasetNodeData>).data = {
                        ...(node as Node<DatasetNodeData>).data,
                        filename: fileName,
                        type,
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
            onPaneReady={onPaneReady}
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
