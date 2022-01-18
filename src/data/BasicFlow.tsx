import { MouseEvent, useMemo } from 'react';

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
} from 'react-flow-renderer';

import DatasetNode, { DatasetNodeData } from './nodes/DatasetNode';

const onNodeDragStop = (_: MouseEvent, node: Node) => console.log('drag stop', node);
const onNodeClick = (_: MouseEvent, node: Node) => console.log('click', node);
const onPaneReady = (reactFlowInstance: ReactFlowInstance) => console.log('pane ready:', reactFlowInstance);

const initialNodes: Node[] = [
    {
        type: 'dataset',
        id: '5',
        data: { filename: 'foo.csv', type: 'csv', columns: [{ type: 'number', name: 'col1' }] },
        position: { x: 400, y: 40 },
        className: 'light',
    } as Node<DatasetNodeData>,
    {
        type: 'dataset',
        id: '6',
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

const initialEdges: Edge[] = [];

const BasicFlow = () => {
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const onConnect = (params: Edge | Connection) => setEdges((els) => addEdge(params, els));

    // This memoization is important to avoid the ReactFlow component to re-render continuously
    // See https://github.com/wbkd/react-flow/pull/1555#issue-1016332917 (section "nodeTypes and edgeTypes")
    const nodeTypes = useMemo(() => ({ dataset: DatasetNode }), []);

    return (
        <ReactFlow
            nodes={nodes}
            nodeTypes={nodeTypes}
            edges={edges}
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
