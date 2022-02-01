import { Node } from 'react-flow-renderer/dist/nocss';
import { DateFilterNodeSourceHandles, DateFilterNodeSourceHandlesDatatypes } from './DateFilterNode';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import { ScatterplotNodeTargetHandles, ScatterplotNodeTargetHandlesDatatypes } from './ScatterplotNode';

export function sourceHandleDatatype(node: Node<unknown>, sourceHandle: string | null): Datatypes | undefined {
    switch (node.type as NodeTypes) {
        case NodeTypes.DateFilter:
            return DateFilterNodeSourceHandlesDatatypes.get(sourceHandle as DateFilterNodeSourceHandles);
        default:
            return undefined;
    }
}

export function targetHandleDatatype(node: Node<unknown>, targetHandle: string | null): Datatypes | undefined {
    switch (node.type as NodeTypes) {
        case NodeTypes.Scatterplot:
            return ScatterplotNodeTargetHandlesDatatypes.get(targetHandle as ScatterplotNodeTargetHandles);
        default:
            return undefined;
    }
}
