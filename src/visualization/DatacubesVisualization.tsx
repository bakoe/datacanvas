import React, { PropsWithChildren } from 'react';

import { useStore } from 'react-flow-renderer';

import { DatacubesApplication } from './DatacubesApplication';

import classes from '../assets/styles/webgloperate.module.css';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DatacubesProps {}

export const DatacubesVisualization: React.FC<DatacubesProps> = ({ ...props }: PropsWithChildren<DatacubesProps>) => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const spinnerRef = React.useRef<HTMLDivElement | null>(null);
    const [application, setApplication] = React.useState<DatacubesApplication | undefined>(undefined);

    const transform = useStore((store) => store.transform);

    React.useEffect(() => {
        if (application) {
            (application as DatacubesApplication).cellWidth = 1.0 / transform[0];
        }
    }, [application, JSON.stringify(transform)]);

    React.useEffect(() => {
        if (canvasRef.current) {
            const exampleInstance = new DatacubesApplication();

            exampleInstance.initialize(canvasRef.current, spinnerRef.current || undefined);

            (exampleInstance as DatacubesApplication).cellWidth = 1.0 / 64.0;

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
