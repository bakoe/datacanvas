import React, { PropsWithChildren } from 'react';

import { DatacubesApplication } from './DatacubesApplication';

import classes from '../assets/styles/webgloperate.module.css';

interface DatacubesProps {
    cellWidthDenominator?: number;
}

export const DatacubesVisualization: React.FC<DatacubesProps> = ({
    cellWidthDenominator = 64,
    ...props
}: PropsWithChildren<DatacubesProps>) => {
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const spinnerRef = React.useRef<HTMLDivElement | null>(null);
    const [application, setApplication] = React.useState<DatacubesApplication | undefined>(undefined);

    React.useEffect(() => {
        if (application) {
            (application as DatacubesApplication).cellWidth = 1.0 / cellWidthDenominator;
        }
    }, [application, cellWidthDenominator]);

    React.useEffect(() => {
        if (canvasRef.current) {
            const exampleInstance = new DatacubesApplication();

            exampleInstance.initialize(canvasRef.current, spinnerRef.current || undefined);

            (exampleInstance as DatacubesApplication).cellWidth = 1.0 / cellWidthDenominator;

            setApplication(exampleInstance);
        }

        return () => {
            if (application) {
                application.uninitialize();
            }
        };
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
