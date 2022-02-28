import { BlitPass, NdcFillingTriangle, Program, Shader } from 'webgl-operate';
// import { assert } from 'webgl-operate/lib/auxiliaries';

import blitVert from '../shaders/blit.vert';
import blitDebugFrag from '../shaders/blit_debug.frag';

export class DebugPassSupportingIDBuffer extends BlitPass {
    protected _debug: DebugPassSupportingIDBuffer.Mode = DebugPassSupportingIDBuffer.Mode.Depth;

    /**
     * Uniform for passing the debug mode to the specialized blit program.
     */
    protected _uDebugMode: WebGLUniformLocation | undefined;

    /**
     * Uniform used to pass near and far data to the specialized blit program for linearization.
     */
    protected _uLinearize: WebGLUniformLocation | undefined;

    /**
     * If provided, depth will be linearized when depth data is blitted.
     */
    protected _near: GLfloat = 0.0;
    protected _far: GLfloat = 0.0;

    /**
     * Used to create (on-demand) the blit program for program based blitting. This function can be specialized, e.g.,
     * for creating custom blit passes such as the `DebugPass` {@link DebugPass}. This method assumes the program to be
     * undefined.
     */
    protected createProgram(): boolean {
        // assert(this._program === undefined, `expected blit program to be undefined before its creation`);
        const gl = this._context.gl;

        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'blit.vert (debug)');
        vert.initialize(blitVert);
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'blit_debug.frag (debug)');
        frag.initialize(blitDebugFrag);

        this._program = new Program(this._context, 'DebugProgram');
        this._program.initialize([vert, frag]);

        if (!this._ndcTriangle.initialized) {
            this._ndcTriangle.initialize();
        }
        this._program.attribute('a_vertex', this._ndcTriangle.vertexLocation);
        this._program.link();

        this._uSrcBounds = this._program.uniform('u_srcBounds');
        this._uDstBounds = this._program.uniform('u_dstBounds');
        this._uNearest = this._program.uniform('u_nearest');

        this._uDebugMode = this._program.uniform('u_mode');
        this._uLinearize = this._program.uniform('u_linearize');

        this._program.bind();
        gl.uniform1i(this._program.uniform('u_source'), 0);
        gl.uniform1i(this._uDebugMode, this._debug);
        this._program.unbind();

        return this._program.valid;
    }

    /**
     */
    initialize(ndcTriangle?: NdcFillingTriangle): boolean {
        const result = super.initialize(ndcTriangle);
        this.enforceProgramBlit = true;

        return result && this.createProgram();
    }

    /**
     * Specializes this pass's uninitialization. Program and geometry resources are released (if allocated). Cached
     * uniform and attribute locations are invalidated.
     */
    uninitialize(): void {
        super.uninitialize();

        this._uDebugMode = undefined;
        this._uLinearize = undefined;
    }

    /**
     * Specify a debug mode for blitting @see {@link Blitpass.Debug}. If the debug mode is set to anything except
     * `Debug.None` for the first time, a specialized debug program will be created, initialized, and used for blit.
     */
    set debug(mode: DebugPassSupportingIDBuffer.Mode) {
        this.assertInitialized();
        if (this._debug === mode) {
            return;
        }
        this._debug = mode;

        if (this._program === undefined || !this._program.valid) {
            return;
        }

        this._program.bind();
        this._context.gl.uniform1i(this._uDebugMode, this._debug);
        this._program.unbind();
    }

    /**
     * If linearized is enabled, depth buffer blitting will use this near value for linearization.
     */
    set near(near: GLfloat | undefined) {
        this._near = near ? near : 0.0;

        if (this._program === undefined || !this._program.valid) {
            return;
        }

        this._program.bind();
        this._context.gl.uniform2f(this._uLinearize, this._near, this._far);
        this._program.unbind();
    }

    /**
     * If linearized is enabled, depth buffer blitting will use this far value for linearization.
     */
    set far(far: GLfloat | undefined) {
        this._far = far ? far : 0.0;

        if (this._program === undefined || !this._program.valid) {
            return;
        }

        this._program.bind();
        this._context.gl.uniform2f(this._uLinearize, this._near, this._far);
        this._program.unbind();
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DebugPassSupportingIDBuffer {
    export enum Mode {
        None = 0,
        Depth = 1,
        DepthLinear = 2,
        DepthPacked = 3,
        DepthLinearPacked = 4,
        IDBuffer = 5,
    }
}
