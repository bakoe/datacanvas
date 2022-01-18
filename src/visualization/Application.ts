import { Canvas, Context, Controller, Initializable, LoadingStatus, Renderer, viewer } from 'webgl-operate';

declare global {
    interface Window {
        canvas?: Canvas;
        context?: Context;
        controller?: Controller;
        renderer?: Renderer;
    }
}

export abstract class Application extends Initializable {
    protected _canvas: Canvas | undefined;
    protected _spinner: HTMLDivElement | undefined;
    protected _renderer: Renderer | undefined;

    /**
     * Hide the loading spinner.
     */
    protected showSpinner(): void {
        const spinnerElement = this._spinner;
        if (spinnerElement) {
            (spinnerElement as HTMLElement).style.display = 'inline';
        }
    }

    /**
     * Hide the loading spinner.
     */
    protected hideSpinner(): void {
        const spinnerElement = this._spinner;
        if (spinnerElement) {
            (spinnerElement as HTMLElement).style.display = 'none';
        }
    }

    protected expose(): void {
        window['canvas'] = this.canvas;
        window['context'] = this.canvas?.context;
        window['controller'] = this.canvas?.controller;

        window['renderer'] = this.renderer;
    }

    initialize(element: HTMLCanvasElement | string, spinnerElement?: HTMLDivElement): boolean {
        const result = this.onInitialize(element, spinnerElement);

        this.renderer?.loadingStatus$.subscribe((status: LoadingStatus) => {
            if (status === LoadingStatus.Finished) {
                this.hideSpinner();
            } else if (status === LoadingStatus.Started) {
                this.showSpinner();
            }
        });

        this.expose();

        return result;
    }

    uninitialize(): void {
        this.onUninitialize();
    }

    enableFullscreenOnCtrlClick(): void {
        const e = this.canvas?.element;
        if (e) {
            e.addEventListener('click', (event) => {
                if (event.ctrlKey) {
                    viewer?.Fullscreen.toggle(e);
                }
            });
        }
    }

    // eslint-disable-next-line no-unused-vars
    abstract onInitialize(element: HTMLCanvasElement | string, spinnerElement?: HTMLDivElement): boolean;

    onUninitialize(): void {
        this._canvas?.dispose();
        (this._renderer as Renderer).uninitialize();
    }

    get canvas(): Canvas | undefined {
        return this._canvas;
    }

    get renderer(): Renderer | undefined {
        return this._renderer;
    }
}
