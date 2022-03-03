import { ChangeLookup, Context, Framebuffer, GLTFPbrMaterial, GLTFPrimitive, Initializable, mat4, Program, Shader } from 'webgl-operate';
import { GLfloat2 } from 'webgl-operate/lib/tuples';

import gltfAssetVert from '../shaders/gltfAsset.vert';
import gltfAssetFrag from '../shaders/gltfAsset.frag';

export class GltfAssetPass extends Initializable {
    protected readonly _altered = Object.assign(new ChangeLookup(), {
        any: false,

        primitive: false,
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
        this._program.link();

        this._uViewProjection = this._program.uniform('u_viewProjection');
        this._uNdcOffset = this._program.uniform('u_ndcOffset');

        return true;
    }

    @Initializable.uninitialize()
    public uninitialize(): void {
        this._program?.uninitialize();
        this._primitive?.uninitialize();

        this._uViewProjection = undefined;
        this._uNdcOffset = undefined;
    }

    @Initializable.assert_initialized()
    public update(_override = false): void {
        this._altered.reset();
    }

    @Initializable.assert_initialized()
    public frame(): void {
        if (!this._target || !this._primitive) {
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

        if (this._uViewProjection && this._viewProjection) gl.uniformMatrix4fv(this._uViewProjection, false, this._viewProjection);
        if (this._uNdcOffset && this._ndcOffset) gl.uniform2fv(this._uNdcOffset, this._ndcOffset);

        const instanceCount = 32 ** 3;
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

    public set primitive(primitive: GLTFPrimitive) {
        this.assertInitialized();
        this._primitive = primitive;
        this._altered.alter('primitive');
    }
}
