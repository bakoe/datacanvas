import { Camera as PerspectiveCamera, EventProvider, Invalidate, Navigation } from 'webgl-operate';
import { OrthographicAndPerspectivePinchZoomModifier } from './OrthographicAndPerspectivePinchZoomModifier';
import { OrthographicCamera } from './OrthographicCamera';
import { OrthographicWheelZoomModifier } from './OrthographicWheelZoomModifier';
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

        // TODO: Fix type error -> replace the two "any"s with, e.g., MouseEvent or WheelEvent
        // Argument of type '(latests: Array<WheelEvent>, previous: Array<WheelEvent>) => void' is not assignable to parameter of type 'MouseEventHandler'.
        // (Apparently, pushMouseWheelHandler expects a MouseEventHandler instead of something like a WheelEventHandler)
        this._eventHandler.pushMouseWheelHandler((latests: Array<any>, previous: Array<any>) => this.onWheel(latests, previous));

        this._wheelZoom = new OrthographicWheelZoomModifier();
        this._wheelZoom.camera = this._camera;

        this._pinch = new OrthographicAndPerspectivePinchZoomModifier();
        this._pinch.camera = this._camera;
    }

    set isPaused(isPaused: boolean) {
        this._eventHandler.isPaused = isPaused;
    }

    set camera(camera: PerspectiveCamera | OrthographicCamera) {
        this._camera = camera;
        if (this._firstPerson) {
            this._firstPerson.camera = camera;
        }
        if (this._trackball) {
            this._trackball.camera = camera;
        }
        if (this._turntable) {
            this._turntable.camera = camera;
        }
        if (this._pan) {
            this._pan.camera = camera;
        }
        if (this._pinch) {
            this._pinch.camera = camera;
        }
        if (this._wheelZoom) {
            this._wheelZoom.camera = camera;
        }
    }

    get camera(): PerspectiveCamera | OrthographicCamera {
        return this._camera;
    }
}
