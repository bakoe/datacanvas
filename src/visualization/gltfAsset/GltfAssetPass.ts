import {
    ChangeLookup,
    Context,
    Framebuffer,
    GLTFPbrMaterial,
    GLTFPrimitive,
    Initializable,
    mat4,
    Program,
    Shader,
    vec3,
    gl_matrix_extensions,
} from 'webgl-operate';
import { GLfloat2 } from 'webgl-operate/lib/tuples';

const { m4 } = gl_matrix_extensions;

import gltfAssetVert from '../shaders/gltfAsset.vert';
import gltfAssetFrag from '../shaders/gltfAsset.frag';

export class GltfAssetPass extends Initializable {
    protected readonly _altered = Object.assign(new ChangeLookup(), {
        any: false,

        primitive: false,
        positions: false,
        modelGlobal: false,
        scale: false,
    });

    private _viewProjection: mat4 | undefined;
    private _ndcOffset: number[] | undefined;

    protected _context: Context;
    protected _gl: WebGLRenderingContext | WebGL2RenderingContext;

    protected _target: Framebuffer | undefined;

    protected _program: Program;

    protected _uViewProjection: WebGLUniformLocation | undefined;
    protected _uNdcOffset: WebGLUniformLocation | undefined;

    protected _primitive: GLTFPrimitive | undefined;

    protected _positions: vec3[] = [];
    protected _modelTransformsBuffer: any;

    private _scale: vec3 | undefined;

    private _modelGlobal: mat4 | undefined;
    protected _uModelGlobal: WebGLUniformLocation | undefined;

    public constructor(context: Context) {
        super();
        this._context = context;
        this._gl = context.gl;

        this._program = new Program(this._context);
    }

    @Initializable.initialize()
    public initialize(): boolean {
        const vert = new Shader(this._context, this._gl.VERTEX_SHADER, 'gltfAsset.vert');
        vert.initialize(gltfAssetVert);
        const frag = new Shader(this._context, this._gl.FRAGMENT_SHADER, 'gltfAsset.frag');
        frag.initialize(gltfAssetFrag);

        this._program.initialize([vert, frag], false);

        this._program.attribute('a_vertex', 0);
        this._program.attribute('a_color', 1);
        this._program.attribute('a_model', 2);
        this._program.link();

        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uNdcOffset = this._program.uniform('u_ndcOffset');

        this._uModelGlobal = this._program.uniform('u_modelGlobal');

        return true;
    }

    @Initializable.uninitialize()
    public uninitialize(): void {
        this._program?.uninitialize();
        this._gl.deleteBuffer(this._modelTransformsBuffer);
        this._primitive?.uninitialize();

        this._uViewProjection = undefined;
        this._uNdcOffset = undefined;

        this._uModelGlobal = undefined;
    }

    @Initializable.assert_initialized()
    public update(_override = false): void {
        this._altered.reset();
    }

    @Initializable.assert_initialized()
    public frame(): void {
        if ((this._positions.length > 0 && this._altered.positions) || this._altered.scale) {
            // TODO: Use a more efficient and better debug-able approach,
            // i.e., use Float32Array views as indicated on https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html
            const modelTransforms = [] as number[];
            for (let index = 0; index < this._positions.length; index++) {
                const position = this._positions[index];
                const scale = mat4.fromScaling(m4(), this._scale || vec3.fromValues(1.0, 1.0, 1.0));
                const translate = mat4.fromTranslation(m4(), position);
                const scaleAndTranslate = mat4.mul(m4(), translate, scale);
                modelTransforms.push(
                    scaleAndTranslate[0],
                    scaleAndTranslate[1],
                    scaleAndTranslate[2],
                    scaleAndTranslate[3],
                    scaleAndTranslate[4],
                    scaleAndTranslate[5],
                    scaleAndTranslate[6],
                    scaleAndTranslate[7],
                    scaleAndTranslate[8],
                    scaleAndTranslate[9],
                    scaleAndTranslate[10],
                    scaleAndTranslate[11],
                    scaleAndTranslate[12],
                    scaleAndTranslate[13],
                    scaleAndTranslate[14],
                    scaleAndTranslate[15],
                );
            }

            const gl = this._gl;
            this._modelTransformsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this._modelTransformsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(modelTransforms.flat()), gl.DYNAMIC_DRAW);

            this._altered.reset();
        }

        if (!this._target || !this._primitive || this._positions.length === 0 || this._modelTransformsBuffer === undefined) {
            return;
        }

        const indexBufferInformation = this._primitive.indexBufferInformation;
        const positionBufferInformation = this._primitive.getVertexBufferInformationFromAttribute('POSITION')!;
        const texCoordBufferInformation = this._primitive.getVertexBufferInformationFromAttribute('TEXCOORD_0')!;
        const material = this._primitive.material as GLTFPbrMaterial;
        const texture = material.baseColorTexture!;

        const gl = this._gl;

        this._target.bind();

        const size = this._target.size;

        gl.viewport(0, 0, size[0], size[1]);

        gl.enable(gl.DEPTH_TEST);
        // gl.enable(gl.BLEND);
        // gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.CULL_FACE);
        // gl.depthMask(false);
        // gl.clear(gl.COLOR_BUFFER_BIT);

        this._program.bind();
        texture.bind(gl.TEXTURE0);

        // Setup positions
        gl.enableVertexAttribArray(0);
        positionBufferInformation.buffer.attribEnable(
            0,
            positionBufferInformation.size,
            positionBufferInformation.type,
            positionBufferInformation.normalized,
            positionBufferInformation.stride,
            positionBufferInformation.offset,
            true,
            true,
        );

        // Setup texture coordinates
        gl.enableVertexAttribArray(1);
        texCoordBufferInformation.buffer.attribEnable(
            1,
            texCoordBufferInformation.size,
            texCoordBufferInformation.type,
            texCoordBufferInformation.normalized,
            texCoordBufferInformation.stride,
            texCoordBufferInformation.offset,
            true,
            true,
        );

        // Setup within-model matrix transforms
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(2 + 1);
        gl.enableVertexAttribArray(2 + 2);
        gl.enableVertexAttribArray(2 + 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._modelTransformsBuffer);

        // refer to https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer for more information
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 4 * 4 * Float32Array.BYTES_PER_ELEMENT, 0);
        gl.vertexAttribPointer(2 + 1, 4, gl.FLOAT, false, 4 * 4 * Float32Array.BYTES_PER_ELEMENT, 1 * 4 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribPointer(2 + 2, 4, gl.FLOAT, false, 4 * 4 * Float32Array.BYTES_PER_ELEMENT, 2 * 4 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribPointer(2 + 3, 4, gl.FLOAT, false, 4 * 4 * Float32Array.BYTES_PER_ELEMENT, 3 * 4 * Float32Array.BYTES_PER_ELEMENT);
        // this line says this attribute only changes for each 1 instance
        (gl as any).vertexAttribDivisor(2, 1);
        (gl as any).vertexAttribDivisor(2 + 1, 1);
        (gl as any).vertexAttribDivisor(2 + 2, 1);
        (gl as any).vertexAttribDivisor(2 + 3, 1);

        if (this._uViewProjection && this._viewProjection) gl.uniformMatrix4fv(this._uViewProjection, false, this._viewProjection);
        if (this._uNdcOffset && this._ndcOffset) gl.uniform2fv(this._uNdcOffset, this._ndcOffset);
        if (this._uModelGlobal) gl.uniformMatrix4fv(this._uModelGlobal, false, this._modelGlobal || m4());

        const instanceCount = this._positions.length;
        if (indexBufferInformation === undefined) {
            (gl as any).drawArrays(this._primitive.drawMode, 0, positionBufferInformation.numVertices, instanceCount);
        } else {
            indexBufferInformation.buffer.bind();

            (gl as WebGL2RenderingContext).drawElementsInstanced(
                this._primitive.drawMode,
                indexBufferInformation.numIndices,
                indexBufferInformation.type,
                indexBufferInformation.offset,
                instanceCount,
            );
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        gl.disableVertexAttribArray(2 + 1);
        gl.disableVertexAttribArray(2 + 2);
        gl.disableVertexAttribArray(2 + 3);

        this._program.unbind();

        // gl.depthMask(true);
        // gl.enable(gl.CULL_FACE);
    }

    public set target(target: Framebuffer) {
        this.assertInitialized();
        this._target = target;
    }

    public set positions(positions: vec3[]) {
        this.assertInitialized();

        this._positions = positions;
        this._altered.alter('positions');
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

    public set modelGlobal(value: mat4 | undefined) {
        this._modelGlobal = value;
        this._altered.alter('modelGlobal');
    }

    public set scale(value: vec3 | undefined) {
        this._scale = value;
        this._altered.alter('scale');
    }

    public set primitive(primitive: GLTFPrimitive) {
        this.assertInitialized();
        this._primitive = primitive;
        this._altered.alter('primitive');
    }
}
