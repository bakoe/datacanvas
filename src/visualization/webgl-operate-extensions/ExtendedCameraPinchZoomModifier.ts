import { vec2, gl_matrix_extensions, vec3, mat4 } from 'webgl-operate';

const { v2, v3, m4 } = gl_matrix_extensions;

import { PinchZoomModifier } from 'webgl-operate';
import { CameraMode, ExtendedCamera } from './ExtendedCamera';

export class ExtendedCameraPinchZoomModifier extends PinchZoomModifier {
    protected _camera: ExtendedCamera | undefined = undefined;
    protected _zoomOffset: number = 0.0;
    protected _initialZoom: number | undefined = undefined;

    /**
     * Initiate a new panning at a specific event position.
     * @param point - Position of the current event to derive the magnitude for rotation from.
     */
    initiate(point1: vec2, point2: vec2): void {
        Object.assign(this._reference, this._camera);

        const magnitudes = vec2.subtract(v2(), point1, point2);
        this._initialDistance = vec2.length(magnitudes);

        if (this._camera?.mode === CameraMode.Orthographic) {
            this._initialZoom = this._camera?.zoom;
        }
    }

    /**
     * Update the panning transform w.r.t. a specific event position.
     * @param point - Position of the current event to derive the magnitude for translation from.
     */
    process(point1: vec2, point2: vec2): void {
        /* Retrieve current event positions. */
        const magnitudes = vec2.subtract(v2(), point1, point2);
        this._currentDistance = vec2.length(magnitudes);

        const change = this._currentDistance / this._initialDistance - 1.0;

        if (this._camera?.mode === CameraMode.Orthographic) {
            this._zoomOffset = change * PinchZoomModifier.DEFAULT_SENSITIVITY;
        } else if (this._camera?.mode === CameraMode.Perspective) {
            const magnitude = change * PinchZoomModifier.DEFAULT_SENSITIVITY;

            const eyeToCenter = vec3.sub(v3(), this._reference.center, this._reference.eye);
            vec3.normalize(eyeToCenter, eyeToCenter);

            this._translation = vec3.scale(v3(), eyeToCenter, magnitude);
        }

        this.update();
    }

    /**
     * Actually applies the trackball rotation to the given camera.
     */
    update(): void {
        if (this._camera === undefined || this._initialZoom === undefined) {
            return;
        }

        if (this._camera.mode === CameraMode.Orthographic) {
            this._camera.zoom = this._initialZoom * (1.0 - -1.0 * this._zoomOffset * 0.5);
        } else if (this._camera?.mode === CameraMode.Perspective) {
            /* Adjust for arbitrary camera center and rotate using quaternion based rotation. */
            const T = mat4.fromTranslation(m4(), this._translation);

            const eye = vec3.transformMat4(v3(), this._reference.eye, T);

            this._camera.eye = eye;
        }
    }
}
