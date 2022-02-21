import { ChangeLookup, Context, Framebuffer, Initializable, mat4, Program, Shader } from 'webgl-operate';
import { GLfloat2 } from 'webgl-operate/lib/tuples';

import lineVert from '../shaders/line.vert';
import lineFrag from '../shaders/line.frag';

export class LinePass extends Initializable {
    protected readonly _altered = Object.assign(new ChangeLookup(), {
        any: false,

        lines: false,
    });

    private _viewProjection: mat4 | undefined;
    private _ndcOffset: number[] | undefined;

    protected _context: Context;
    protected _gl: WebGLRenderingContext | WebGL2RenderingContext;

    protected _target: Framebuffer | undefined;

    protected _program: Program;

    protected _uViewProjection: WebGLUniformLocation | undefined;
    protected _uNdcOffset: WebGLUniformLocation | undefined;

    protected _lines: Float32Array = new Float32Array(); // x, y, z, r, g, b
    protected _linesBuffer: any;

    public constructor(context: Context) {
        super();
        this._context = context;
        this._gl = context.gl;

        this._program = new Program(this._context);
    }

    @Initializable.initialize()
    public initialize(): boolean {
        const vert = new Shader(this._context, this._gl.VERTEX_SHADER, 'floor.vert');
        vert.initialize(lineVert);
        const frag = new Shader(this._context, this._gl.FRAGMENT_SHADER, 'floor.frag');
        frag.initialize(lineFrag);

        this._program.initialize([vert, frag], false);

        this._program.attribute('a_vertex', 0);
        this._program.attribute('a_color', 1);
        this._program.link();

        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uNdcOffset = this._program.uniform('u_ndcOffset');

        // prettier-ignore
        this.lines = new Float32Array([            
            0, 0, 0, 0, 0, 0,  
            0, 0, 0, 0, 0, 0,  
        ]);

        return true;
    }

    @Initializable.uninitialize()
    public uninitialize(): void {
        this._gl.deleteBuffer(this._linesBuffer);
        this._program?.uninitialize();

        this._uViewProjection = undefined;
        this._uNdcOffset = undefined;
    }

    @Initializable.assert_initialized()
    public update(_override = false): void {
        this._altered.reset();
    }

    @Initializable.assert_initialized()
    public frame(): void {
        if (!this._target) {
            return;
        }

        const gl = this._gl;

        this._target.bind();

        const size = this._target.size;

        gl.viewport(0, 0, size[0], size[1]);

        // gl.enable(gl.DEPTH_TEST);
        // gl.enable(gl.BLEND);
        // gl.depthFunc(gl.LEQUAL);
        // gl.disable(gl.CULL_FACE);
        // gl.depthMask(false);

        this._program.bind();

        if (this._uViewProjection && this._viewProjection) gl.uniformMatrix4fv(this._uViewProjection, false, this._viewProjection);
        if (this._uNdcOffset && this._ndcOffset) gl.uniform2fv(this._uNdcOffset, this._ndcOffset);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._linesBuffer);

        // refer to https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer for more information
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 6 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);

        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);

        gl.drawArrays(gl.LINES, 0, this._lines.length / 6);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);

        this._program.unbind();

        // gl.depthMask(true);
        // gl.enable(gl.CULL_FACE);
    }

    public set target(target: Framebuffer) {
        this.assertInitialized();
        this._target = target;
    }

    public get altered(): boolean {
        return this._altered.any;
    }

    set ndcOffset(offset: GLfloat2) {
        this._ndcOffset = offset;
    }

    public set viewProjection(value: mat4 | undefined) {
        this._viewProjection = value;
    }

    set lines(lines: Float32Array) {
        this._lines = lines;

        const gl = this._gl;
        this._linesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._linesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this._lines, gl.STATIC_DRAW);

        this._altered.alter('lines');
    }
}
