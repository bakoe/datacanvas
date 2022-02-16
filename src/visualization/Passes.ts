import { AccumulatePass, BlitPass, Context, DebugPass, Framebuffer, Invalidate, ReadbackPass } from 'webgl-operate';
import { CuboidPass } from './cuboid/CuboidPass';
import { PointDebugPass } from './debug/PointDebugPass';
import { FloorPass } from './floor/FloorPass';
import { PointPrimitivePass } from './point-primitive/PointPrimitivePass';

export class Passes {
    // To-be-created
    protected _floor: FloorPass;

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
    // // To-be-extracted
    // protected _debugPass: DebugPass;

    // // To-be-created
    // protected _pointDebugPass: PointDebugPass;

    protected static _instance: Passes;

    protected constructor(context: Context, _invalidate: Invalidate) {
        this._floor = new FloorPass(context);
        this._floor.initialize();
    }

    public static initialize(context: Context, invalidate: Invalidate): void {
        this._instance = new Passes(context, invalidate);
    }

    public static get floor(): FloorPass {
        return this._instance._floor;
    }

    public static set renderFBO(fbo: Framebuffer) {
        Passes.floor.target = fbo;
    }

    public static get altered(): boolean {
        return Passes.floor.altered;
    }

    public static update(): void {
        Passes.floor.update();
    }
}
