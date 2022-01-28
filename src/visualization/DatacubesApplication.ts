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
    Renderbuffer,
    ReadbackPass,
    gl_matrix_extensions,
    DebugPass,
    vec4,
    vec2,
} from 'webgl-operate';

const { v3 } = gl_matrix_extensions;

import { Application } from './Application';

import FloorVert from './shaders/floor.vert';
import FloorFrag from './shaders/floor.frag';

import MeshVert from './shaders/mesh.vert';
import MeshFrag from './shaders/mesh.frag';

import DepthFrag from './shaders/depth.frag';
import { XYPosition } from 'react-flow-renderer';
import { PausableNavigation } from './webgl-operate-extensions/PausableNavigation';
import { DatacubeInformation } from './DatacubesVisualization';
import { Observable, Subject } from 'rxjs';
import anime from 'animejs';

/* spellchecker: enable */

interface Cuboid {
    geometry: CuboidGeometry;
    translateXZ: vec2;
    translateY: number;
    scaleY: number;
    id?: number;
}

class DatacubesRenderer extends Renderer {
    protected _extensions = false;

    protected _defaultFBO: DefaultFramebuffer | undefined;

    protected _datacubesSubject: Subject<Array<DatacubeInformation>> | undefined;

    protected _cuboidsProgram: Program | undefined;
    protected _cuboids: Array<Cuboid> = [];

    protected _uViewProjectionCuboids: WebGLUniformLocation | undefined;
    protected _uModelCuboids: WebGLUniformLocation | undefined;

    protected _floorProgram: Program | undefined;

    protected _floor: NdcFillingRectangle | undefined;
    protected _floorTransform: mat4 | undefined;

    protected _uViewProjectionFloor: WebGLUniformLocation | undefined;
    protected _uModelFloor: WebGLUniformLocation | undefined;
    protected _uDiffuseFloor: WebGLUniformLocation | undefined;

    protected _camera: Camera | undefined;
    protected _navigation: PausableNavigation | undefined;

    // Multi-frame rendering
    protected _colorRenderTexture: Texture2D | undefined;

    protected _intermediateFBOs: Array<Framebuffer> = [];

    protected _ndcTriangle: NdcFillingTriangle | undefined;
    protected _ndcOffsetKernel: AntiAliasingKernel | undefined;

    protected _accumulate: AccumulatePass | undefined;
    protected _blit: BlitPass | undefined;

    protected _uNdcOffsetCuboids: WebGLUniformLocation | undefined;

    // Read-back of object IDs and depths
    protected _depthRenderbuffer: Renderbuffer | undefined;

    protected _uEncodedIdCuboids: WebGLUniformLocation | undefined;
    protected _uRenderIDToFragColorCuboids: WebGLUniformLocation | undefined;

    protected _idRenderTexture: Texture2D | undefined;
    protected _readbackPass: ReadbackPass | undefined;

    protected _preDepthFBO: Framebuffer | undefined;
    protected _preDepthRenderbuffer: Renderbuffer | undefined;
    protected _depthTexture: Texture2D | undefined;
    protected _depthProgram: Program | undefined;

    protected _uDepthViewProjection: WebGLUniformLocation | undefined;
    protected _uDepthCameraNearFar: WebGLUniformLocation | undefined;
    protected _uDepthModel: WebGLUniformLocation | undefined;
    protected _uDepthNdcOffset: WebGLUniformLocation | undefined;
    protected _uDepthHideFromDepthBuffer: WebGLUniformLocation | undefined;

    // Debug pass
    protected _debugPass: DebugPass | undefined;

    // Keeping track of whether a cuboid is dragged
    protected _draggedCuboidID: number | undefined;
    protected _dragStartPosition: vec3 | undefined;
    protected _draggedCuboidStartPosition: vec3 | undefined;

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

        const internalFormatAndTypeIDRenderTexture = Wizard.queryInternalTextureFormat(this._context, gl.RGBA, Wizard.Precision.byte);

        this._idRenderTexture = new Texture2D(this._context, 'IDRenderTexture');
        this._idRenderTexture.initialize(1, 1, internalFormatAndTypeIDRenderTexture[0], gl.RGBA, internalFormatAndTypeIDRenderTexture[1]);

        this._intermediateFBOs = new Array<Framebuffer>(2);

        this._intermediateFBOs[0] = new Framebuffer(this._context, 'IntermediateFBO-0');
        this._intermediateFBOs[1] = new Framebuffer(this._context, 'IntermediateFBO-1');

        this._floor = new NdcFillingRectangle(this._context, 'Floor');
        this._floor.initialize();
        // prettier-ignore
        this._floorTransform = mat4.fromValues(
            16.0,  0.0,  0.0, 0.0,
            0.0,   0.0, 16.0, 0.0,
            0.0,  16.0,  0.0, 0.0,
            0.0,   0.0,  0.0, 1.0
        );

        const depthVert = new Shader(this._context, gl.VERTEX_SHADER, 'mesh.vert');
        depthVert.initialize(MeshVert);
        const depthFrag = new Shader(this._context, gl.FRAGMENT_SHADER, 'depth.frag');
        depthFrag.initialize(DepthFrag);

        this._depthProgram = new Program(this._context, 'DepthProgram');
        this._depthProgram.initialize([depthVert, depthFrag], true);
        this._depthProgram.link();
        this._depthProgram.bind();

        this._uDepthViewProjection = this._depthProgram.uniform('u_viewProjection');
        this._uDepthCameraNearFar = this._depthProgram.uniform('u_cameraNearFar');
        this._uDepthModel = this._depthProgram.uniform('u_model');
        this._uDepthNdcOffset = this._depthProgram.uniform('u_ndcOffset');
        this._uDepthHideFromDepthBuffer = this._depthProgram.uniform('u_hideFromDepthBuffer');

        this._depthProgram.unbind();

        this._preDepthRenderbuffer = new Renderbuffer(this._context, 'PreDepthRenderbuffer');
        this._preDepthRenderbuffer.initialize(1, 1, gl.DEPTH_COMPONENT16);

        const depthTextureFormatAndType = Wizard.queryInternalTextureFormat(this._context, gl.RGB, Wizard.Precision.byte);

        this._depthTexture = new Texture2D(this._context, 'DepthTexture');
        this._depthTexture.initialize(1, 1, depthTextureFormatAndType[0], gl.RGB, depthTextureFormatAndType[1]);
        this._depthTexture.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._depthTexture.filter(gl.LINEAR, gl.LINEAR);

        this._preDepthFBO = new Framebuffer(this._context, 'PreDepthFBO');
        this._preDepthFBO.initialize([
            [gl2facade.COLOR_ATTACHMENT0, this._depthTexture],
            [gl.DEPTH_ATTACHMENT, this._preDepthRenderbuffer],
        ]);

        this._depthRenderbuffer = new Renderbuffer(this._context, 'DepthRenderbuffer');
        this._depthRenderbuffer.initialize(1, 1, gl.DEPTH_COMPONENT16);

        this._intermediateFBOs[0].initialize([
            [gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture],
            [gl.DEPTH_ATTACHMENT, this._depthRenderbuffer],
        ]);
        this._intermediateFBOs[0].clearColor(this._clearColor);

        this._intermediateFBOs[1].initialize([
            [gl2facade.COLOR_ATTACHMENT0, this._idRenderTexture],
            [gl.DEPTH_ATTACHMENT, this._depthRenderbuffer],
        ]);
        this._intermediateFBOs[1].clearColor([0, 0, 0, 0]);

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

        vert = new Shader(this._context, gl.VERTEX_SHADER, 'mesh.vert');
        vert.initialize(MeshVert);
        frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'mesh.frag');
        frag.initialize(MeshFrag);

        this._cuboidsProgram = new Program(this._context, 'CuboidsProgram');
        this._cuboidsProgram.initialize([vert, frag], false);

        this._cuboidsProgram.link();
        this._cuboidsProgram.bind();

        this._uViewProjectionCuboids = this._cuboidsProgram.uniform('u_viewProjection');
        this._uModelCuboids = this._cuboidsProgram.uniform('u_model');
        this._uNdcOffsetCuboids = this._cuboidsProgram.uniform('u_ndcOffset');
        this._uEncodedIdCuboids = this._cuboidsProgram.uniform('u_encodedID');
        this._uRenderIDToFragColorCuboids = this._cuboidsProgram.uniform('u_renderIDToFragColor');

        this._cuboidsProgram.unbind();

        this._camera = new Camera();

        this._camera.center = vec3.fromValues(0.0, 0.5, 0.0);
        this._camera.up = vec3.fromValues(0.0, 1.0, 0.0);
        this._camera.eye = vec3.fromValues(2.0, 2.0, 4.0);
        this._camera.near = 0.01;
        this._camera.far = 32.0;

        /* Create and configure debug pass */
        this._debugPass = new DebugPass(this._context);
        this._debugPass.initialize();

        this._debugPass.enforceProgramBlit = true;
        this._debugPass.debug = DebugPass.Mode.None;

        this._debugPass.framebuffer = this._preDepthFBO;
        // this._debugPass.framebuffer = this._intermediateFBOs[1];
        this._debugPass.readBuffer = gl.COLOR_ATTACHMENT0;

        this._debugPass.target = this._defaultFBO;
        this._debugPass.drawBuffer = gl.BACK;

        /* Create and configure readback pass */

        this._readbackPass = new ReadbackPass(this._context);
        this._readbackPass.initialize(this._ndcTriangle, true);
        this._readbackPass.idFBO = this._intermediateFBOs[1];
        this._readbackPass.idAttachment = gl2facade.COLOR_ATTACHMENT0;

        this._readbackPass.depthFBO = this._preDepthFBO;
        this._readbackPass.depthAttachment = gl2facade.COLOR_ATTACHMENT0;

        this._readbackPass.cache = true;

        this._navigation = new PausableNavigation(callback, eventProvider);
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

        eventProvider.pointerEventProvider.down$.subscribe((value) => {
            if (this._idRenderTexture?.valid && this._readbackPass?.initialized && value.target) {
                const elementBoundingRect = (value.target as any).getBoundingClientRect() as DOMRect;
                const xOffset = elementBoundingRect.x;
                const yOffset = elementBoundingRect.y;
                const x = ((value.clientX - xOffset) / (value.target as any).clientWidth) * this._idRenderTexture.width;
                const y = ((value.clientY - yOffset) / (value.target as any).clientHeight) * this._idRenderTexture.height;
                const nodeId = this._readbackPass.idAt(x, y);

                if (nodeId) {
                    if (this._navigation) this._navigation.isPaused = true;
                    this._draggedCuboidID = nodeId;

                    if (this._depthTexture?.valid) {
                        const coordsAt = this._readbackPass.coordsAt(x, y, undefined, this._camera?.viewProjectionInverse as mat4);

                        if (coordsAt) {
                            this._dragStartPosition = coordsAt;
                            const cuboid = this._cuboids.find((cuboid) => cuboid.id === this._draggedCuboidID);
                            const cuboidPosition = vec3.fromValues(
                                cuboid?.translateXZ[0] || 0,
                                cuboid?.translateY || 0,
                                cuboid?.translateXZ[1] || 0,
                            );
                            this._draggedCuboidStartPosition = cuboidPosition;
                        }
                    }
                }
            }
        });

        eventProvider.pointerEventProvider.move$.subscribe((value) => {
            if (this._draggedCuboidID && this._depthTexture?.valid && this._readbackPass?.initialized && value.target) {
                const elementBoundingRect = (value.target as any).getBoundingClientRect() as DOMRect;
                const xOffset = elementBoundingRect.x;
                const yOffset = elementBoundingRect.y;
                const x = ((value.clientX - xOffset) / (value.target as any).clientWidth) * this._depthTexture.width;
                const y = ((value.clientY - yOffset) / (value.target as any).clientHeight) * this._depthTexture.height;

                const coordsAt = this._readbackPass.coordsAt(x, y, undefined, this._camera?.viewProjectionInverse as mat4);

                if (coordsAt) {
                    let datacubePosition = { x: coordsAt[0], y: coordsAt[2] } as XYPosition;

                    if (this._dragStartPosition && this._draggedCuboidStartPosition) {
                        const offset = vec3.subtract(v3(), coordsAt, this._dragStartPosition);
                        const position = vec3.add(v3(), this._draggedCuboidStartPosition, offset);
                        datacubePosition = { x: position[0], y: position[2] } as XYPosition;
                    }

                    const translateY = this._cuboids.find((cuboid) => cuboid.id === this._draggedCuboidID)?.translateY || 0.5;
                    const scaleY = this._cuboids.find((cuboid) => cuboid.id === this._draggedCuboidID)?.scaleY || 1.0;
                    const translateXZ = vec2.fromValues(datacubePosition.x, datacubePosition.y);

                    const updatedCuboids = this._cuboids.map((cuboid) => {
                        if (cuboid.id === this._draggedCuboidID) {
                            return { ...cuboid, translateXZ, translateY, scaleY };
                        }
                        return cuboid;
                    });

                    this._datacubesSubject?.next(
                        updatedCuboids
                            .map((cuboid) => {
                                if (cuboid.id === this._draggedCuboidID) {
                                    return {
                                        id: cuboid.id ? 4294967295 - cuboid.id : 0,
                                        position: {
                                            x: translateXZ[0],
                                            y: translateXZ[1],
                                        },
                                    };
                                }
                                return undefined;
                            })
                            .filter((updatedDatacube) => updatedDatacube !== undefined) as Array<DatacubeInformation>,
                    );

                    this._cuboids = updatedCuboids;
                    this._invalidate(true);
                }
            }
        });

        eventProvider.pointerEventProvider.up$.subscribe(() => {
            if (this._draggedCuboidID) {
                this._draggedCuboidID = undefined;
                if (this._navigation) this._navigation.isPaused = false;
                this.invalidate(true);
            }
        });

        eventProvider.mouseEventProvider.click$.subscribe((value) => {
            if (!this._draggedCuboidID && this._idRenderTexture?.valid && this._readbackPass?.initialized && value.target) {
                const elementBoundingRect = (value.target as any).getBoundingClientRect() as DOMRect;
                const xOffset = elementBoundingRect.x;
                const yOffset = elementBoundingRect.y;
                const x = ((value.clientX - xOffset) / (value.target as any).clientWidth) * this._idRenderTexture.width;
                const y = ((value.clientY - yOffset) / (value.target as any).clientHeight) * this._idRenderTexture.height;
                const nodeId = this._readbackPass.idAt(x, y);
                if (nodeId) {
                    console.log(`Clicked on node with ID: ${nodeId}`);
                } else {
                    console.log('Clicked on background (no node ID)');
                }
            }

            if (!this._draggedCuboidID && this._depthTexture?.valid && this._readbackPass?.initialized && value.target) {
                const elementBoundingRect = (value.target as any).getBoundingClientRect() as DOMRect;
                const xOffset = elementBoundingRect.x;
                const yOffset = elementBoundingRect.y;
                const x = ((value.clientX - xOffset) / (value.target as any).clientWidth) * this._depthTexture.width;
                const y = ((value.clientY - yOffset) / (value.target as any).clientHeight) * this._depthTexture.height;

                console.log(`Depth texture width:`, this._depthTexture.width);
                console.log(`Depth texture height:`, this._depthTexture.height);

                const readDepthAt = this._readbackPass.readDepthAt(x, y);
                console.log(
                    `readDepth at [${x}, ${y}]: ${gl_matrix_extensions.decode_float24x1_from_uint8x3(
                        vec3.fromValues(readDepthAt[0], readDepthAt[1], readDepthAt[2]),
                    )}`,
                );

                const depthAt = this._readbackPass.depthAt(x, y);
                console.log(`depthAt at [${x}, ${y}]: ${depthAt || 'undefined'}`);

                const coordsAt = this._readbackPass.coordsAt(x, y, undefined, this._camera?.viewProjectionInverse as mat4);
                console.log(`Coords at [${x}, ${y}]: ${coordsAt?.toString() ?? 'undefined'}`);
            }
        });

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
            if (this._preDepthFBO) {
                this._preDepthFBO.resize(this._frameSize[0], this._frameSize[1]);
            }
        }
        if (this._altered.canvasSize) {
            if (this._camera) {
                this._camera.aspect = this._canvasSize[0] / this._canvasSize[1];
                this._camera.viewport = this._canvasSize;
                if (this._debugPass) {
                    this._debugPass.dstBounds = vec4.fromValues(
                        this._canvasSize[0] * (1.0 - 0.187),
                        this._canvasSize[1] * (1.0 - 0.187 * this._camera.aspect),
                        this._canvasSize[0] * (1.0 - 0.008),
                        this._canvasSize[1] * (1.0 - 0.008 * this._camera.aspect),
                    );
                }
            }
        }
        if (this._altered.clearColor) {
            this._preDepthFBO?.clearColor([0.9999999403953552, 0.9999999403953552, 0.9999999403953552, 1.0]);
            this._intermediateFBOs[0].clearColor(this._clearColor);
            if (this._defaultFBO && this._floorProgram) {
                this._defaultFBO.clearColor(this._clearColor);
                this._context.gl.uniform4f(
                    this._floorProgram.uniform('u_clearColor'),
                    this._clearColor[0],
                    this._clearColor[1],
                    this._clearColor[2],
                    this._clearColor[3],
                );
            }
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

        // Pre depth pass
        this._preDepthFBO?.bind();
        this._preDepthFBO?.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, true, false);
        gl.viewport(0, 0, this._frameSize[0], this._frameSize[1]);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.depthFunc(gl.NOTEQUAL);
        gl.depthMask(true);

        this._depthProgram?.bind();

        gl.uniform2fv(this._uDepthNdcOffset, ndcOffset);
        // gl.uniform1i(this._uDepthHideFromDepthBuffer, Number(false));
        gl.uniformMatrix4fv(this._uDepthViewProjection, false, this._camera?.viewProjection);
        gl.uniform2fv(this._uDepthCameraNearFar, [this._camera?.near, this._camera?.far]);
        gl.uniform1i(this._uDepthHideFromDepthBuffer, Number(false));

        // Draw floor
        this._floor?.bind();
        gl.uniformMatrix4fv(this._uDepthModel, false, this._floorTransform);
        gl.cullFace(gl.FRONT);
        this._floor?.draw();
        this._floor?.unbind();

        // Draw cuboids
        if (this._cuboids.length > 0) {
            gl.uniform2fv(this._uDepthNdcOffset, ndcOffset);

            for (const { geometry, translateXZ, translateY, scaleY } of this.cuboidsSortedByCameraDistance) {
                geometry.bind();

                const scale = mat4.fromScaling(mat4.create(), vec3.fromValues(1.0, scaleY, 1.0));
                const translate = mat4.fromTranslation(mat4.create(), [translateXZ[0], translateY, translateXZ[1]]);

                const transform = mat4.multiply(mat4.create(), translate, scale);

                gl.uniformMatrix4fv(this._uDepthModel, false, transform);

                if (this._draggedCuboidID) {
                    // If the user currently drags a cuboid, hide all cuboids from the depth buffer
                    gl.uniform1i(this._uDepthHideFromDepthBuffer, Number(true));
                } else {
                    gl.uniform1i(this._uDepthHideFromDepthBuffer, Number(false));
                }

                geometry.draw();

                geometry.unbind();
            }
        }

        this._depthProgram?.unbind();
        this._preDepthFBO?.unbind();

        this._intermediateFBOs[0].bind();
        this._intermediateFBOs[0].clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, true, false);

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

            gl.uniform1i(this._uRenderIDToFragColorCuboids, 0);
            gl.uniform4fv(this._uEncodedIdCuboids, [0, 0, 0, 0]);

            gl.uniformMatrix4fv(this._uViewProjectionCuboids, false, this._camera?.viewProjection);
            gl.cullFace(gl.BACK);

            for (const { geometry, translateXZ, translateY, scaleY } of this.cuboidsSortedByCameraDistance) {
                geometry.bind();

                const scale = mat4.fromScaling(mat4.create(), vec3.fromValues(1.0, scaleY, 1.0));
                const translate = mat4.fromTranslation(mat4.create(), [translateXZ[0], translateY, translateXZ[1]]);

                const transform = mat4.multiply(mat4.create(), translate, scale);

                gl.uniformMatrix4fv(this._uModelCuboids, false, transform);
                geometry.draw();

                geometry.unbind();
            }

            this._cuboidsProgram?.unbind();
        }

        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);

        /* Draw cuboids into ID buffer */

        this._intermediateFBOs[1].bind();
        // this._intermediateFBOs[1].clearColor([1.0, 0.0, 0.0, 1.0]);
        this._intermediateFBOs[1].clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, false, false);

        if (this._cuboids.length > 0) {
            this._cuboidsProgram?.bind();

            // gl.uniform2fv(this._uNdcOffsetCuboids, ndcOffset);

            gl.uniform1i(this._uRenderIDToFragColorCuboids, 1);

            gl.uniformMatrix4fv(this._uViewProjectionCuboids, false, this._camera?.viewProjection);
            gl.cullFace(gl.BACK);

            for (const { geometry, translateXZ, translateY, scaleY, id } of this.cuboidsSortedByCameraDistance) {
                geometry.bind();

                const scale = mat4.fromScaling(mat4.create(), vec3.fromValues(1.0, scaleY, 1.0));
                const translate = mat4.fromTranslation(mat4.create(), [translateXZ[0], translateY, translateXZ[1]]);

                const transform = mat4.multiply(mat4.create(), translate, scale);

                gl.uniformMatrix4fv(this._uModelCuboids, false, transform);

                if (id !== undefined) {
                    const encodedId = vec4.create();
                    // Maximum to-be-encoded ID: 4294967295 (equals [255, 255, 255, 255])
                    gl_matrix_extensions.encode_uint32_to_rgba8(encodedId, id);
                    const encodedIdFloat = new Float32Array(encodedId);
                    encodedIdFloat[0] /= 255.0;
                    encodedIdFloat[1] /= 255.0;
                    encodedIdFloat[2] /= 255.0;
                    encodedIdFloat[3] /= 255.0;

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                    gl.uniform4fv(this._uEncodedIdCuboids, encodedIdFloat);
                    // console.log(id);
                } else {
                    gl.uniform4fv(this._uEncodedIdCuboids, [0, 0, 0, 0]);
                }

                gl.uniform3fv(this._uColorCuboids, [1.0, 0.0, 0.0]);

                geometry.draw();

                geometry.unbind();
            }

            this._cuboidsProgram?.unbind();
        }

        this._intermediateFBOs[1].unbind();

        this._accumulate?.frame(frameNumber);
    }

    protected distanceToCamera(worldPosition: vec3): number {
        const pos = vec3.fromValues(worldPosition[0] || 0, worldPosition[1] || 0, worldPosition[2] || 0);
        const cameraPos = this._camera?.eye;

        if (!cameraPos) {
            return -1;
        }

        return vec3.len(vec3.subtract(v3(), pos, cameraPos));
    }

    get cuboidsSortedByCameraDistance(): Cuboid[] {
        return this._cuboids.sort(
            (a, b) =>
                this.distanceToCamera(vec3.fromValues(b.translateXZ[0], b.translateY, b.translateXZ[1])) -
                this.distanceToCamera(vec3.fromValues(a.translateXZ[0], a.translateY, a.translateXZ[1])),
        );
    }

    protected onSwap(): void {
        if (this._blit) {
            this._blit.framebuffer = this._accumulate?.framebuffer ? this._accumulate.framebuffer : this._intermediateFBOs[0];
            try {
                this._blit.frame();
                this._debugPass?.frame();
            } catch (error) {
                // Do nothing
            }
        }
    }

    set datacubes(datacubes: Array<DatacubeInformation>) {
        if (this._draggedCuboidID) {
            // Block updates from outside while the internal state is being updated
            return;
        }

        const updatedCuboids = [];

        for (const datacube of datacubes) {
            const datacubePosition = datacube.position;
            const datacubeId = datacube.id;
            const existingCuboid = this._cuboids.find((cuboid) => cuboid.id === 4294967295 - datacubeId);
            if (existingCuboid) {
                const from = {
                    translateY: existingCuboid.translateY * 1000,
                    scaleY: existingCuboid.scaleY * 1000,
                };

                const to = {
                    translateY: datacube.relativeHeight * 0.5 * 1000,
                    scaleY: datacube.relativeHeight * 1000,
                };

                // https://animejs.com/documentation/#springPhysicsEasing
                const springParams = {
                    // default: 1, min: 0, max: 100
                    mass: 1,
                    // default: 100, min: 0, max: 100
                    stiffness: 80,
                    // default: 10, min: 10, max: 100
                    damping: 80,
                    // default: 0, min: 0, max: 100
                    velocity: 0,
                };

                const changedSignificantly = (from: any, to: any) => {
                    return Math.abs(from.translateY - to.translateY) > 0.1 || Math.abs(from.scaleY - to.scaleY) > 0.2;
                };

                if (changedSignificantly(from, to)) {
                    console.log('starting anim for datacube', datacubeId);
                    console.log(from);
                    console.log(to);
                    anime({
                        targets: from,
                        translateY: to.translateY,
                        scaleY: to.scaleY,
                        round: 1,
                        easing: `spring(${springParams.mass}, ${springParams.stiffness}, ${springParams.damping}, ${springParams.velocity})`,
                        update: () => {
                            const translateY = from.translateY / 1000;
                            const scaleY = from.scaleY / 1000;

                            existingCuboid.translateY = translateY;
                            existingCuboid.scaleY = scaleY;
                            this._invalidate(true);
                        },
                    });
                }

                existingCuboid.translateXZ = vec2.fromValues(datacubePosition.x, datacubePosition.y);
                updatedCuboids.push(existingCuboid);
            } else {
                const cuboid = new CuboidGeometry(this._context, 'Cuboid', true, [0.5, 1.0, 0.5]);
                cuboid.initialize();

                const translateXZ = vec2.fromValues(datacubePosition.x, datacubePosition.y);
                const translateY = datacube.relativeHeight * 0.5;
                const scaleY = datacube.relativeHeight;

                const newCuboid = {
                    geometry: cuboid,
                    translateXZ,
                    translateY,
                    scaleY,
                    id: 4294967295 - datacubeId,
                };

                updatedCuboids.push(newCuboid);
            }
        }

        this._cuboids = updatedCuboids;

        // TODO: Use this._altered instead!
        this._invalidate(true);
    }

    get datacubes$(): Observable<Array<DatacubeInformation>> {
        if (this._datacubesSubject === undefined) {
            this._datacubesSubject = new Subject<Array<DatacubeInformation>>();
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._datacubesSubject!.asObservable();
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

    set datacubes(datacubes: Array<DatacubeInformation>) {
        if (this._renderer) {
            this._renderer.datacubes = datacubes;
        }
    }

    get datacubes$(): Observable<Array<DatacubeInformation>> | undefined {
        if (this._renderer) {
            return this._renderer.datacubes$;
        }
    }
}
