import { Context, Framebuffer, Invalidate } from 'webgl-operate';
import { FloorPass } from './floor/FloorPass';
import { LabelPass } from './label/LabelPass';
import { LinePass } from './line/LinePass';

const fontApi = 'https://fonts.varg.dev/api/fonts/';
const robotoFont = 'roboto-regular.ttf/61cc7e5a56a3775a3f27899a658881e1';
const Roboto = {
    fnt: fontApi + robotoFont + '/fontdescription',
    png: fontApi + robotoFont + '/distancefield',
};

const interRegularFont = 'inter-regular.ttf/11cb1170deec982ea806a414c4fae848';
const InterRegular = {
    fnt: fontApi + interRegularFont + '/fontdescription',
    png: fontApi + interRegularFont + '/distancefield',
};

export class Passes {
    protected _floor: FloorPass;

    protected _labels: LabelPass;
    protected _lines: LinePass;

    // // To-be-created
    // protected _cuboids: CuboidPass;
    // // To-be-created
    // protected _pointPrimitives: PointPrimitivePass;

    // // To-be-extracted
    // protected _accumulate: AccumulatePass;
    // // To-be-extracted
    // protected _blit: BlitPass;

    // // To-be-extracted
    // protected _readbackPass: ReadbackPass;
    // // To-be-extractedf
    // protected _debugPass: DebugPass;

    // // To-be-created
    // protected _pointDebugPass: PointDebugPass;

    protected static _instance: Passes;

    protected constructor(context: Context, invalidate: Invalidate) {
        this._floor = new FloorPass(context);
        this._floor.initialize();

        this._labels = new LabelPass(context);
        this._labels.initialize();
        this._labels.depthMask = true;
        // ts-ignore
        this._labels.loadFont(InterRegular.fnt, InterRegular.png, invalidate);

        this._lines = new LinePass(context);
        this._lines.initialize();
    }

    public static initialize(context: Context, invalidate: Invalidate): void {
        this._instance = new Passes(context, invalidate);
    }

    public static get floor(): FloorPass {
        return this._instance._floor;
    }

    public static get labels(): LabelPass {
        return this._instance._labels;
    }

    public static get lines(): LinePass {
        return this._instance._lines;
    }

    public static set renderFBO(fbo: Framebuffer) {
        Passes.floor.target = fbo;
        Passes.labels.target = fbo;
        Passes.lines.target = fbo;
    }

    public static get altered(): boolean {
        return Passes.floor.altered || Passes.labels.altered || Passes.lines.altered;
    }

    public static update(): void {
        Passes.floor.update();
        Passes.labels.update();
        Passes.lines.update();
    }
}