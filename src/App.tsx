import React, { useEffect, useState } from 'react';
import { ReactFlowInstance, ReactFlowProvider } from 'react-flow-renderer/nocss';

import Split from 'react-split';
import { Renderer } from 'webgl-operate';

import BasicFlow from './data/BasicFlow';
import { DatacubesVisualization } from './visualization/DatacubesVisualization';

const Controls: React.FC<{
    onChangeHighQualityRenderingImageBase64: (base64String: string | undefined) => void;
    showClearButton?: boolean;
}> = ({ showClearButton, onChangeHighQualityRenderingImageBase64 }) => {
    const [fetchAbortController, setFetchAbortController] = React.useState(undefined as undefined | AbortController);

    const onRenderHighQualityVisualization = async () => {
        let usedAbortController;

        if (fetchAbortController) {
            (fetchAbortController as AbortController).abort();
            usedAbortController = fetchAbortController;
        } else {
            usedAbortController = new AbortController();
            setFetchAbortController(usedAbortController);
        }

        const width = (window['renderer'] as any).canvasSize[0];
        const height = (window['renderer'] as any).canvasSize[1];
        const cameraCenter = Object.values((window['renderer'] as any)._camera.center);
        const cameraEye = Object.values((window['renderer'] as any)._camera.eye);
        const cameraFovYDegrees = (window['renderer'] as any)._camera.fovy;
        const sceneElements = (window['renderer'] as any)._cuboids;

        let response;

        try {
            response = await fetch('/api/renderings/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    camera_center: cameraCenter,
                    camera_eye: cameraEye,
                    camera_fov_y_degrees: cameraFovYDegrees,
                    width,
                    height,
                    scene_elements: sceneElements,
                }),
                signal: usedAbortController.signal,
            });
            if (!response.ok) {
                throw new Error(response.statusText);
            }
        } catch (error) {
            onChangeHighQualityRenderingImageBase64(undefined);
            setFetchAbortController(undefined);
            return;
        }

        const blob = await response.blob();

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = function () {
            const base64data = reader.result;
            if (base64data) {
                onChangeHighQualityRenderingImageBase64(base64data.toString());
            }
            setFetchAbortController(undefined);
        };
    };

    return (
        <div
            style={{
                marginTop: '1rem',
                marginLeft: '1rem',
                fontSize: '1.2rem',
                position: 'absolute',
                top: '0',
                pointerEvents: 'initial',
            }}
        >
            <a
                className="link"
                onClick={() => {
                    if (fetchAbortController) {
                        fetchAbortController.abort();
                        setFetchAbortController(undefined);
                        return;
                    }
                    onRenderHighQualityVisualization();
                }}
            >
                {fetchAbortController ? 'Rendering high-quality visualization (click to cancel) …' : 'Render high-quality visualization'}
            </a>
            {showClearButton && (
                <a style={{ marginLeft: '1rem' }} className="link" onClick={() => onChangeHighQualityRenderingImageBase64(undefined)}>
                    Clear
                </a>
            )}
        </div>
    );
};

function App() {
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance>();
    const highQualityRenderingOverlayRef = React.useRef<HTMLDivElement | null>(null);
    const [highQualityRenderingImageBase64, setHighQualityRenderingImageBase64] = React.useState(undefined as string | undefined);

    useEffect(() => {
        if (highQualityRenderingImageBase64 && highQualityRenderingOverlayRef.current) {
            highQualityRenderingOverlayRef.current.style.backgroundImage = `url(${highQualityRenderingImageBase64})`;
            // Block pointer events to the underlying WebGL canvas
            highQualityRenderingOverlayRef.current.style.pointerEvents = 'all';
            highQualityRenderingOverlayRef.current.style.backgroundSize = 'contain';
            highQualityRenderingOverlayRef.current.style.display = 'block';
            // Remove the image when the user triggers a pointer-down event on the overlay
            highQualityRenderingOverlayRef.current.onpointerdown = () => {
                setHighQualityRenderingImageBase64(undefined);
            };
        } else if (highQualityRenderingOverlayRef.current) {
            highQualityRenderingOverlayRef.current.style.pointerEvents = 'none';
            highQualityRenderingOverlayRef.current.style.display = 'none';
        }
    }, [highQualityRenderingImageBase64]);

    return (
        <ReactFlowProvider>
            <Split
                sizes={[50, 50]}
                className="split"
                direction="vertical"
                gutter={(): HTMLElement => {
                    const gutter = document.createElement('div');
                    gutter.className = `gutter gutter-vertical`;
                    return gutter;
                }}
            >
                <BasicFlow />
                <DatacubesVisualization>
                    <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }} ref={highQualityRenderingOverlayRef}></div>
                    <Controls
                        onChangeHighQualityRenderingImageBase64={(base64String) => setHighQualityRenderingImageBase64(base64String)}
                        showClearButton={highQualityRenderingImageBase64 !== undefined}
                    />
                </DatacubesVisualization>
            </Split>
        </ReactFlowProvider>
    );
}

export default App;
