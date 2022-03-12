import { gl_matrix_extensions, mat4, auxiliaries, vec3 } from 'webgl-operate';
import { Camera } from 'webgl-operate';

const { m4, v3 } = gl_matrix_extensions;
const { DEG2RAD } = auxiliaries;

/**
 * A perspective/orthographic, virtual 3D camera specified by eye, center, up, frustumHeight, zoom, near, far, and a viewport size. @see {@link Camera}
 */
export class ExtendedCamera extends Camera {
    private static readonly DEFAULT_FRUSTUM_HEIGHT = 20.0;

    /** @see {@link altered} */
    protected _altered = false;

    /** @see {@link frustumHeight} */
    protected _frustumHeight = ExtendedCamera.DEFAULT_FRUSTUM_HEIGHT;

    /** @see {@link zoom} */
    protected _zoom = 1.0;

    protected _mode: CameraMode;

    constructor(eye?: vec3, center?: vec3, up?: vec3) {
        super(eye, center, up);
        this._mode = CameraMode.Perspective;
    }

    /**
     * Frustum height in world units.
     */
    get frustumHeight(): GLfloat {
        return this._frustumHeight;
    }

    /**
     * Sets the frustum height in world units. The frustum width is based on the frustum height and the {@link aspect}.
     * Invalidates the projection.
     */
    set frustumHeight(frustumHeight: GLfloat) {
        if (this._frustumHeight === frustumHeight) {
            return;
        }
        this._frustumHeight = frustumHeight;
        this.invalidate(false, true);
    }

    /**
     * Zoom factor.
     */
    get zoom(): GLfloat {
        return this._zoom;
    }

    /**
     * Sets the zoom factor. Invalidates the projection.
     */
    set zoom(zoom: GLfloat) {
        if (this._zoom === zoom) {
            return;
        }
        this._zoom = zoom;
        this.invalidate(false, true);
    }

    /**
     * Sets the aspect ratio (width over height); @see {@link Camera}. Invalidates the projection.
     */
    set aspect(aspect: GLfloat) {
        if (this._aspect === aspect) {
            return;
        }
        this._aspect = aspect;

        // Explicitly invalidate the projection matrix on aspect changes!
        this.invalidate(false, true);
    }

    get aspect(): GLfloat {
        return this._aspect;
    }

    /**
     * Either returns the cached projection matrix or derives the current one after invalidation and caches it.
     */
    get projection(): mat4 {
        if (this._projection) {
            // return cached value
            return this._projection;
        }

        if (this._mode === CameraMode.Orthographic) {
            // Based on three.js’s implementation:
            // @see https://github.com/mrdoob/three.js/blob/94f043c4e105eb73236529231388402da2b07cba/src/cameras/OrthographicCamera.js#L87-L95
            let left = -0.5 * this.frustumHeight * this.aspect;
            let right = 0.5 * this.frustumHeight * this.aspect;
            let top = 0.5 * this.frustumHeight;
            let bottom = -0.5 * this.frustumHeight;

            const dx = (right - left) / (2 * this.zoom);
            const dy = (top - bottom) / (2 * this.zoom);
            const cx = (right + left) / 2;
            const cy = (top + bottom) / 2;

            left = cx - dx;
            right = cx + dx;
            top = cy + dy;
            bottom = cy - dy;

            this._projection = mat4.ortho(m4(), left, right, bottom, top, this.near, this.far);
            return this._projection;
        }

        this._projection = mat4.perspective(m4(), this.fovy * DEG2RAD, this.aspect, this.near, this.far);
        return this._projection;
    }

    get mode(): CameraMode {
        return this._mode;
    }

    set mode(mode: CameraMode) {
        this._mode = mode;

        if (mode === CameraMode.Perspective) {
            const distanceToCamera = vec3.len(vec3.sub(v3(), this._center, this._eye));
            const scaledFrustumHeight = this._frustumHeight / this._zoom;
            const newDistanceToCamera = scaledFrustumHeight / Math.abs(Math.atan(DEG2RAD * this._fovy));
            const eye = vec3.scaleAndAdd(
                v3(),
                this._center,
                vec3.sub(v3(), this._eye, this._center),
                newDistanceToCamera / distanceToCamera,
            );
            this.eye = eye;
        }

        if (mode === CameraMode.Orthographic) {
            const distanceToCamera = vec3.len(vec3.sub(v3(), this._center, this._eye));
            const newFrustumHeight = Math.abs(Math.atan(DEG2RAD * this._fovy) * distanceToCamera);
            this.zoom = 1.0 / (newFrustumHeight / this._frustumHeight);
        }

        this.invalidate(false, true);
    }
}

export enum CameraMode {
    Perspective,
    Orthographic,
}
