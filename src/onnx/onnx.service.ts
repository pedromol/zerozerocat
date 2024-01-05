import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import * as sharp from 'sharp';
import { InferenceSession, Tensor } from 'onnxruntime-node';

@Injectable()
export class OnnxService {
  constructor(
    private readonly loggerService: Logger,
    private readonly configService: ConfigService,
  ) {}
  private yolo_classes = [
    'person',
    'bicycle',
    'car',
    'motorcycle',
    'airplane',
    'bus',
    'train',
    'truck',
    'boat',
    'traffic light',
    'fire hydrant',
    'stop sign',
    'parking meter',
    'bench',
    'bird',
    'cat',
    'dog',
    'horse',
    'sheep',
    'cow',
    'elephant',
    'bear',
    'zebra',
    'giraffe',
    'backpack',
    'umbrella',
    'handbag',
    'tie',
    'suitcase',
    'frisbee',
    'skis',
    'snowboard',
    'sports ball',
    'kite',
    'baseball bat',
    'baseball glove',
    'skateboard',
    'surfboard',
    'tennis racket',
    'bottle',
    'wine glass',
    'cup',
    'fork',
    'knife',
    'spoon',
    'bowl',
    'banana',
    'apple',
    'sandwich',
    'orange',
    'broccoli',
    'carrot',
    'hot dog',
    'pizza',
    'donut',
    'cake',
    'chair',
    'couch',
    'potted plant',
    'bed',
    'dining table',
    'toilet',
    'tv',
    'laptop',
    'mouse',
    'remote',
    'keyboard',
    'cell phone',
    'microwave',
    'oven',
    'toaster',
    'sink',
    'refrigerator',
    'book',
    'clock',
    'vase',
    'scissors',
    'teddy bear',
    'hair drier',
    'toothbrush',
  ];

  private async run_model(input: number[]): Promise<number[]> {
    const model = await InferenceSession.create('./models/yolov8x.onnx');
    input = new Tensor(Float32Array.from(input), [1, 3, 640, 640]);
    const outputs = await model.run({ images: input });
    return outputs['output0'].data;
  }

  private async prepare_input(buf: Buffer): Promise<[number[], number, number]> {
    const img = sharp(buf);
    const md = await img.metadata();
    const [img_width, img_height] = [md.width, md.height];
    const pixels = await img
      .removeAlpha()
      .resize({ width: 640, height: 640, fit: 'fill' })
      .raw()
      .toBuffer();
    const red: number[] = [],
      green: number[] = [],
      blue: number[] = [];
    for (let index = 0; index < pixels.length; index += 3) {
      red.push(pixels[index] / 255.0);
      green.push(pixels[index + 1] / 255.0);
      blue.push(pixels[index + 2] / 255.0);
    }
    const input = [...red, ...green, ...blue];
    return [input, img_width, img_height];
  }

  private async detect_objects_on_image(
    buf: Buffer,
  ): Promise<[number, number, number, number, string, number][]> {
    const [input, img_width, img_height] = await this.prepare_input(buf);
    const output = await this.run_model(input);
    return this.process_output(output, img_width, img_height);
  }

  private process_output(
    output: any[],
    img_width: number,
    img_height: number,
  ): [number, number, number, number, string, number][] {
    let boxes = [];
    for (let index = 0; index < 8400; index++) {
      const [class_id, prob] = [...Array(80).keys()]
        .map((col) => [col, output[8400 * (col + 4) + index]])
        .reduce((accum, item) => (item[1] > accum[1] ? item : accum), [0, 0]);
      if (prob < 0.5) {
        continue;
      }
      const label = this.yolo_classes[class_id];
      const xc = output[index];
      const yc = output[8400 + index];
      const w = output[2 * 8400 + index];
      const h = output[3 * 8400 + index];
      const x1 = ((xc - w / 2) / 640) * img_width;
      const y1 = ((yc - h / 2) / 640) * img_height;
      const x2 = ((xc + w / 2) / 640) * img_width;
      const y2 = ((yc + h / 2) / 640) * img_height;
      boxes.push([x1, y1, x2, y2, label, prob]);
    }

    boxes = boxes.sort((box1, box2) => box2[5] - box1[5]);
    const result = [];
    while (boxes.length > 0) {
      result.push(boxes[0]);
      boxes = boxes.filter(
        (box) => this.intersection(boxes[0], box) / this.union(boxes[0], box) < 0.7,
      );
    }
    return result;
  }

  private union(box1: number[], box2: number[]): number {
    const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
    const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
    const box1_area = (box1_x2 - box1_x1) * (box1_y2 - box1_y1);
    const box2_area = (box2_x2 - box2_x1) * (box2_y2 - box2_y1);
    return box1_area + box2_area - this.intersection(box1, box2);
  }

  private intersection(box1: number[], box2: number[]): number {
    const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
    const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
    const x1 = Math.max(box1_x1, box2_x1);
    const y1 = Math.max(box1_y1, box2_y1);
    const x2 = Math.min(box1_x2, box2_x2);
    const y2 = Math.min(box1_y2, box2_y2);
    return (x2 - x1) * (y2 - y1);
  }

  public async process(buf: Buffer): Promise<[string, number][]> {
    const start = Date.now();
    const boxes = await this.detect_objects_on_image(buf);
    this.loggerService.log(`ONNX Time elapsed: ${Date.now() - start} ms`);
    return boxes.map((b) => [b[4], b[5]]);
  }
}
