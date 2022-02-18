import { EventHandler, EyeGazeEventProvider, MouseEventProvider, PointerEventProvider, TouchEventProvider } from 'webgl-operate';

export class PausableEventHandler extends EventHandler {
    protected _isPaused = false;

    set isPaused(isPaused: boolean) {
        if (isPaused === false) {
            // On un-pausing, clear the list of intermediate events
            this._latestMouseEventsByType.forEach((value) => (value.length = 0));
            this._previousMouseEventsByType.forEach((value) => (value.length = 0));
            this._latestTouchEventsByType.forEach((value) => (value.length = 0));
            this._previousTouchEventsByType.forEach((value) => (value.length = 0));
            this._latestPointerEventsByType.forEach((value) => (value.length = 0));
            this._previousPointerEventsByType.forEach((value) => (value.length = 0));
            this._previousEyeGazeEventsByType.forEach((value) => (value.length = 0));
            this._latestEyeGazeEventsByType.forEach((value) => (value.length = 0));
        }

        this._isPaused = isPaused;
    }

    update(): void {
        if (this._isPaused) {
            return;
        }

        // Call super method
        this.invokeMouseEventHandler(MouseEventProvider.Type.Click);
        this.invokeMouseEventHandler(MouseEventProvider.Type.Enter);
        this.invokeMouseEventHandler(MouseEventProvider.Type.Leave);
        this.invokeMouseEventHandler(MouseEventProvider.Type.Down);
        this.invokeMouseEventHandler(MouseEventProvider.Type.Up);
        this.invokeMouseEventHandler(MouseEventProvider.Type.Move);
        this.invokeMouseEventHandler(MouseEventProvider.Type.Wheel);

        this.invokeTouchEventHandler(TouchEventProvider.Type.Start);
        this.invokeTouchEventHandler(TouchEventProvider.Type.End);
        this.invokeTouchEventHandler(TouchEventProvider.Type.Move);
        this.invokeTouchEventHandler(TouchEventProvider.Type.Cancel);

        this.invokePointerEventHandler(PointerEventProvider.Type.Move);
        this.invokePointerEventHandler(PointerEventProvider.Type.Down);
        this.invokePointerEventHandler(PointerEventProvider.Type.Enter);
        this.invokePointerEventHandler(PointerEventProvider.Type.Up);
        this.invokePointerEventHandler(PointerEventProvider.Type.Leave);
        this.invokePointerEventHandler(PointerEventProvider.Type.Cancel);

        this.invokeEyeGazeEventHandler(EyeGazeEventProvider.Type.EyeGazeData);
        this.invokeEyeGazeEventHandler(EyeGazeEventProvider.Type.NewServerMessage);
        this.invokeEyeGazeEventHandler(EyeGazeEventProvider.Type.ConnectionStatus);
        this.invokeEyeGazeEventHandler(EyeGazeEventProvider.Type.BinaryMessageParsingError);
    }
}
