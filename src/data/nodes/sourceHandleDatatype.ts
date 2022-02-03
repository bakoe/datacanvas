import { Node } from 'react-flow-renderer/nocss';
import { DateFilterNodeSourceHandles, DateFilterNodeSourceHandlesDatatypes } from './DateFilterNode';
import { Datatypes } from './enums/Datatypes';
import { NodeTypes } from './enums/NodeTypes';
import { PointPrimitiveNodeTargetHandles, PointPrimitiveNodeTargetHandlesDatatypes } from './PointPrimitiveNode';

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
        case NodeTypes.PointPrimitive:
            return PointPrimitiveNodeTargetHandlesDatatypes.get(targetHandle as PointPrimitiveNodeTargetHandles);
        default:
            return undefined;
    }
}
