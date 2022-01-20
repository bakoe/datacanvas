import { EventHandler, EyeGazeEventProvider, MouseEventProvider, PointerEventProvider, TouchEventProvider } from 'webgl-operate';

export class PausableEventHandler extends EventHandler {
    protected _isPaused = false;

    set isPaused(isPaused: boolean) {
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
