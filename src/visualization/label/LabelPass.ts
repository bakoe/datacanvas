import {
    ChangeLookup,
    Context,
    FontFace,
    Initializable,
    Label,
    LabelRenderPass,
    Position3DLabel,
    Projected3DLabel,
    Text,
    vec3,
} from 'webgl-operate';

export type LabelInfo = {
    name: string;
    pos: vec3;
    dir: vec3;
    up: vec3;
    alignment?: Label.Alignment;
    lineWidth?: number;
    elide?: Label.Elide;
    lineAnchor?: Label.LineAnchor;
    fontSize?: number;
    ellipsis?: string;
};

export type LabelSet = {
    labels: LabelInfo[];
    useNearest: boolean;
};

export class LabelPass extends LabelRenderPass {
    protected readonly _labelsAltered = Object.assign(new ChangeLookup(), {
        any: false,

        sets: false,
        labels: false,
        fontFace: false,
    });

    protected _context: Context;
    protected _gl: WebGLRenderingContext | WebGL2RenderingContext;

    protected _fontFace: FontFace | undefined;

    protected _labelSets: LabelSet[] = [];
    protected _lastIndices: number[] = [];
    protected _labelInfo: LabelInfo[] = [];

    public constructor(context: Context) {
        super(context);
        this._context = context;
        this._gl = context.gl;
    }

    @Initializable.assert_initialized()
    public update(override = false): void {
        if (override || this._labelsAltered.sets || this._camera.altered) {
            this.updateLabels();
        }
        if (override || this._labelsAltered.labels) {
            this.setupLabels();
        }

        if (override || this._labelsAltered.fontFace) {
            for (const label of this.labels) {
                label.fontFace = this._fontFace;
            }
        }

        // update after own updates to catch changes to labels
        super.update(override);

        this._labelsAltered.reset();
    }

    @Initializable.assert_initialized()
    public frame(): void {
        // text is actually rendered on the back face
        this._gl.cullFace(this._gl.FRONT);
        super.frame();
        this._gl.cullFace(this._gl.BACK);
        this._gl.enable(this._gl.DEPTH_TEST);
        this._gl.disable(this._gl.BLEND);
    }

    public loadFont(font: string, img: string, invalidate: (force: boolean) => void): void {
        FontFace.fromFiles(font, new Map([[0, img]]), this._context).then((fontFace) => {
            this._fontFace = fontFace;
            this._labelsAltered.alter('fontFace');
            invalidate(false);
        });
    }

    public set labelInfo(labels: LabelSet[]) {
        this._labelSets = labels;
        this._lastIndices = new Array<number>(labels.length).fill(-1);
        this._labelsAltered.alter('sets');
    }

    protected updateLabels(): void {
        const indices = this._labelSets
            .map((s) => {
                const distances = s.labels.map((l) => {
                    return vec3.dist(l.pos, this._camera.eye);
                });
                let index: number | undefined;
                let distance: number;
                distances.forEach((d, i) => {
                    if (distance === undefined || s.useNearest != d > distance) {
                        index = i;
                        distance = d;
                    }
                });
                return index;
            })
            .filter((index) => index !== undefined) as number[];
        const changed = indices.reduce((acc, index, i) => acc || index !== this._lastIndices[i], false);
        this._lastIndices = indices;
        if (changed) {
            this._labelInfo = this._labelSets
                .map((s, i) => s.labels[indices[i]])
                .map((labelInfo) => {
                    const MIN_FONT_SIZE = 0.05;
                    const MAX_FONT_SIZE = 0.3;
                    const distanceToCamera = vec3.dist(labelInfo.pos, this._camera.eye);
                    const MAX_DISTANCE_TO_CAMERA = 30.0;
                    const fontSize =
                        MIN_FONT_SIZE + Math.min(distanceToCamera / MAX_DISTANCE_TO_CAMERA, 1.0) * (MAX_FONT_SIZE - MIN_FONT_SIZE);
                    return {
                        ...labelInfo,
                        fontSize: fontSize,
                    };
                });
            this._labelsAltered.alter('labels');
        }
    }

    protected setupLabels(): void {
        this.labels = [];

        this._labelInfo?.forEach((i) => {
            const l = new Position3DLabel(new Text(i.name), Label.Type.Static);
            l.fontFace = this._fontFace;
            l.fontSize = i.fontSize || 0.15;
            l.fontSizeUnit = Label.Unit.World;
            l.lineAnchor = i.lineAnchor || Label.LineAnchor.Ascent;
            l.alignment = i.alignment || Label.Alignment.Left;
            l.lineWidth = i.lineWidth || 0;
            l.elide = i.elide || Label.Elide.None;
            l.ellipsis = i.ellipsis !== undefined ? i.ellipsis : '...';
            l.position = i.pos;
            l.direction = i.dir;
            l.up = i.up;
            l.color.fromRGB(1, 1, 1);
            this.labels.push(l);
        });
    }

    public get altered(): boolean {
        return this._altered.any || this._labelsAltered.any;
    }

    public get labelPositions(): LabelInfo[] {
        return this._labelInfo;
    }
}
