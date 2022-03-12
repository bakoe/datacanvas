import { vec3, WheelZoomModifier, gl_matrix_extensions, mat4 } from 'webgl-operate';
import { CameraMode, ExtendedCamera } from './ExtendedCamera';
const { v3, m4 } = gl_matrix_extensions;

export class ExtendedCameraWheelZoomModifier extends WheelZoomModifier {
    protected _camera: ExtendedCamera | undefined = undefined;
    protected _zoomOffset: number = 0.0;

    protected _sensitivity: number = WheelZoomModifier.DEFAULT_SENSITIVITY * 0.1;

    process(delta: number): void {
        Object.assign(this._reference, this._camera);

        if (this._camera?.mode === CameraMode.Orthographic) {
            this._zoomOffset = delta * this._sensitivity;
        } else if (this._camera?.mode === CameraMode.Perspective) {
            const magnitude = delta * this._sensitivity;

            const eyeToCenter = vec3.sub(v3(), this._reference.center, this._reference.eye);
            vec3.normalize(eyeToCenter, eyeToCenter);

            this._translation = vec3.scale(v3(), eyeToCenter, magnitude);
        }

        this.update();
    }

    update(): void {
        if (this._camera === undefined) {
            return;
        }

        if (this._camera.mode === CameraMode.Orthographic) {
            this._camera.zoom = this._camera.zoom * (1.0 - this._zoomOffset * 0.1);
        } else if (this._camera.mode === CameraMode.Perspective) {
            /* Adjust for arbitrary camera center and rotate using quaternion based rotation. */

            const T = mat4.fromTranslation(m4(), this._translation);

            let eye = vec3.transformMat4(v3(), this._reference.eye, T);
            // If the zoom would move the camera's eye "behind" the current camera center, discard it (i.e., keep the camera eye)
            const newEyeToCenter = vec3.sub(v3(), this._reference.center, eye);
            const referenceEyeToCenter = vec3.sub(v3(), this._reference.center, this._reference.eye);
            if (vec3.dot(newEyeToCenter, referenceEyeToCenter) <= 0) {
                eye = this._reference.eye;
            }

            this._camera.eye = eye;
        }
    }
}
