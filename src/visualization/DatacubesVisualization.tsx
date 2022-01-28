import React, { PropsWithChildren } from 'react';

import { ReactFlowState, useStore, XYPosition, useStoreApi, NodeDiffUpdate } from 'react-flow-renderer';

import shallow from 'zustand/shallow';

import { DatacubesApplication } from './DatacubesApplication';

import classes from '../assets/styles/webgloperate.module.css';
import { isDatasetNode } from '../data/nodes/DatasetNode';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DatacubesProps {}

export interface DatacubeInformation {
    id: number;
    position: XYPosition;
    relativeHeight: number;
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

    const nodeInformations = useStore((state: ReactFlowState) =>
        Array.from(state.nodeInternals).map(([, node]) => {
            let relativeHeight = 1.0;
            if (isDatasetNode(node)) {
                const colRowCounts = node.data.state?.columns?.map((col) => col.length);
                if (colRowCounts) {
                    relativeHeight = Math.max(...colRowCounts) / 2000;
                }
            }
            return { position: node.position, id: parseInt(node.id, 10), relativeHeight } as DatacubeInformation;
        }),
    );

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
        <div className={classes.canvasContainer}>
            <canvas className={classes.canvas} ref={canvasRef} />
            <div className={classes.spinner} ref={spinnerRef}>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
            {props.children}
        </div>
    );
};
