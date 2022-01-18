import { ReactFlowProvider } from 'react-flow-renderer';

import BasicFlow from './data/BasicFlow';
import { DatacubesVisualization } from './visualization/DatacubesVisualization';

function App() {
    return (
        <ReactFlowProvider>
            <div style={{ width: '100%', height: '50vh' }}>
                <BasicFlow />
            </div>
            <div style={{ width: '100%', height: '50vh' }}>
                <DatacubesVisualization />
            </div>
        </ReactFlowProvider>
    );
}

export default App;
