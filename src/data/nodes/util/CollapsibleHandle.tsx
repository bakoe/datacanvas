import { FC, useEffect, useState, useRef, cloneElement, ReactElement, memo } from 'react';
import { useStore } from 'react-flow-renderer/nocss';

import { HandleComponentProps } from 'react-flow-renderer/dist/nocss/components/Handle';

const CollapsibleHandle: FC<{
    isCollapsed: boolean;
    onElementHeightChange: (height: number) => void;
    previousElementsHeight: number;
    handleElement: ReactElement<HandleComponentProps>;
}> = ({ isCollapsed, onElementHeightChange, previousElementsHeight, handleElement, children }) => {
    const [, , zoom] = useStore((state) => state.transform);
    const handleWrapperRef = useRef(null);
    const [yOffsetCompensation, setYOffsetCompensation] = useState(0);

    useEffect(() => {
        if (!isCollapsed) {
            setYOffsetCompensation(0);
            return;
        }
        let elemPixHeight = 0;
        if (handleWrapperRef.current) {
            elemPixHeight = (handleWrapperRef.current as HTMLElement).getBoundingClientRect().height / zoom;
        }
        setYOffsetCompensation(previousElementsHeight);
        onElementHeightChange(elemPixHeight);
    }, [isCollapsed, previousElementsHeight]);

    useEffect(() => {
        if (!isCollapsed) {
            setYOffsetCompensation(0);
            return;
        }
        let elemPixHeight = 0;
        if (handleWrapperRef.current) {
            elemPixHeight = (handleWrapperRef.current as HTMLElement).getBoundingClientRect().height / zoom;
        }
        setYOffsetCompensation(previousElementsHeight);
        onElementHeightChange(elemPixHeight);
    }, []);

    const style = isCollapsed
        ? { transform: `translateY(calc(-0.2rem - 0.4rem - 5px - 0.4rem - 2.5px - ${yOffsetCompensation}px)`, opacity: 0 }
        : { opacity: 1 };

    const HandleWithAddedStyleProp = cloneElement(handleElement, { style: style });

    return (
        <div className="handle-wrapper" ref={handleWrapperRef}>
            {HandleWithAddedStyleProp}
            {children}
        </div>
    );
};

export default memo(CollapsibleHandle);
