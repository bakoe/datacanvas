import React, { PropsWithChildren } from 'react';

import { ReactFlowState, useStore, XYPosition } from 'react-flow-renderer';

import { DatacubesApplication } from './DatacubesApplication';

import classes from '../assets/styles/webgloperate.module.css';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DatacubesProps {}

export const DatacubesVisualization: React.FC<DatacubesProps> = ({ ...props }: PropsWithChildren<DatacubesProps>) => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const spinnerRef = React.useRef<HTMLDivElement | null>(null);
    const [application, setApplication] = React.useState<DatacubesApplication | undefined>(undefined);

    const nodePositions = useStore((state: ReactFlowState) => Array.from(state.nodeInternals).map(([, node]) => node.position));

    const REACT_FLOW_CANVAS_MIN_X = 400;
    const REACT_FLOW_CANVAS_MIN_Y = 20;
    const REACT_FLOW_CANVAS_STEP = 300;

    React.useEffect(() => {
        if (application) {
            (application as DatacubesApplication).datacubesPositions = nodePositions.map(
                (xyPosition) =>
                    ({
                        x: (xyPosition.x - REACT_FLOW_CANVAS_MIN_X) / REACT_FLOW_CANVAS_STEP,
                        y: (xyPosition.y - REACT_FLOW_CANVAS_MIN_Y) / REACT_FLOW_CANVAS_STEP,
                    } as XYPosition),
            );
        }
    }, [application, JSON.stringify(nodePositions)]);

    React.useEffect(() => {
        if (canvasRef.current) {
            const exampleInstance = new DatacubesApplication();
            exampleInstance.initialize(canvasRef.current, spinnerRef.current || undefined);
            setApplication(exampleInstance);
        }

        // Commented-out to avoid infinite recursion in application's uninitialization(?)
        // return () => {
        //     if (application) {
        //         application.uninitialize();
        //     }
        // };
    }, []);

    return (
        <>
            <canvas className={classes.canvas} ref={canvasRef} />
            <div className={classes.spinner} ref={spinnerRef}>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
            {props.children}
        </>
    );
};
