import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

// Fall back to ArrayBuffer if the does not support SharedArrayBuffer
// (or if the website does not fulfil the cross-origin isolation criteria)
if (self.SharedArrayBuffer !== undefined) {
    console.log('SharedArrayBuffer available (but not necessarily permitted)');
}
if (!self.crossOriginIsolated || self.SharedArrayBuffer === undefined) {
    window['SharedArrayBuffer'] = ArrayBuffer as any;
}

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root'),
);
