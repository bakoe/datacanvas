import { CSSProperties, FC, memo } from 'react';
import { Node } from 'react-flow-renderer/nocss';

import { NodeWithStateProps } from '../BasicFlow';
import { NodeTypes } from './enums/NodeTypes';

export function isFixedTextNode(node: Node<unknown>): node is Node<FixedTextNodeData> {
    return node.type === NodeTypes.FixedText;
}

export interface FixedTextNodeData {
    text: string;
    align: 'right' | 'left';
}

type FixedTextNodeProps = NodeWithStateProps<FixedTextNodeData>;

const FixedTextNode: FC<FixedTextNodeProps> = ({ data }) => {
    const { text, align } = data;

    let style = {
        cursor: 'initial',
    } as CSSProperties;

    if (align === 'right') {
        style = {
            ...style,
            position: 'absolute',
            right: 0,
        };
    }

    return <div style={style}>{text}</div>;
};

export default memo(FixedTextNode);
