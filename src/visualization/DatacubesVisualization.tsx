import React, { PropsWithChildren } from 'react';

import { ReactFlowState, useStore, XYPosition, useStoreApi, NodeDiffUpdate } from 'react-flow-renderer/nocss';

import shallow from 'zustand/shallow';

import { DatacubesApplication } from './DatacubesApplication';

import { isDatasetNode } from '../data/nodes/DatasetNode';
import { isDateFilterNode } from '../data/nodes/DateFilterNode';
import { isPointPrimitiveNode } from '../data/nodes/PointPrimitiveNode';
import { NodeTypes } from '../data/nodes/enums/NodeTypes';
import { Column as CSVColumn } from '@lukaswagner/csv-parser';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DatacubesProps {}

export interface DatacubeInformation {
    id: number;
    position: XYPosition;
    relativeHeight: number;
    type: NodeTypes;
    isPending?: boolean;
    isErroneous?: boolean;
    xColumn?: CSVColumn;
    yColumn?: CSVColumn;
    zColumn?: CSVColumn;
}

const selector = (s: ReactFlowState) => ({
    updateNodePosition: s.updateNodePosition,
    unselectNodesAndEdges: s.unselectNodesAndEdges,
});

export const DatacubesVisualization: React.FC<DatacubesProps> = ({ ...props }: PropsWithChildren<DatacubesProps>) => {
    const store = useStoreApi();
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const spinnerRef = React.useRef<HTMLDivElement | null>(null);
    const [application, setApplication] = React.useState<DatacubesApplication | undefined>(undefined);

    const { updateNodePosition, unselectNodesAndEdges } = useStore(selector, shallow);

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
        return Array.from(state.nodeInternals).map(([, node]) => {
            let relativeHeight = 1.0;
            let isErroneous = false;
            let isPending: undefined | boolean = false;
            let xColumn = undefined as undefined | CSVColumn;
            let yColumn = undefined as undefined | CSVColumn;
            let zColumn = undefined as undefined | CSVColumn;
            if (isDatasetNode(node) || isDateFilterNode(node) || isPointPrimitiveNode(node)) {
                if (isDatasetNode(node)) {
                    if (overallMaxRowCount) {
                        const colRowCounts = node.data.state?.columns?.map((col) => col.length);
                        if (colRowCounts) {
                            relativeHeight = Math.max(...colRowCounts) / overallMaxRowCount;
                        }
                    }
                    isPending = node.data.state?.isLoading;
                }
                if (isDateFilterNode(node)) {
                    if (overallMaxRowCount) {
                        const colRowCounts = node.data.state?.filteredColumns?.map((col) => col.length);
                        if (colRowCounts) {
                            relativeHeight = Math.max(...colRowCounts) / overallMaxRowCount;
                        }
                    }
                    isErroneous = node.data.state?.errorMessage !== undefined;
                    isPending = node.data.state?.isPending;
                }
                if (isPointPrimitiveNode(node)) {
                    isPending = node.data.state?.isPending;
                    xColumn = node.data.state?.xColumn;
                    yColumn = node.data.state?.yColumn;
                    zColumn = node.data.state?.zColumn;
                }
            }
            return {
                position: node.position,
                id: parseInt(node.id, 10),
                relativeHeight,
                type: node.type,
                isErroneous,
                isPending,
                xColumn,
                yColumn,
                zColumn,
            } as DatacubeInformation;
        });
    });

    const REACT_FLOW_CANVAS_MIN_X = 400;
    const REACT_FLOW_CANVAS_MIN_Y = 20;
    const REACT_FLOW_CANVAS_STEP = 300;

    React.useEffect(() => {
        if (application) {
            (application as DatacubesApplication).datacubes = nodeInformations.map(
                ({ position, ...data }) =>
                    ({
                        ...data,
                        position: {
                            x: (position.x - REACT_FLOW_CANVAS_MIN_X) / REACT_FLOW_CANVAS_STEP,
                            y: (position.y - REACT_FLOW_CANVAS_MIN_Y) / REACT_FLOW_CANVAS_STEP,
                        },
                    } as DatacubeInformation),
            );
        }
    }, [application, JSON.stringify(nodeInformations)]);

    React.useEffect(() => {
        if (canvasRef.current) {
            const exampleInstance = new DatacubesApplication();
            exampleInstance.initialize(canvasRef.current, spinnerRef.current || undefined);
            setApplication(exampleInstance);
            exampleInstance.datacubes$?.subscribe((datacubes: Array<DatacubeInformation>) => {
                unselectNodesAndEdges();

                const nodeInternals = store.getState().nodeInternals;
                nodeInternals.forEach((node) => {
                    const id = parseInt(node.id, 10);
                    const datacube = datacubes.find((dc) => dc.id === id);
                    if (datacube) {
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
                });
            });
        }

        // Commented-out to avoid infinite recursion in application's uninitialization(?)
        // return () => {
        //     if (application) {
        //         application.uninitialize();
        //     }
        // };
    }, []);

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
