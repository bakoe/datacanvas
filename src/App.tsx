import { ReactFlowProvider } from 'react-flow-renderer';

import Split from 'react-split';

import BasicFlow from './data/BasicFlow';
import { DatacubesVisualization } from './visualization/DatacubesVisualization';

import classes from './assets/styles/react-split.module.css';

function App() {
    return (
        <ReactFlowProvider>
            <Split
                sizes={[50, 50]}
                className={classes.split}
                direction="vertical"
                gutter={(): HTMLElement => {
                    const gutter = document.createElement('div');
                    gutter.className = `${classes.gutter} ${classes.gutterVertical}`;
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
