import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import {
  CascadeClassifier,
  LBPHFaceRecognizer,
  imdecode,
  drawDetection,
  Vec3,
  drawTextBox,
  imencode,
} from '@u4/opencv4nodejs';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';

@Injectable()
export class OpencvService {
  private classifier: CascadeClassifier;
  private lbph: LBPHFaceRecognizer;

  constructor(
    private readonly loggerService: Logger,
    private readonly configService: ConfigService,
  ) {
    this.classifier = new CascadeClassifier('./models/haarcascade_frontalcatface_extended.xml');
  }

  public loadLBPH(model: Buffer): LBPHFaceRecognizer {
    this.lbph = new LBPHFaceRecognizer();
    writeFileSync('./model.yaml', model);
    this.lbph.load('./model.yaml');
    unlinkSync('./model.yaml');
    return this.lbph;
  }

  public async generateModel(imgs: [string, Buffer][]): Promise<Buffer> {
    const trainData = imgs
      .map((val) => {
        const label = this.configService
          .get('NAME_MAPPINGS')
          .split(',')
          .findIndex((name: string) => val[0].includes(name));
        if (label < 0) {
          return undefined;
        }

        const originalImage = imdecode(val[1]);

        const faceRects = this.classifier.detectMultiScale(originalImage).objects;
        if (!faceRects.length) {
          return undefined;
        }

        return {
          grayImage: originalImage.getRegion(faceRects[0]).bgrToGray().resize(80, 80),
          label,
        };
      })
      .filter((t) => t);

    const lbph = new LBPHFaceRecognizer();
    lbph.train(
      trainData.map((t) => t.grayImage),
      trainData.map((t) => t.label),
    );
    lbph.save('./trainer.yaml');
    const result = readFileSync('./trainer.yaml');
    unlinkSync('./trainer.yaml');
    return result;
  }

  public async predict(img: Buffer): Promise<[string, Buffer]> {
    const start = Date.now();
    const image = imdecode(img);
    if (image.empty) return Promise.resolve(['empty', img]);
    const classified = this.classifier.detectMultiScale(image.bgrToGray());

    let identified = 0;
    let who = undefined;

    const whos = [];

    classified.objects.forEach((faceRect, i) => {
      if (classified.numDetections[i] < this.configService.get('MIN_DETECTIONS')) {
        return;
      }
      identified++;
      const faceImg = image.getRegion(faceRect).bgrToGray();
      who = this.configService.get('NAME_MAPPINGS').split(',')[this.lbph.predict(faceImg).label];
      whos.push(who);

      const rect = drawDetection(image, faceRect, {
        color: new Vec3(255, 0, 0),
        segmentFraction: 4,
      });

      const alpha = 0.4;
      drawTextBox(image, { x: rect.x, y: rect.y + rect.height + 10 }, [{ text: who }], alpha);
    });

    if (new Set(whos).size != identified) {
      identified = 0;
    }

    const resultImage = imencode('.jpeg', image);
    this.loggerService.log(`Cascade Time elapsed: ${Date.now() - start} ms with result ${who}`);
    switch (identified) {
      case 0:
        return [undefined, resultImage];
      case 1:
        return [who, resultImage];
      default:
        return ['multi', resultImage];
    }
  }
}
