import { ChangeLookup, Context, Framebuffer, Initializable, mat4, NdcFillingRectangle, Program, Shader } from 'webgl-operate';
import { GLclampf4 } from 'webgl-operate/lib/tuples';

import floorVert from '../shaders/floor.vert';
import floorFrag from '../shaders/floor.frag';

export class FloorPass extends Initializable {
    protected static readonly SIZE = 16.0;

    protected readonly _altered = Object.assign(new ChangeLookup(), {
        any: false,

        clearColor: false,
        viewProjection: false,
    });

    private _clearColor: GLclampf4 | undefined;
    private _viewProjection: mat4 | undefined;

    protected _context: Context;
    protected _gl: WebGLRenderingContext | WebGL2RenderingContext;

    protected _target: Framebuffer | undefined;

    protected _program: Program;

    protected _uViewProjection: WebGLUniformLocation | undefined;
    protected _uModel: WebGLUniformLocation | undefined;
    protected _uClearColor: WebGLUniformLocation | undefined;
    protected _uDiffuse: WebGLUniformLocation | undefined;

    protected _floor: NdcFillingRectangle | undefined;
    protected _floorTransform: mat4 | undefined;

    public constructor(context: Context) {
        super();
        this._context = context;
        this._gl = context.gl;

        this._program = new Program(this._context);
        this._floor = new NdcFillingRectangle(this._context, 'Floor');
    }

    @Initializable.initialize()
    public initialize(): boolean {
        this._floor?.initialize();

        // prettier-ignore
        this._floorTransform = mat4.fromValues(
            FloorPass.SIZE,  0.0,       0.0,      0.0,
            0.0,             0.0, FloorPass.SIZE, 0.0,
            0.0,  FloorPass.SIZE,       0.0,      0.0,
            0.0,             0.0,       0.0,      1.0
        );

        const vert = new Shader(this._context, this._gl.VERTEX_SHADER, 'floor.vert');
        vert.initialize(floorVert);
        const frag = new Shader(this._context, this._gl.FRAGMENT_SHADER, 'floor.frag');
        frag.initialize(floorFrag);

        this._program.initialize([vert, frag], false);

        this._program.link();

        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uClearColor = this._program.uniform('u_clearColor');
        this._uModel = this._program.uniform('u_model');
        this._uDiffuse = this._program.uniform('u_diffuse');

        return true;
    }

    @Initializable.uninitialize()
    public uninitialize(): void {
        this._floor?.uninitialize();
        this._program?.uninitialize();

        this._uViewProjection = undefined;
        this._uModel = undefined;
        this._uDiffuse = undefined;
    }

    @Initializable.assert_initialized()
    public update(_override = false): void {
        this._altered.reset();
    }

    @Initializable.assert_initialized()
    public frame(): void {
        if (!this._target || !this._floor) {
            return;
        }

        const gl = this._gl;

        this._target.bind();

        const size = this._target.size;

        gl.viewport(0, 0, size[0], size[1]);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);

        this._program.bind();

        if (this._uViewProjection && this._viewProjection) gl.uniformMatrix4fv(this._uViewProjection, false, this._viewProjection);
        if (this._uClearColor && this._clearColor)
            this._gl.uniform4f(this._uClearColor, this._clearColor[0], this._clearColor[1], this._clearColor[2], this._clearColor[3]);

        if (this._uModel && this._floorTransform) gl.uniformMatrix4fv(this._uModel, false, this._floorTransform);
        if (this._uDiffuse) gl.uniform4f(this._uDiffuse, 0.5, 0.5, 0.5, 0.25);

        this._floor.bind();
        this._floor.draw();
        this._floor.unbind();

        this._program.unbind();

        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
    }

    // @Initializable.assert_initialized()
    // public drawDepth(uModel?: WebGLUniformLocation): void {
    //     if (!this._floor) {
    //         return;
    //     }

    //     const gl = this._gl;

    //     gl.cullFace(gl.BACK);

    //     if (uModel && this._floorTransform) gl.uniformMatrix4fv(uModel, false, this._floorTransform);

    //     this._floor.bind();
    //     this._floor?.draw();
    //     this._floor?.unbind();
    // }

    public set target(target: Framebuffer) {
        this.assertInitialized();
        this._target = target;
    }

    public get altered(): boolean {
        return this._altered.any;
    }

    public set clearColor(clearColor: GLclampf4) {
        this._clearColor = clearColor;
        this._altered.alter('clearColor');
    }

    public set viewProjection(value: mat4 | undefined) {
        this._viewProjection = value;
    }
}
