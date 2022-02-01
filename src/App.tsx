import { ReactFlowProvider } from 'react-flow-renderer/nocss';

import Split from 'react-split';

import BasicFlow from './data/BasicFlow';
import { DatacubesVisualization } from './visualization/DatacubesVisualization';

function App() {
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
                <DatacubesVisualization />
            </Split>
        </ReactFlowProvider>
    );
}

export default App;
