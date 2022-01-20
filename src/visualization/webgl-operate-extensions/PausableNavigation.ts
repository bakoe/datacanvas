import { EventProvider, Invalidate, Navigation } from 'webgl-operate';
import { PausableEventHandler } from './PausableEventHandler';

export class PausableNavigation extends Navigation {
    protected declare _eventHandler: PausableEventHandler;

    constructor(invalidate: Invalidate, eventProvider: EventProvider) {
        super(invalidate, eventProvider);

        // Use a PausableEventHandler instead of a regular EventHandler -> thus, re-create the event handler
        this._eventHandler.dispose();

        /* Create event handler that listens to mouse events. */
        this._eventHandler = new PausableEventHandler(invalidate, eventProvider);

        /* Listen to pointer events. */
        this._eventHandler.pushPointerDownHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerDown(latests, previous),
        );
        this._eventHandler.pushPointerUpHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerUp(latests, previous),
        );
        this._eventHandler.pushPointerEnterHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerEnter(latests, previous),
        );
        this._eventHandler.pushPointerLeaveHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerLeave(latests, previous),
        );
        this._eventHandler.pushPointerMoveHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerMove(latests, previous),
        );
        this._eventHandler.pushPointerCancelHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerCancel(latests, previous),
        );

        // TODO: Fix type error -> repace the two "any"s with, e.g., MouseEvent or WheelEvent
        // Argument of type '(latests: Array<WheelEvent>, previous: Array<WheelEvent>) => void' is not assignable to parameter of type 'MouseEventHandler'.
        // (Apparently, pushMouseWheelHandler expects a MouseEventHandler instead of something like a WheelEventHandler)
        this._eventHandler.pushMouseWheelHandler((latests: Array<any>, previous: Array<any>) => this.onWheel(latests, previous));
    }

    set isPaused(isPaused: boolean) {
        this._eventHandler.isPaused = isPaused;
    }
}
