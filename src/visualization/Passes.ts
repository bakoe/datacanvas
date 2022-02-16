import { AccumulatePass, BlitPass, Context, DebugPass, Framebuffer, Invalidate, ReadbackPass } from 'webgl-operate';
import { CuboidPass } from './cuboid/CuboidPass';
import { PointDebugPass } from './debug/PointDebugPass';
import { FloorPass } from './floor/FloorPass';
import { PointPrimitivePass } from './point-primitive/PointPrimitivePass';
import { LabelPass } from './label/LabelPass';

const fontApi = 'https://fonts.varg.dev/api/fonts/';
const font = 'roboto-regular.ttf/61cc7e5a56a3775a3f27899a658881e1';
const Roboto = {
    fnt: fontApi + font + '/fontdescription',
    png: fontApi + font + '/distancefield',
};

export class Passes {
    // To-be-created
    protected _floor: FloorPass;

    protected _labels: LabelPass;

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
        this._labels.loadFont(Roboto.fnt, Roboto.png, invalidate);
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

    public static set renderFBO(fbo: Framebuffer) {
        Passes.floor.target = fbo;
        Passes.labels.target = fbo;
    }

    public static get altered(): boolean {
        return Passes.floor.altered || Passes.labels.altered;
    }

    public static update(): void {
        Passes.floor.update();
        Passes.labels.update();
    }
}
