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
    CuboidGeometry,
    BlitPass,
    AccumulatePass,
    Framebuffer,
    NdcFillingTriangle,
    AntiAliasingKernel,
    Texture2D,
} from 'webgl-operate';
import { Application } from './Application';

import FloorVert from './shaders/floor.vert';
import FloorFrag from './shaders/floor.frag';

import MeshVert from './shaders/mesh.vert';
import MeshFrag from './shaders/mesh.frag';

/* spellchecker: enable */

class DatacubesRenderer extends Renderer {
    protected _extensions = false;

    protected _defaultFBO: DefaultFramebuffer | undefined;

    protected _cuboidsProgram: Program | undefined;
    protected _cuboids: Array<{ geometry: CuboidGeometry; transform: mat4 }> = [];

    protected _uViewProjectionCuboids: WebGLUniformLocation | undefined;
    protected _uModelCuboids: WebGLUniformLocation | undefined;

    protected _floorProgram: Program | undefined;

    protected _floor: NdcFillingRectangle | undefined;
    protected _floorTransform: mat4 | undefined;

    protected _uViewProjectionFloor: WebGLUniformLocation | undefined;
    protected _uModelFloor: WebGLUniformLocation | undefined;
    protected _uDiffuseFloor: WebGLUniformLocation | undefined;

    protected _camera: Camera | undefined;
    protected _navigation: Navigation | undefined;

    // Multi-frame rendering
    protected _colorRenderTexture: Texture2D | undefined;

    protected _intermediateFBOs: Array<Framebuffer> = [];

    protected _ndcTriangle: NdcFillingTriangle | undefined;
    protected _ndcOffsetKernel: AntiAliasingKernel | undefined;

    protected _accumulate: AccumulatePass | undefined;
    protected _blit: BlitPass | undefined;

    protected _uNdcOffsetCuboids: WebGLUniformLocation | undefined;

    /**
     * Initializes and sets up rendering passes, navigation, loads a font face and links shaders with program.
     * @param context - valid context to create the object for.
     * @param identifier - meaningful name for identification of this instance.
     * @param mouseEventProvider - required for mouse interaction
     * @returns - whether initialization was successful
     */
    protected onInitialize(_context: Context, callback: Invalidate, eventProvider: EventProvider): boolean {
        /* Create framebuffers, textures, and render buffers. */

        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        this._defaultFBO = new DefaultFramebuffer(this._context, 'DefaultFBO');
        this._defaultFBO.initialize();
        this._defaultFBO.bind();

        this._ndcTriangle = new NdcFillingTriangle(this._context);
        this._ndcTriangle.initialize();

        this._colorRenderTexture = new Texture2D(this._context, 'ColorRenderTexture');

        this._colorRenderTexture.initialize(
            this._frameSize[0] || 1,
            this._frameSize[1] || 1,
            this._context.isWebGL2 ? gl.RGBA8 : gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
        );

        this._intermediateFBOs = new Array<Framebuffer>(2);

        this._intermediateFBOs[0] = new Framebuffer(this._context, 'IntermediateFBO-0');

        this._intermediateFBOs[0].initialize([
            [gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture],
            // [gl.DEPTH_ATTACHMENT, this._depthRenderbuffer],
        ]);
        this._intermediateFBOs[0].clearColor(this._clearColor);

        this._floor = new NdcFillingRectangle(this._context, 'Floor');
        this._floor.initialize();
        // prettier-ignore
        this._floorTransform = mat4.fromValues(
            16.0,  0.0,  0.0, 0.0,
            0.0,   0.0, 16.0, 0.0,
            0.0,  16.0,  0.0, 0.0,
            0.0,   0.0,  0.0, 1.0
        );

        let vert = new Shader(this._context, gl.VERTEX_SHADER, 'floor.vert');
        vert.initialize(FloorVert);
        let frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'floor.frag');
        frag.initialize(FloorFrag);

        this._floorProgram = new Program(this._context, 'FloorProgram');
        this._floorProgram.initialize([vert, frag], false);

        this._floorProgram.link();
        this._floorProgram.bind();

        this._uViewProjectionFloor = this._floorProgram.uniform('u_viewProjection');
        this._uModelFloor = this._floorProgram.uniform('u_model');
        this._uDiffuseFloor = this._floorProgram.uniform('u_diffuse');

        this._context.gl.uniform4f(
            this._floorProgram.uniform('u_clearColor'),
            this._clearColor[0],
            this._clearColor[1],
            this._clearColor[2],
            this._clearColor[3],
        );

        this._floorProgram.unbind();

        for (let x = 0.25; x <= 1.25; x += 1.0) {
            const cuboid = new CuboidGeometry(this._context, 'Cuboid', true, [0.5, 1.0, 0.5]);
            cuboid.initialize();
            const cuboidTransform = mat4.fromTranslation(mat4.create(), [x, 0.5, 0.25]);

            this._cuboids = [
                ...this._cuboids,
                {
                    geometry: cuboid,
                    transform: cuboidTransform,
                },
            ];
        }

        vert = new Shader(this._context, gl.VERTEX_SHADER, 'mesh.vert');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        vert.initialize(MeshVert);
        frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'mesh.frag');
        frag.initialize(MeshFrag);

        this._cuboidsProgram = new Program(this._context, 'CuboidsProgram');
        this._cuboidsProgram.initialize([vert, frag], false);

        this._cuboidsProgram.attribute('a_vertex', this._cuboids[0].geometry.vertexLocation);
        this._cuboidsProgram.attribute('a_texCoord', this._cuboids[0].geometry.uvCoordLocation);
        this._cuboidsProgram.link();
        this._cuboidsProgram.bind();

        this._uViewProjectionCuboids = this._cuboidsProgram.uniform('u_viewProjection');
        this._uModelCuboids = this._cuboidsProgram.uniform('u_model');
        this._uNdcOffsetCuboids = this._cuboidsProgram.uniform('u_ndcOffset');

        this._cuboidsProgram.unbind();

        this._camera = new Camera();

        this._camera.center = vec3.fromValues(0.0, 0.5, 0.0);
        this._camera.up = vec3.fromValues(0.0, 1.0, 0.0);
        this._camera.eye = vec3.fromValues(2.0, 2.0, 4.0);
        this._camera.near = 0.01;
        this._camera.far = 32.0;

        this._navigation = new Navigation(callback, eventProvider);
        this._navigation.camera = this._camera;

        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this._accumulate = new AccumulatePass(this._context);
        this._accumulate.initialize(this._ndcTriangle);
        this._accumulate.precision = this._framePrecision;
        this._accumulate.texture = this._colorRenderTexture;

        this._blit = new BlitPass(this._context);
        this._blit.initialize(this._ndcTriangle);
        this._blit.readBuffer = gl2facade.COLOR_ATTACHMENT0;
        this._blit.enforceProgramBlit = true;
        this._blit.drawBuffer = gl.BACK;
        this._blit.target = this._defaultFBO;

        this.finishLoading();

        return true;
    }

    /**
     * Uninitializes Buffers, Textures, and Program.
     */
    protected onUninitialize(): void {
        super.uninitialize();

        this._floor?.uninitialize();
        this._floorProgram?.uninitialize();
        this._cuboidsProgram?.uninitialize();

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
        if (this._altered.frameSize) {
            this._intermediateFBOs.forEach((fbo) => {
                if (fbo.initialized) {
                    fbo.resize(this._frameSize[0], this._frameSize[1]);
                }
            });
            if (this._camera) {
                this._camera.viewport = [this._frameSize[0], this._frameSize[1]];
            }
        }
        if (this._altered.canvasSize && this._camera) {
            this._camera.aspect = this._canvasSize[0] / this._canvasSize[1];
            this._camera.viewport = this._canvasSize;
        }
        if (this._altered.clearColor && this._defaultFBO && this._floorProgram) {
            this._defaultFBO.clearColor(this._clearColor);
            this._context.gl.uniform4f(
                this._floorProgram.uniform('u_clearColor'),
                this._clearColor[0],
                this._clearColor[1],
                this._clearColor[2],
                this._clearColor[3],
            );
        }
        if (this._altered.multiFrameNumber) {
            this._ndcOffsetKernel = new AntiAliasingKernel(this._multiFrameNumber);
        }
        this._accumulate?.update();
        this._altered.reset();
        if (this._camera) {
            this._camera.altered = false;
        }
    }

    /**
     * After (1) update and (2) preparation are invoked, a frame is invoked. Renders both 2D and 3D labels.
     * @param frameNumber - for intermediate frames in accumulation rendering
     */
    protected onFrame(frameNumber: number): void {
        const gl = this._context.gl;

        this._intermediateFBOs[0].bind();
        this._intermediateFBOs[0].clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, true, false);

        gl.viewport(0, 0, this._frameSize[0], this._frameSize[1]);

        const ndcOffset = this._ndcOffsetKernel?.get(frameNumber);
        if (ndcOffset) {
            ndcOffset[0] = (2.0 * ndcOffset[0]) / this._frameSize[0];
            ndcOffset[1] = (2.0 * ndcOffset[1]) / this._frameSize[1];
        }

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);

        this._floorProgram?.bind();
        gl.uniformMatrix4fv(this._uViewProjectionFloor, false, this._camera?.viewProjection);

        gl.depthFunc(gl.LEQUAL);

        this._floor?.bind();
        gl.uniformMatrix4fv(this._uModelFloor, false, this._floorTransform);

        this._context.gl.uniform4f(this._uDiffuseFloor, 0.5, 0.5, 0.5, 0.25);

        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);
        this._floor?.draw();
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);

        this._floor?.unbind();

        this._floorProgram?.unbind();

        if (this._cuboids.length > 0) {
            this._cuboidsProgram?.bind();

            gl.uniform2fv(this._uNdcOffsetCuboids, ndcOffset);

            gl.uniformMatrix4fv(this._uViewProjectionCuboids, false, this._camera?.viewProjection);
            gl.cullFace(gl.BACK);

            for (const { geometry, transform } of this._cuboids) {
                geometry.bind();

                gl.uniformMatrix4fv(this._uModelCuboids, false, transform);
                geometry.draw();

                geometry.unbind();
            }

            this._cuboidsProgram?.unbind();
        }

        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);

        this._accumulate?.frame(frameNumber);
    }

    protected onSwap(): void {
        if (this._blit) {
            this._blit.framebuffer = this._accumulate?.framebuffer ? this._accumulate.framebuffer : this._intermediateFBOs[0];
            try {
                this._blit.frame();
            } catch (error) {
                // Do nothing
            }
        }
    }

    set datacubesPositions(datacubesPositions: Array<{ x: number; y: number }>) {
        this._cuboids = [];

        for (const datacubePosition of datacubesPositions) {
            const cuboid = new CuboidGeometry(this._context, 'Cuboid', true, [0.5, 1.0, 0.5]);
            cuboid.initialize();

            const cuboidTransform = mat4.fromTranslation(mat4.create(), [datacubePosition.x, 0.5, datacubePosition.y]);

            this._cuboids = [
                ...this._cuboids,
                {
                    geometry: cuboid,
                    transform: cuboidTransform,
                },
            ];
        }

        // TODO: Use this._altered instead!
        this._invalidate(true);
    }
}

export class DatacubesApplication extends Application {
    protected declare _renderer: DatacubesRenderer | undefined;

    onInitialize(element: HTMLCanvasElement | string, spinnerElement?: HTMLDivElement): boolean {
        this._canvas = new Canvas(element, { antialias: false });
        this._canvas.controller.multiFrameNumber = 8;
        this._canvas.framePrecision = Wizard.Precision.byte;
        this._canvas.frameScale = [1.0, 1.0];

        this._renderer = new DatacubesRenderer();
        this._canvas.renderer = this._renderer;

        this._spinner = spinnerElement;

        return true;
    }

    set datacubesPositions(datacubesPositions: Array<{ x: number; y: number }>) {
        if (this._renderer) {
            this._renderer.datacubesPositions = datacubesPositions;
        }
    }
}
