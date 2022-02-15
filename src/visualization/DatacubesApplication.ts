/* spellchecker: disable */

import {
    Buffer,
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
    ray_math,
    ChangeLookup,
} from 'webgl-operate';

const { v3 } = gl_matrix_extensions;

import { Application } from './Application';

import FloorVert from './shaders/floor.vert';
import FloorFrag from './shaders/floor.frag';

import MeshVert from './shaders/mesh.vert';
import MeshFrag from './shaders/mesh.frag';

import PointVert from './shaders/point.vert';
import PointFrag from './shaders/point.frag';

import DepthFrag from './shaders/depth.frag';
import { XYPosition } from 'react-flow-renderer/nocss';
import { PausableNavigation } from './webgl-operate-extensions/PausableNavigation';
import { DatacubeInformation } from './DatacubesVisualization';
import { Observable, Subject } from 'rxjs';
import anime, { AnimeInstance } from 'animejs';
import { NodeTypes } from '../data/nodes/enums/NodeTypes';
import { PointPrimitiveNodeState } from '../data/nodes/PointPrimitiveNode';
import { NumberColumn } from '@lukaswagner/csv-parser';

/* spellchecker: enable */

interface PointData {
    x: number;
    y: number;
    z: number;
    r: number;
    g: number;
    b: number;
    size: number;
}

const CUBOID_SIZE_X = 0.5;
const CUBOID_SIZE_Y = 1.0;
const CUBOID_SIZE_Z = 0.5;

const DEBUG_SHOW_POINTS_ON_INTERACTION = true;
const DEBUG_SHOW_OFFSCREEN_FRAMEBUFFER = true;

export interface Cuboid {
    geometry: CuboidGeometry;
    translateXZ: vec2;
    translateY: number;
    scaleY: number;
    runningAnimeJSAnimation?: AnimeInstance;
    colorLAB?: [number, number, number];
    id?: number;
    isErroneous?: boolean;
    isPending?: boolean;
    idBufferOnly?: boolean;
    points?: Array<PointData>;
}

// LAB values converted using: https://colors.dopely.top/color-converter/hex/
const DATACUBE_PENDING_COLOR_LAB = [72.77, -49.48, 12.02] as [number, number, number];
const DATACUBE_DEFAULT_COLOR_LAB = [98.87, 1.17, -0.14] as [number, number, number];
const DATACUBE_ERROR_COLOR_LAB = [52.94, 66.39, 42.22] as [number, number, number];

DATACUBE_PENDING_COLOR_LAB[0] /= 100;
DATACUBE_PENDING_COLOR_LAB[1] = (DATACUBE_PENDING_COLOR_LAB[1] + 128) / 256;
DATACUBE_PENDING_COLOR_LAB[2] = (DATACUBE_PENDING_COLOR_LAB[2] + 128) / 256;

DATACUBE_DEFAULT_COLOR_LAB[0] /= 100;
DATACUBE_DEFAULT_COLOR_LAB[1] = (DATACUBE_DEFAULT_COLOR_LAB[1] + 128) / 256;
DATACUBE_DEFAULT_COLOR_LAB[2] = (DATACUBE_DEFAULT_COLOR_LAB[2] + 128) / 256;

DATACUBE_ERROR_COLOR_LAB[0] /= 100;
DATACUBE_ERROR_COLOR_LAB[1] = (DATACUBE_ERROR_COLOR_LAB[1] + 128) / 256;
DATACUBE_ERROR_COLOR_LAB[2] = (DATACUBE_ERROR_COLOR_LAB[2] + 128) / 256;

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

    protected _uColorCuboids: WebGLUniformLocation | undefined;

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

    protected _points: Float32Array | undefined; // x, y, z, r, g, b, data=size
    protected _pointsBuffer: any;
    protected _pointsProgram: Program | undefined;
    protected _uPointsViewProjection: WebGLUniformLocation | undefined;
    protected _uPointsNdcOffset: WebGLUniformLocation | undefined;

    // Keeping track of whether a cuboid is dragged
    protected _draggedCuboidID: number | undefined;
    protected _dragStartPosition: vec3 | undefined;
    protected _draggedCuboidStartPosition: vec3 | undefined;

    protected _debugPoints: Float32Array | undefined; // x, y, z, r, g, b, data=size
    protected _debugPointsBuffer: any;
    protected _debugPointsProgram: Program | undefined;
    protected _debugUPointsViewProjection: WebGLUniformLocation | undefined;
    protected _debugUPointsNdcOffset: WebGLUniformLocation | undefined;
    protected _debugUPointsModel: WebGLUniformLocation | undefined;

    protected declare _altered: ChangeLookup & {
        // eslint-disable-next-line id-blacklist
        any: boolean;
        multiFrameNumber: boolean;
        frameSize: boolean;
        canvasSize: boolean;
        framePrecision: boolean;
        clearColor: boolean;
        debugTexture: boolean;

        cuboids: boolean;
        points: boolean;

        debugPoints: boolean;
    };

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

        this._altered = Object.assign(this._altered, {
            points: false,
            cuboids: false,
            datacubes: false,
            datacubePositions: false,
            debugPoints: false,
        });

        // prettier-ignore
        this.points = new Float32Array([
            // x, y, z, r, g, b, data,
            // 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 10.0
        ]);

        // prettier-ignore
        this.debugPoints = new Float32Array([
            // x, y, z, r, g, b, data,
            // 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 10.0
        ]);

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

        const vertPoint = new Shader(this._context, gl.VERTEX_SHADER, 'point.vert');
        vertPoint.initialize(PointVert);
        const fragPoint = new Shader(this._context, gl.FRAGMENT_SHADER, 'point.frag');
        fragPoint.initialize(PointFrag);

        this._pointsProgram = new Program(this._context, 'PointProgram');
        this._pointsProgram.initialize([vertPoint, fragPoint], false);

        this._pointsProgram.attribute('a_vertex', 0);
        this._pointsProgram.attribute('a_color', 1);
        this._pointsProgram.attribute('a_data', 2);
        this._pointsProgram.link();
        this._pointsProgram.bind();

        this._uPointsViewProjection = this._pointsProgram.uniform('u_viewProjection');
        this._uPointsNdcOffset = this._pointsProgram.uniform('u_ndcOffset');

        this._debugPointsProgram = new Program(this._context, 'PointProgram');
        this._debugPointsProgram.initialize([vertPoint, fragPoint], false);

        this._debugPointsProgram.attribute('a_vertex', 0);
        this._debugPointsProgram.attribute('a_color', 1);
        this._debugPointsProgram.attribute('a_data', 2);
        this._debugPointsProgram.link();
        this._debugPointsProgram.bind();

        this._debugUPointsViewProjection = this._debugPointsProgram.uniform('u_viewProjection');
        this._debugUPointsNdcOffset = this._debugPointsProgram.uniform('u_ndcOffset');
        this._debugUPointsModel = this._debugPointsProgram.uniform('u_model');

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

        this._uColorCuboids = this._cuboidsProgram.uniform('u_color');

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
                            if (DEBUG_SHOW_POINTS_ON_INTERACTION) {
                                const debugPoint = [
                                    // prettier-ignore
                                    coordsAt[0],
                                    coordsAt[1],
                                    coordsAt[2],
                                    1,
                                    0,
                                    0,
                                    15,
                                ];
                                this.debugPoints = this._debugPoints
                                    ? new Float32Array(Array.from(this._debugPoints).concat([debugPoint].flat()).flat())
                                    : new Float32Array([debugPoint].flat());
                            }

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
            if (
                this._draggedCuboidID &&
                this._dragStartPosition &&
                this._depthTexture?.valid &&
                this._readbackPass?.initialized &&
                value.target
            ) {
                const elementBoundingRect = (value.target as any).getBoundingClientRect() as DOMRect;
                const xOffset = elementBoundingRect.x;
                const yOffset = elementBoundingRect.y;
                const x = ((value.clientX - xOffset) / (value.target as any).clientWidth) * this._depthTexture.width;
                const y = ((value.clientY - yOffset) / (value.target as any).clientHeight) * this._depthTexture.height;

                const xView = (x / this._depthTexture.width) * 2.0 - 1.0;
                const yView = -1.0 * ((y / this._depthTexture.height) * 2.0 - 1.0);

                const clickedAtWorldVec4 = vec4.transformMat4(
                    vec4.create(),
                    vec4.fromValues(xView, yView, 0, 1),
                    this._camera?.viewProjectionInverse as mat4,
                );
                clickedAtWorldVec4[0] /= clickedAtWorldVec4[3];
                clickedAtWorldVec4[1] /= clickedAtWorldVec4[3];
                clickedAtWorldVec4[2] /= clickedAtWorldVec4[3];

                const clickedAtWorld = vec3.fromValues(clickedAtWorldVec4[0], clickedAtWorldVec4[1], clickedAtWorldVec4[2]);
                const coordsAt = ray_math.rayPlaneIntersection(
                    this._camera?.eye as vec3,
                    clickedAtWorld,
                    vec3.fromValues(this._dragStartPosition[0], this._dragStartPosition[1], this._dragStartPosition[2]),
                );

                if (coordsAt) {
                    if (DEBUG_SHOW_POINTS_ON_INTERACTION) {
                        const debugPoint = [
                            // prettier-ignore
                            coordsAt[0],
                            coordsAt[1],
                            coordsAt[2],
                            0,
                            1,
                            0,
                            5,
                        ];
                        this.debugPoints = this._debugPoints
                            ? new Float32Array(Array.from(this._debugPoints).concat([debugPoint].flat()).flat())
                            : new Float32Array([debugPoint].flat());
                    }

                    let datacubePosition = { x: coordsAt[0], y: coordsAt[2] } as XYPosition;

                    if (this._draggedCuboidStartPosition) {
                        const offset = vec3.subtract(v3(), coordsAt, this._dragStartPosition);
                        const position = vec3.add(v3(), this._draggedCuboidStartPosition, offset);
                        datacubePosition = { x: position[0], y: position[2] } as XYPosition;
                    }

                    const translateY =
                        this._cuboids.find((cuboid) => cuboid.id === this._draggedCuboidID)?.translateY || CUBOID_SIZE_Y * 0.5;
                    const scaleY = this._cuboids.find((cuboid) => cuboid.id === this._draggedCuboidID)?.scaleY || CUBOID_SIZE_Y;
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
                    this._altered.alter('cuboids');
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

        const gl = this._context.gl;
        gl.deleteBuffer(this._pointsBuffer);
        this._pointsProgram?.uninitialize();
        gl.deleteBuffer(this._debugPointsBuffer);
        this._debugPointsProgram?.uninitialize();

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
        if (this._altered.cuboids) {
            const cuboidsWithPointData = this._cuboids.filter((cuboid) => cuboid.points !== undefined && cuboid.points.length > 0);
            const pointsData = [] as number[];
            if (cuboidsWithPointData.length > 0) {
                for (let cuboidIndex = 0; cuboidIndex < cuboidsWithPointData.length; cuboidIndex++) {
                    const { points, translateXZ, translateY } = cuboidsWithPointData[cuboidIndex];
                    if (points) {
                        for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
                            const point = points[pointIndex];
                            pointsData.push(
                                point.x + translateXZ[0],
                                point.y + translateY,
                                point.z + translateXZ[1],
                                point.r,
                                point.g,
                                point.b,
                                point.size,
                            );
                        }
                    }
                }
            }
            this.points = new Float32Array(pointsData);
        }
        if (this._altered.points) {
            const gl = this._context.gl;
            this._pointsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this._pointsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this._points, gl.STATIC_DRAW);
        }
        if (this._altered.debugPoints) {
            const gl = this._context.gl;
            this._debugPointsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this._debugPointsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this._debugPoints, gl.STATIC_DRAW);
        }
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
            this._preDepthFBO?.clearColor([0.9999999403953552, 0.9999999403953552, 0.9999999403953552, 0.9999999403953552]);
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

        const cuboidsSortedByCameraDistance = this.cuboidsSortedByCameraDistance;

        // Draw cuboids
        if (this._cuboids.length > 0) {
            gl.uniform2fv(this._uDepthNdcOffset, ndcOffset);

            for (const { geometry, translateXZ, translateY, scaleY } of cuboidsSortedByCameraDistance) {
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

            for (const { geometry, translateXZ, translateY, scaleY, colorLAB, idBufferOnly = false } of cuboidsSortedByCameraDistance) {
                if (idBufferOnly) {
                    continue;
                }

                geometry.bind();

                const scale = mat4.fromScaling(mat4.create(), vec3.fromValues(1.0, scaleY, 1.0));
                const translate = mat4.fromTranslation(mat4.create(), [translateXZ[0], translateY, translateXZ[1]]);

                const transform = mat4.multiply(mat4.create(), translate, scale);

                gl.uniformMatrix4fv(this._uModelCuboids, false, transform);
                gl.uniform3fv(this._uColorCuboids, colorLAB || DATACUBE_DEFAULT_COLOR_LAB);

                geometry.draw();

                geometry.unbind();
            }

            this._cuboidsProgram?.unbind();
        }

        // Render points
        if (this.points && this.points.length > 0) {
            gl.disable(gl.CULL_FACE);
            gl.disable(gl.DEPTH_TEST);
            this._intermediateFBOs[0].bind();
            this.renderPoints(ndcOffset || []);
            gl.enable(gl.DEPTH_TEST);
        }

        if (DEBUG_SHOW_POINTS_ON_INTERACTION) {
            // Render debug points
            if (this.debugPoints && this.debugPoints.length > 0) {
                gl.disable(gl.CULL_FACE);
                gl.disable(gl.DEPTH_TEST);
                this._intermediateFBOs[0].bind();

                this.renderDebugPoints(ndcOffset || []);

                gl.enable(gl.DEPTH_TEST);
            }
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

            for (const { geometry, translateXZ, translateY, scaleY, id } of cuboidsSortedByCameraDistance) {
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

                geometry.draw();

                geometry.unbind();
            }

            this._cuboidsProgram?.unbind();
        }

        this._intermediateFBOs[1].unbind();

        this._accumulate?.frame(frameNumber);
    }

    protected renderPoints(ndcOffset: number[]): void {
        const gl = this._context.gl;
        this._pointsProgram?.bind();

        gl.uniformMatrix4fv(this._uPointsViewProjection, gl.GL_FALSE, this._camera?.viewProjection);
        gl.uniform2fv(this._uPointsNdcOffset, ndcOffset);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._pointsBuffer);

        // refer to https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer for more information
        gl.vertexAttribPointer(0, 3, gl.FLOAT, gl.FALSE, 7 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, gl.FALSE, 7 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, gl.FALSE, 7 * Float32Array.BYTES_PER_ELEMENT, 6 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);

        if (this._points) {
            gl.drawArrays(gl.POINTS, 0, this._points.length / 7);
            gl.bindBuffer(gl.ARRAY_BUFFER, Buffer.DEFAULT_BUFFER);
        }

        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);

        this._pointsProgram?.unbind();
    }

    protected renderDebugPoints(ndcOffset: number[]): void {
        const gl = this._context.gl;
        this._debugPointsProgram?.bind();

        gl.uniformMatrix4fv(this._debugUPointsViewProjection, gl.GL_FALSE, this._camera?.viewProjection);
        gl.uniformMatrix4fv(this._debugUPointsModel, gl.GL_FALSE, m4());
        gl.uniform2fv(this._debugUPointsNdcOffset, ndcOffset);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._debugPointsBuffer);

        // refer to https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer for more information
        gl.vertexAttribPointer(0, 3, gl.FLOAT, gl.FALSE, 7 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, gl.FALSE, 7 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, gl.FALSE, 7 * Float32Array.BYTES_PER_ELEMENT, 6 * Float32Array.BYTES_PER_ELEMENT);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);

        if (this._debugPoints) {
            gl.drawArrays(gl.POINTS, 0, this._debugPoints.length / 7);
            gl.bindBuffer(gl.ARRAY_BUFFER, Buffer.DEFAULT_BUFFER);
        }

        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);

        this._debugPointsProgram?.unbind();
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
                if (DEBUG_SHOW_OFFSCREEN_FRAMEBUFFER) {
                    this._debugPass?.frame();
                }
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

        const DATACUBE_PENDING_SCALE_Y = 0.1;

        for (const datacube of datacubes) {
            let renderCuboidToIdBufferOnly = false;
            let points = undefined as undefined | PointData[];
            if (
                datacube.type === NodeTypes.PointPrimitive &&
                datacube.xColumn &&
                datacube.yColumn &&
                datacube.zColumn &&
                // Make sure that the points only update after all (subsequently updated) columns were updated
                datacube.xColumn.length === datacube.yColumn.length &&
                datacube.xColumn.length === datacube.zColumn.length
            ) {
                renderCuboidToIdBufferOnly = true;

                points = [];

                const minX = (datacube.xColumn as NumberColumn).min;
                const maxX = (datacube.xColumn as NumberColumn).max;
                const minY = (datacube.yColumn as NumberColumn).min;
                const maxY = (datacube.yColumn as NumberColumn).max;
                const minZ = (datacube.zColumn as NumberColumn).min;
                const maxZ = (datacube.zColumn as NumberColumn).max;

                let minSize: number;
                let maxSize: number;

                if (datacube.sizeColumn && datacube.sizeColumn.length === datacube.xColumn.length) {
                    minSize = (datacube.sizeColumn as NumberColumn).min;
                    maxSize = (datacube.sizeColumn as NumberColumn).max;
                }

                for (let index = 0; index < datacube.xColumn.length; index++) {
                    const x = datacube.xColumn.get(index) as number;
                    const y = datacube.yColumn.get(index) as number;
                    const z = datacube.zColumn.get(index) as number;
                    const size = datacube.sizeColumn ? (datacube.sizeColumn.get(index) as number) : undefined;

                    const normalizedX = ((x - minX) / (maxX - minX)) * CUBOID_SIZE_X - 0.5 * CUBOID_SIZE_X;
                    const normalizedY = (y - minY) / (maxY - minY) - CUBOID_SIZE_Y * 0.5;
                    const normalizedZ = ((z - minZ) / (maxZ - minZ)) * CUBOID_SIZE_Z - 0.5 * CUBOID_SIZE_Z;
                    const normalizedSize = datacube.sizeColumn ? (size! - minSize!) / (maxSize! - minSize!) : undefined;

                    points.push({
                        x: normalizedX,
                        y: normalizedY,
                        z: normalizedZ,
                        r: 1,
                        g: 1,
                        b: 1,
                        size: normalizedSize ? 2.5 * normalizedSize : 2.5,
                    });
                }
            }

            const datacubePosition = datacube.position;
            const datacubeId = datacube.id;
            const datacubeIsErroneous = datacube.isErroneous;
            const datacubeIsPending = datacube.isPending;
            const existingCuboid = this._cuboids.find((cuboid) => cuboid.id === 4294967295 - datacubeId);
            if (existingCuboid) {
                const from = {
                    translateY: existingCuboid.translateY * 1000,
                    scaleY: existingCuboid.scaleY * 1000,
                    colorLAB0: existingCuboid.colorLAB ? existingCuboid.colorLAB[0] * 1000 : DATACUBE_DEFAULT_COLOR_LAB[0] * 1000,
                    colorLAB1: existingCuboid.colorLAB ? existingCuboid.colorLAB[1] * 1000 : DATACUBE_DEFAULT_COLOR_LAB[1] * 1000,
                    colorLAB2: existingCuboid.colorLAB ? existingCuboid.colorLAB[2] * 1000 : DATACUBE_DEFAULT_COLOR_LAB[2] * 1000,
                };

                const to = datacubeIsPending
                    ? {
                          translateY: DATACUBE_PENDING_SCALE_Y * 0.5 * 1000,
                          scaleY: DATACUBE_PENDING_SCALE_Y * 1000,
                          colorLAB0: DATACUBE_PENDING_COLOR_LAB[0] * 1000,
                          colorLAB1: DATACUBE_PENDING_COLOR_LAB[1] * 1000,
                          colorLAB2: DATACUBE_PENDING_COLOR_LAB[2] * 1000,
                      }
                    : datacubeIsErroneous
                    ? {
                          translateY: datacube.relativeHeight * 0.5 * 1000,
                          scaleY: datacube.relativeHeight * 1000,
                          colorLAB0: DATACUBE_ERROR_COLOR_LAB[0] * 1000,
                          colorLAB1: DATACUBE_ERROR_COLOR_LAB[1] * 1000,
                          colorLAB2: DATACUBE_ERROR_COLOR_LAB[2] * 1000,
                      }
                    : {
                          translateY: datacube.relativeHeight * 0.5 * 1000,
                          scaleY: datacube.relativeHeight * 1000,
                          colorLAB0: DATACUBE_DEFAULT_COLOR_LAB[0] * 1000,
                          colorLAB1: DATACUBE_DEFAULT_COLOR_LAB[1] * 1000,
                          colorLAB2: DATACUBE_DEFAULT_COLOR_LAB[2] * 1000,
                      };

                // Round the scaled target values to 0 decimals (i.e., the unscaled target values to 3 decimals)
                // This is done to avoid unnecessary animation triggering due to numerical precision errors
                to.scaleY = parseFloat(to.scaleY.toFixed(0));
                to.translateY = parseFloat(to.translateY.toFixed(0));
                to.colorLAB0 = parseFloat(to.colorLAB0.toFixed(0));
                to.colorLAB1 = parseFloat(to.colorLAB1.toFixed(0));
                to.colorLAB2 = parseFloat(to.colorLAB2.toFixed(0));

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

                const changedSignificantly = (fromLocal: any, toLocal: any) => {
                    return (
                        Math.abs(fromLocal.translateY - toLocal.translateY) > 1.0 ||
                        Math.abs(fromLocal.scaleY - toLocal.scaleY) > 1.0 ||
                        Math.abs(fromLocal.colorLAB0 - toLocal.colorLAB0) > 1.0 ||
                        Math.abs(fromLocal.colorLAB1 - toLocal.colorLAB1) > 1.0 ||
                        Math.abs(fromLocal.colorLAB2 - toLocal.colorLAB2) > 1.0
                    );
                };

                if (changedSignificantly(from, to)) {
                    if (existingCuboid.runningAnimeJSAnimation) {
                        existingCuboid.runningAnimeJSAnimation.pause();
                        delete existingCuboid.runningAnimeJSAnimation;
                    }
                    const animeInstance = anime({
                        targets: from,
                        translateY: to.translateY,
                        scaleY: to.scaleY,
                        colorLAB0: to.colorLAB0,
                        colorLAB1: to.colorLAB1,
                        colorLAB2: to.colorLAB2,
                        round: 1,
                        easing: `spring(${springParams.mass}, ${springParams.stiffness}, ${springParams.damping}, ${springParams.velocity})`,
                        update: () => {
                            const translateY = from.translateY / 1000;
                            const scaleY = from.scaleY / 1000;
                            const colorLAB = [from.colorLAB0 / 1000, from.colorLAB1 / 1000, from.colorLAB2 / 1000];

                            existingCuboid.translateY = translateY;
                            existingCuboid.scaleY = scaleY;
                            existingCuboid.colorLAB = colorLAB as [number, number, number];
                            this._altered.alter('cuboids');
                            this._invalidate(true);
                        },
                        complete: () => {
                            delete existingCuboid.runningAnimeJSAnimation;
                        },
                    });
                    existingCuboid.runningAnimeJSAnimation = animeInstance;
                }

                existingCuboid.translateXZ = vec2.fromValues(datacubePosition.x, datacubePosition.y);
                existingCuboid.isErroneous = datacubeIsErroneous;
                existingCuboid.isPending = datacubeIsPending;
                existingCuboid.idBufferOnly = renderCuboidToIdBufferOnly;
                existingCuboid.points = points;
                updatedCuboids.push(existingCuboid);
            } else {
                const cuboid = new CuboidGeometry(this._context, 'Cuboid', true, [CUBOID_SIZE_X, CUBOID_SIZE_Y, CUBOID_SIZE_Z]);
                cuboid.initialize();

                const translateXZ = vec2.fromValues(datacubePosition.x, datacubePosition.y);
                let translateY = datacube.relativeHeight * 0.5;
                let scaleY = datacube.relativeHeight;
                let colorLAB = DATACUBE_DEFAULT_COLOR_LAB;

                if (datacubeIsPending) {
                    translateY = DATACUBE_PENDING_SCALE_Y * 0.5;
                    scaleY = DATACUBE_PENDING_SCALE_Y;
                    colorLAB = DATACUBE_PENDING_COLOR_LAB;
                }

                if (datacubeIsErroneous) {
                    colorLAB = DATACUBE_ERROR_COLOR_LAB;
                }

                const newCuboid = {
                    geometry: cuboid,
                    translateXZ,
                    translateY,
                    scaleY,
                    colorLAB,
                    id: 4294967295 - datacubeId,
                    isErroneous: datacubeIsErroneous,
                    isPending: datacubeIsPending,
                    idBufferOnly: renderCuboidToIdBufferOnly,
                    points: points,
                };

                updatedCuboids.push(newCuboid);
            }
        }

        this._cuboids = updatedCuboids;
        this._altered.alter('cuboids');

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

    set points(points: Float32Array | undefined) {
        this._points = points;
        this._altered.alter('points');
    }

    get points(): Float32Array | undefined {
        return this._points;
    }

    set debugPoints(debugPoints: Float32Array | undefined) {
        this._debugPoints = debugPoints;
        this._altered.alter('debugPoints');
    }

    get debugPoints(): Float32Array | undefined {
        return this._debugPoints;
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

        if (element instanceof HTMLCanvasElement) {
            new ResizeObserver(() => {
                this._canvas?.resize();
            }).observe(element);
        }

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
