/* spellchecker: disable */

import {
    Canvas,
    DefaultFramebuffer,
    Program,
    Shader,
    Renderer,
    Wizard,
    NdcFillingRectangle,
    mat4,
    Camera,
    Navigation,
    Invalidate,
    EventProvider,
    Context,
    vec3,
} from 'webgl-operate';
import { Application } from './Application';

/* spellchecker: enable */

class DatacubesRenderer extends Renderer {
    protected static readonly FLOOR_SHADER_SOURCE_VERT: string = `
precision lowp float;

layout(location = 0) in vec3 a_vertex;

uniform mat4 u_viewProjection;
uniform mat4 u_model;

out vec4 v_vertex;
// out vec2 v_uv;

void main()
{
    v_vertex = u_model * vec4(a_vertex, 1.0);
    // v_uv = a_texCoord;

    gl_Position = u_viewProjection *  v_vertex;
}
`;

    protected static readonly FLOOR_SHADER_SOURCE_FRAG: string = `
precision lowp float;

layout(location = 0) out vec4 fragColor;

uniform vec4 u_clearColor;
uniform vec4 u_diffuse;

in vec4 v_vertex;
// in vec2 v_uv;

float grid(const in vec3 position, const in float scale) {

    vec3 v_pos = fract(+position * scale);
    vec3 grid0 = smoothstep(vec3(0.0), 2.0 * fwidth(v_pos), v_pos);

    vec3 v_neg = fract(-position * scale);
    vec3 grid1 = smoothstep(vec3(0.0), 2.0 * fwidth(v_neg), v_neg);

    vec3 intensity = vec3(1.0) - grid0 * grid1;

    return max(intensity.x, intensity.y) *
        max(intensity.y, intensity.z) *
        max(intensity.z, intensity.x);
}

void main(void)
{
    vec3 g = vec3(
        grid(v_vertex.xyz,  2.0) * 1.00,
        grid(v_vertex.xyz,  4.0) * 0.50,
        grid(v_vertex.xyz, 16.0) * 0.25);

    vec2 uv = v_vertex.xz * 0.125;
    float d = 1.0 - sqrt(dot(uv, uv));

    float alpha = d * max(g[0], max(g[1], g[2]));

    vec4 color = mix(u_clearColor, u_diffuse, alpha);
    fragColor = vec4(color.rgb, color.a * alpha);
}
`;

    protected _extensions = false;

    protected _defaultFBO: DefaultFramebuffer | undefined;

    protected _floor: NdcFillingRectangle | undefined;
    protected _floorTransform: mat4 | undefined;

    protected _program: Program | undefined;

    protected _uViewProjection: WebGLUniformLocation | undefined;
    protected _uModel: WebGLUniformLocation | undefined;
    protected _uDiffuse: WebGLUniformLocation | undefined;

    protected _camera: Camera | undefined;
    protected _navigation: Navigation | undefined;

    /**
     * Initializes and sets up rendering passes, navigation, loads a font face and links shaders with program.
     * @param context - valid context to create the object for.
     * @param identifier - meaningful name for identification of this instance.
     * @param mouseEventProvider - required for mouse interaction
     * @returns - whether initialization was successful
     */
    protected onInitialize(_context: Context, callback: Invalidate, eventProvider: EventProvider): boolean {
        /* Create framebuffers, textures, and render buffers. */

        this._defaultFBO = new DefaultFramebuffer(this._context, 'DefaultFBO');
        this._defaultFBO.initialize();
        this._defaultFBO.bind();

        /* Create and configure canvas-size test pattern pass. */

        const gl = this._context.gl;

        this._floor = new NdcFillingRectangle(this._context, 'Floor');
        this._floor.initialize();
        // prettier-ignore
        this._floorTransform = mat4.fromValues(
            16.0,  0.0,  0.0, 0.0,
            0.0,   0.0, 16.0, 0.0,
            0.0,  16.0,  0.0, 0.0,
            0.0,   0.0,  0.0, 1.0
        );

        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'floor.vert (in-line)');
        vert.initialize(DatacubesRenderer.FLOOR_SHADER_SOURCE_VERT);
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'floor.frag (in-line)');
        frag.initialize(DatacubesRenderer.FLOOR_SHADER_SOURCE_FRAG);

        this._program = new Program(this._context, 'FloorProgram');
        this._program.initialize([vert, frag], false);

        this._program.link();
        this._program.bind();

        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uModel = this._program.uniform('u_model');
        this._uDiffuse = this._program.uniform('u_diffuse');

        this._camera = new Camera();

        this._camera.center = vec3.fromValues(0.0, 0.5, 0.0);
        this._camera.up = vec3.fromValues(0.0, 1.0, 0.0);
        this._camera.eye = vec3.fromValues(2.0, 2.0, 4.0);
        this._camera.near = 0.01;
        this._camera.far = 32.0;

        this._navigation = new Navigation(callback, eventProvider);
        this._navigation.camera = this._camera;

        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this.finishLoading();

        return true;
    }

    /**
     * Uninitializes Buffers, Textures, and Program.
     */
    protected onUninitialize(): void {
        super.uninitialize();

        this._floor?.uninitialize();
        this._program?.uninitialize();

        this._defaultFBO?.uninitialize();
    }

    protected onDiscarded(): void {
        this._altered.alter('canvasSize');
        this._altered.alter('clearColor');
        this._altered.alter('frameSize');
    }

    /**
     * This is invoked in order to check if rendering of a frame is required by means of implementation specific
     * evaluation (e.g., lazy non continuous rendering). Regardless of the return value a new frame (preparation,
     * frame, swap) might be invoked anyway, e.g., when update is forced or canvas or context properties have
     * changed or the renderer was invalidated @see{@link invalidate}.
     * @returns whether to redraw
     */
    protected onUpdate(): boolean {
        this._navigation?.update();
        return this._altered.any || (!!this._camera && this._camera.altered);
    }

    /**
     * This is invoked in order to prepare rendering of one or more frames, regarding multi-frame rendering and
     * camera-updates.
     */
    protected onPrepare(): void {
        if (this._altered.canvasSize && this._camera) {
            this._camera.aspect = this._canvasSize[0] / this._canvasSize[1];
            this._camera.viewport = this._canvasSize;
        }
        if (this._altered.clearColor && this._defaultFBO && this._program) {
            this._defaultFBO.clearColor(this._clearColor);
            this._context.gl.uniform4f(
                this._program.uniform('u_clearColor'),
                this._clearColor[0],
                this._clearColor[1],
                this._clearColor[2],
                this._clearColor[3],
            );
        }
        this._altered.reset();
        if (this._camera) {
            this._camera.altered = false;
        }
    }

    /**
     * After (1) update and (2) preparation are invoked, a frame is invoked. Renders both 2D and 3D labels.
     * @param frameNumber - for intermediate frames in accumulation rendering
     */
    protected onFrame(/*frameNumber: number*/): void {
        const gl = this._context.gl;

        this._defaultFBO?.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, true, false);

        gl.viewport(0, 0, this._canvasSize[0], this._canvasSize[1]);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);

        this._program?.bind();
        gl.uniformMatrix4fv(this._uViewProjection, false, this._camera?.viewProjection);

        gl.depthFunc(gl.LEQUAL);

        this._floor?.bind();
        gl.uniformMatrix4fv(this._uModel, false, this._floorTransform);

        this._context.gl.uniform4f(this._uDiffuse, 0.5, 0.5, 0.5, 0.25);

        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);
        this._floor?.draw();
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);

        this._floor?.unbind();

        this._program?.unbind();

        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);
    }
}

export class DatacubesApplication extends Application {
    protected declare _renderer: DatacubesRenderer | undefined;

    onInitialize(element: HTMLCanvasElement | string, spinnerElement?: HTMLDivElement): boolean {
        this._canvas = new Canvas(element, { antialias: false });
        this._canvas.controller.multiFrameNumber = 1;
        this._canvas.framePrecision = Wizard.Precision.byte;
        this._canvas.frameScale = [1.0, 1.0];

        this._renderer = new DatacubesRenderer();
        this._canvas.renderer = this._renderer;

        this._spinner = spinnerElement;

        return true;
    }
}
